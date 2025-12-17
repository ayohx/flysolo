import { GoogleGenAI, Type } from "@google/genai";
import { BrandProfile, SocialPost } from "../types";

/**
 * Check if API keys are configured
 */
const API_KEY = process.env.API_KEY || '';
const IMAGEN_API_KEY = process.env.IMAGEN_API_KEY || API_KEY;
const VEO_API_KEY = process.env.VEO_API_KEY || API_KEY;
const VEO_API_KEY_2 = process.env.VEO_API_KEY_2 || VEO_API_KEY;

export const isApiConfigured = (): boolean => {
  return !!API_KEY;
};

export const getMissingApiKeys = (): string[] => {
  const missing: string[] = [];
  if (!API_KEY) missing.push('VITE_GEMINI_API_KEY');
  return missing;
};

/**
 * Multiple API clients for different services:
 * - aiText: For Gemini text generation, analysis, content creation
 * - aiImage: For Imagen image generation (uses different quota/billing)
 * - aiVideo: For VEO 3 video generation (primary key)
 * - aiVideoBackup: For VEO 3 video generation (backup key for failover)
 * 
 * Note: Clients are created lazily to prevent crashes when keys are missing
 */
let aiText: GoogleGenAI | null = null;
let aiImage: GoogleGenAI | null = null;
let aiVideo: GoogleGenAI | null = null;
let aiVideoBackup: GoogleGenAI | null = null;

const getTextClient = (): GoogleGenAI => {
  if (!aiText) {
    if (!API_KEY) throw new Error('VITE_GEMINI_API_KEY environment variable is not set');
    aiText = new GoogleGenAI({ apiKey: API_KEY });
  }
  return aiText;
};

const getImageClient = (): GoogleGenAI => {
  if (!aiImage) {
    if (!IMAGEN_API_KEY) throw new Error('VITE_IMAGEN_API_KEY environment variable is not set');
    aiImage = new GoogleGenAI({ apiKey: IMAGEN_API_KEY });
  }
  return aiImage;
};

const getVideoClient = (): GoogleGenAI => {
  if (!aiVideo) {
    if (!VEO_API_KEY) throw new Error('VITE_VEO_API_KEY environment variable is not set');
    aiVideo = new GoogleGenAI({ apiKey: VEO_API_KEY });
  }
  return aiVideo;
};

const getVideoBackupClient = (): GoogleGenAI => {
  if (!aiVideoBackup) {
    if (!VEO_API_KEY_2) throw new Error('VEO API backup key is not set');
    aiVideoBackup = new GoogleGenAI({ apiKey: VEO_API_KEY_2 });
  }
  return aiVideoBackup;
};

/**
 * Validates that a URL is accessible by using Gemini's search capability.
 * Returns true if the URL is reachable, throws an error otherwise.
 */
export const validateUrlAccessibility = async (url: string): Promise<{ valid: boolean; error?: string }> => {
  const modelId = "gemini-2.5-flash";
  
  try {
    // Use Google Search grounding to verify the website exists
    const response = await getTextClient().models.generateContent({
      model: modelId,
      contents: `Search for information about this website: ${url}
                 
                 Your task: Determine if this is a real, active website.
                 
                 Respond with EXACTLY one of these two options:
                 - "VALID" if you found evidence this is a real, active website
                 - "INVALID: [reason]" if you cannot confirm it exists or it appears inactive`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text?.toUpperCase() || "";
    
    if (text.includes("VALID") && !text.includes("INVALID")) {
      return { valid: true };
    } else {
      return { 
        valid: false, 
        error: "Website appears to be inactive or unreachable. Please check the URL and try again." 
      };
    }
  } catch (error: any) {
    console.error("URL validation failed:", error);
    // If Google Search fails, assume valid and let the brand analysis handle it
    // This prevents blocking users due to API issues
    console.log("Falling back to assume valid due to API error");
    return { valid: true };
  }
};

/**
 * Analyzes the provided website URL.
 * Uses a two-step approach: 1) Google Search for research, 2) Structured JSON extraction
 */
export const analyzeBrand = async (url: string): Promise<BrandProfile> => {
  const modelId = "gemini-2.5-flash";
  
  // Step 1: Research the brand using Google Search (no JSON format)
  console.log("Step 1: Researching brand with Google Search...");
  
  const researchPrompt = `
    Research the business at this URL: ${url}
    
    Find and report:
    1. The exact business name
    2. What industry they're in (be specific - e.g., "Travel Services" not just "Tech")
    3. Their main products and services (list 10-20 specific offerings)
    4. Their social media handles/URLs
    5. Their brand colours (hex codes if visible)
    6. Their brand voice/tone
    7. Their main competitors
    
    Be thorough and accurate. This is for a marketing analysis.
  `;

  let researchData = "";
  try {
    const researchResponse = await aiText.models.generateContent({
      model: modelId,
      contents: researchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    researchData = researchResponse.text || "";
    console.log("Research complete, got", researchData.length, "chars");
  } catch (err) {
    console.warn("Google Search failed, using direct knowledge...", err);
  }

  // Step 2: Parse research into structured JSON
  console.log("Step 2: Structuring brand profile...");
  
  const schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      industry: { type: Type.STRING },
      products: { type: Type.STRING, description: "Overview of what they sell" },
      services: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of 10-20 specific items/products" },
      socialHandles: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of social links or handles" },
      colors: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Hex codes" },
      vibe: { type: Type.STRING },
      visualStyle: { type: Type.STRING, description: "Art direction for image generation" },
      competitors: { type: Type.ARRAY, items: { type: Type.STRING } },
      strategy: { type: Type.STRING },
      essence: { type: Type.STRING, description: "One sentence summary of what this business does" },
      confidence: { type: Type.NUMBER, description: "Confidence score 0-100 on data quality" },
    },
    required: ["name", "industry", "products", "services", "socialHandles", "colors", "vibe", "visualStyle", "competitors", "strategy", "essence", "confidence"],
  };

  const structurePrompt = `
    Based on this research about the business at ${url}:
    
    ${researchData || "No research data available - use your knowledge about this URL."}
    
    Create a comprehensive brand profile with:
    1. name: Exact business name
    2. industry: Specific industry (e.g., "Travel & Airport Services", "E-commerce Fashion")
    3. products: Paragraph describing what they sell
    4. services: Array of 10-20 SPECIFIC services/products they offer
    5. socialHandles: Array of their social media URLs/handles
    6. colors: Array of brand hex colour codes (make educated guesses if not found)
    7. vibe: Their brand voice/personality
    8. visualStyle: Art direction for generating on-brand images
    9. competitors: 3 real competitors
    10. strategy: Marketing strategy tailored to their offerings
    11. essence: One sentence describing what they do
    12. confidence: Score 0-100 on how much real data you found
    
    Return valid JSON.
  `;

  try {
    const structureResponse = await aiText.models.generateContent({
      model: modelId,
      contents: structurePrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const text = structureResponse.text;
    if (!text) {
      throw new Error("No analysis returned from AI");
    }
    
    const profile = JSON.parse(text) as BrandProfile;
    
    // Validate we got real data
    if (profile.confidence && profile.confidence < 20) {
      throw new Error("Insufficient data found about this business. Please ensure the URL is correct.");
    }
    
    return profile;

  } catch (error: any) {
    console.error("Brand analysis failed:", error);
    throw new Error(
      error.message || "Could not analyse website. Please ensure the URL is correct and the website is active."
    );
  }
};

/**
 * Analyzes an additional URL and merges it into the existing profile.
 */
export const mergeSourceUrl = async (currentProfile: BrandProfile, newUrl: string): Promise<BrandProfile> => {
    const modelId = "gemini-2.5-flash";
    
    const prompt = `
      I have an existing brand profile for "${currentProfile.name}".
      Current Services: ${currentProfile.services.join(', ')}
      Current Vibe: ${currentProfile.vibe}
      
      I am adding a new data source: ${newUrl}.
      
      Analyse this new URL (e.g., a blog post, a new product page, a notion page).
      Extract any NEW specific services, products, or tonal nuances found there.
      Merge them with the existing profile.
      
      - Add new services to the top of the list.
      - Refine the strategy if this new content suggests a specific campaign.
      
      Return the updated BrandProfile JSON.
    `;
  
    try {
      const response = await getTextClient().models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
             type: Type.OBJECT,
             properties: {
                name: { type: Type.STRING },
                industry: { type: Type.STRING },
                products: { type: Type.STRING },
                services: { type: Type.ARRAY, items: { type: Type.STRING } },
                socialHandles: { type: Type.ARRAY, items: { type: Type.STRING } },
                colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                vibe: { type: Type.STRING },
                visualStyle: { type: Type.STRING },
                competitors: { type: Type.ARRAY, items: { type: Type.STRING } },
                strategy: { type: Type.STRING },
                essence: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
             },
             required: ["name", "industry", "products", "services", "colors", "vibe", "visualStyle", "competitors", "strategy"]
          },
        },
      });
  
      const text = response.text;
      if (!text) return currentProfile;
      return JSON.parse(text) as BrandProfile;
    } catch (e) {
      console.error("Merge failed", e);
      return currentProfile;
    }
};

/**
 * Generates text content and visual prompts for social media posts based on the brand profile.
 */
export const generateContentIdeas = async (profile: BrandProfile, count: number = 5, customInstruction?: string): Promise<SocialPost[]> => {
  const modelId = "gemini-2.5-flash";

  let specificInstruction = "";
  if (customInstruction) {
      specificInstruction = `USER OVERRIDE: The user specifically wants this: "${customInstruction}". IGNORE generic strategy and focus entirely on this request.`;
  }

  const prompt = `
    You are a specialised Social Media Manager for ${profile.name}.
    
    BRAND CONTEXT:
    - Industry: ${profile.industry}
    - What we sell (Summary): ${profile.products}
    - Specific Offerings: ${profile.services.join(', ')}
    - Tone: ${profile.vibe}
    - Strategy: ${profile.strategy}
    
    ${specificInstruction}

    Task: Create ${count} distinct, high-quality social media posts.
    
    CRITICAL INSTRUCTION:
    Each post MUST focus on one specific offering from the 'Specific Offerings' list above. Do not be generic.
    
    PLATFORM RULES (STRICTLY FOLLOW):
    1. **LinkedIn**: Content MUST be long-form (100-200 words). Professional tone. Focus on industry insights.
    2. **Instagram/TikTok**: Content MUST be visual-first. Short, punchy captions (under 30 words).
    3. **Twitter/X**: Short, provocative, or news-centric.
    
    VISUAL PROMPT RULES:
    - The 'visualPrompt' must explicitly describe an image that fits the brand's Visual Style: "${profile.visualStyle}".
    - You MUST explicitly instruct to use the brand colours: ${profile.colors.join(', ')}.
    - The image MUST depict the specific service/product being discussed.

    Return a JSON array of posts.
  `;

  try {
    const response = await getTextClient().models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              platform: { type: Type.STRING, enum: ["Instagram", "LinkedIn", "Twitter/X", "TikTok"] },
              caption: { type: Type.STRING },
              hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
              visualPrompt: { type: Type.STRING },
            },
            required: ["platform", "caption", "hashtags", "visualPrompt"],
          },
        },
      },
    });

    const rawPosts = JSON.parse(response.text || "[]");
    
    // Enrich with IDs and status
    return rawPosts.map((post: any) => ({
      ...post,
      id: Math.random().toString(36).substring(7),
      status: 'pending',
    }));

  } catch (error) {
    console.error("Content generation failed:", error);
    return [];
  }
};

/**
 * Generates an image for a specific post using Imagen 3 model.
 */
export const generatePostImage = async (visualPrompt: string, profile: BrandProfile, aspectRatio: string = "1:1"): Promise<string | undefined> => {
  // Construct a prompt that enforces brand identity
  const finalPrompt = `
    High-quality social media photograph.
    
    Subject/Action: ${visualPrompt}
    
    Style: ${profile.visualStyle}.
    Colour theme: ${profile.colors.slice(0, 3).join(', ')}.
    Brand essence: Professional ${profile.industry} imagery for "${profile.name}".
    
    Requirements: No text, no logos, photorealistic, high resolution.
  `;

  try {
    // Try Imagen 3 model for image generation (uses separate API key)
    const response = await getImageClient().models.generateImages({
      model: "imagen-3.0-generate-001",
      prompt: finalPrompt,
      config: {
        numberOfImages: 1,
        aspectRatio: aspectRatio === "9:16" ? "9:16" : aspectRatio === "16:9" ? "16:9" : "1:1",
      },
    });

    // Get the first generated image
    if (response.generatedImages && response.generatedImages.length > 0) {
      const imageData = response.generatedImages[0].image?.imageBytes;
      if (imageData) {
        return `data:image/png;base64,${imageData}`;
      }
    }
    
    // Fallback to placeholder images
    console.log("No image data returned, using placeholder fallback");
    return getPlaceholderImage(visualPrompt);
  } catch (error) {
    console.error("Image generation failed:", error);
    return getPlaceholderImage(visualPrompt);
  }
};

/**
 * Get a placeholder image using Lorem Picsum (reliable service)
 */
const getPlaceholderImage = (seed: string = ''): string => {
  // Lorem Picsum provides reliable placeholder images
  const id = seed ? seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 1000 : Math.floor(Math.random() * 1000);
  return `https://picsum.photos/seed/${id}/800/800`;
};

export const refinePost = async (currentPost: SocialPost, instruction: string): Promise<SocialPost> => {
  const modelId = "gemini-2.5-flash";

  const prompt = `
    I have a social media post:
    Platform: ${currentPost.platform}
    Caption: "${currentPost.caption}"
    Hashtags: ${currentPost.hashtags.join(", ")}
    
    Please modify it based on this instruction: "${instruction}".
    Keep the platform best practices in mind.
    Return the updated caption and hashtags in JSON format.
  `;

  try {
    const response = await getTextClient().models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            caption: { type: Type.STRING },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    return {
      ...currentPost,
      caption: result.caption || currentPost.caption,
      hashtags: result.hashtags || currentPost.hashtags,
    };
  } catch (error) {
    console.error("Refine failed", error);
    return currentPost;
  }
};

export const autoSchedulePosts = async (posts: SocialPost[], strategy: string): Promise<Record<string, string>> => {
  const modelId = "gemini-2.5-flash";
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1); 

  const postsCompact = posts.map(p => ({
    id: p.id,
    platform: p.platform,
    caption: p.caption.substring(0, 50) + "..."
  }));

  const prompt = `
    I need to schedule the following social media posts for a brand with strategy: "${strategy}".
    Posts: ${JSON.stringify(postsCompact)}
    
    Start scheduling from ${startDate.toISOString()}.
    Spread them out over the next 14 days.
    
    Return a JSON object where keys are post IDs and values are the ISO date strings.
  `;

  try {
    const response = await getTextClient().models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          description: "Map of post IDs to ISO date strings",
          properties: {}, 
        }
      },
    });

    const result = JSON.parse(response.text || "{}");
    return result;
  } catch (error) {
    console.error("Scheduling failed", error);
    const fallback: Record<string, string> = {};
    posts.forEach((p, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      d.setHours(10, 0, 0, 0);
      fallback[p.id] = d.toISOString();
    });
    return fallback;
  }
};

/**
 * Sanitises a prompt to remove people-related terms that trigger VEO's safety filters.
 * VEO with personGeneration: "dont_allow" still rejects prompts that mention people.
 */
const sanitisePromptForVideo = (prompt: string): string => {
  // Common people-related terms that trigger RAI filters
  const peopleTerms = [
    /\b(person|people|man|woman|men|women|human|humans|face|faces|portrait|portraits)\b/gi,
    /\b(traveller|travellers|traveler|travelers|passenger|passengers|customer|customers)\b/gi,
    /\b(family|families|couple|couples|child|children|kid|kids|adult|adults)\b/gi,
    /\b(tourist|tourists|visitor|visitors|guest|guests|user|users)\b/gi,
    /\b(employee|employees|staff|worker|workers|driver|drivers)\b/gi,
    /\b(businessman|businesswoman|businesspeople|professional|professionals)\b/gi,
  ];
  
  let sanitised = prompt;
  peopleTerms.forEach(regex => {
    sanitised = sanitised.replace(regex, '');
  });
  
  // Clean up multiple spaces and trim
  return sanitised.replace(/\s+/g, ' ').trim();
};

/**
 * Generates a short video for social media using VEO 2.0.
 * Supports two modes:
 * 1. IMAGE-TO-VIDEO: Animates a source image (recommended for consistent results)
 * 2. TEXT-TO-VIDEO: Creates video from text prompt only (fallback)
 * 
 * Perfect for TikTok, Instagram Reels, YouTube Shorts.
 * 
 * @param visualPrompt - Text description for motion/animation
 * @param profile - Brand profile for styling
 * @param duration - Video duration (5s or 10s)
 * @param sourceImage - Optional base64 image to animate (data:image/... format)
 */
export const generatePostVideo = async (
  visualPrompt: string, 
  profile: BrandProfile, 
  duration: "5s" | "10s" = "5s",
  sourceImage?: string
): Promise<{ videoUrl?: string; status: 'success' | 'pending' | 'failed'; operationName?: string; failureReason?: string }> => {
  
  // Sanitise the prompt to avoid RAI filters for people/faces
  const sanitisedPrompt = sanitisePromptForVideo(visualPrompt);
  
  // For IMAGE-TO-VIDEO: Prompt should ONLY describe motion/animation
  // Do NOT re-describe the image content - the image provides the visuals
  // Keep it short and focused on movement
  const imageToVideoPrompt = `${sanitisedPrompt}. Smooth cinematic motion. Keep faithful to source image.`;

  // Check if we're running on Netlify (production) - use serverless function for CORS-free API calls
  const isNetlify = typeof window !== 'undefined' && window.location.hostname !== 'localhost';
  
  // Helper: Try Netlify serverless function for image-to-video (CORS-free!)
  const tryNetlifyFunction = async (imageBase64: string | undefined, mimeType: string | undefined) => {
    console.log("🌐 Using Netlify serverless function for video generation...");
    
    const response = await fetch('/.netlify/functions/generate-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        mimeType,
        motionPrompt: imageToVideoPrompt,
        duration,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Netlify function error: ${response.status}`);
    }
    
    return await response.json();
  };
  
  // For text-to-video (fallback), be more descriptive
  const textToVideoPrompt = `
    Create a short ${duration} social media video.
    
    Scene: ${sanitisedPrompt}
    
    Style: ${profile.visualStyle}
    Brand: ${profile.name} - ${profile.industry}
    Colour palette: ${profile.colors.slice(0, 3).join(', ')}
    
    CRITICAL REQUIREMENTS:
    - NO people, NO faces, NO human figures whatsoever
    - Focus on products, objects, scenery, or abstract visuals only
    - Professional, high-quality footage
    - Smooth camera movement (slow pan, gentle zoom, or parallax effect)
    - No text overlays
    - Suitable for TikTok/Instagram Reels
  `;

  // Helper: Convert URL image to base64
  const urlToBase64 = async (url: string): Promise<{ base64: string; mimeType: string } | null> => {
    try {
      console.log("🔄 Converting URL image to base64...", url.substring(0, 50));
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
      const blob = await response.blob();
      const mimeType = blob.type || 'image/jpeg';
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          // Extract just the base64 part
          const base64 = dataUrl.split(',')[1];
          console.log(`✅ Converted to base64: ${mimeType}, ${Math.round(base64.length / 1024)}KB`);
          resolve({ base64, mimeType });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("❌ Failed to convert URL to base64:", error);
      return null;
    }
  };

  // Helper function to attempt video generation with a specific client
  const tryGenerateVideo = async (clientGetter: () => GoogleGenAI, useImageToVideo: boolean = true) => {
    const client = clientGetter();
    const apiKey = process.env.VEO_API_KEY || process.env.API_KEY;
    
    // If we have a source image AND image-to-video is enabled, use IMAGE-TO-VIDEO mode
    // Handle both data:image URLs and regular URLs
    let imageBase64: string | undefined;
    let mimeType: string = 'image/png';
    
    if (useImageToVideo && sourceImage) {
      if (sourceImage.startsWith('data:image/')) {
        // Already base64
        const matches = sourceImage.match(/^data:(image\/\w+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          imageBase64 = matches[2];
          console.log(`📷 Using base64 image: ${mimeType}, ${Math.round(imageBase64.length / 1024)}KB`);
        }
      } else if (sourceImage.startsWith('http')) {
        // URL - convert to base64
        const converted = await urlToBase64(sourceImage);
        if (converted) {
          imageBase64 = converted.base64;
          mimeType = converted.mimeType;
        }
      }
    }
    
    if (useImageToVideo && imageBase64) {
      console.log("🎬 IMAGE-TO-VIDEO mode - animating source image...");
      console.log("📝 Motion prompt:", imageToVideoPrompt);
      
      // VEO 2.0 image-to-video - using the correct API structure
      // Based on Google Cloud Vertex AI documentation
      const requestBody = {
        instances: [{
          prompt: imageToVideoPrompt,
          image: {
            bytesBase64Encoded: imageBase64,
          },
        }],
        parameters: {
          aspectRatio: "9:16",
          sampleCount: 1,
          durationSeconds: duration === "5s" ? 5 : 10,
          personGeneration: "dont_allow",
        },
      };
      
      console.log("📤 Attempting image-to-video via SDK...");
      
      // Try using the SDK's generateVideos with image parameter
      // Note: If SDK doesn't support image, we fall back to text-to-video with the user's motion prompt
      try {
        const response = await client.models.generateVideos({
          model: "veo-2.0-generate-001",
          prompt: imageToVideoPrompt,
          // @ts-ignore - SDK may support image in newer versions
          image: {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType,
            },
          },
          config: {
            aspectRatio: "9:16",
            numberOfVideos: 1,
            durationSeconds: duration === "5s" ? 5 : 10,
            personGeneration: "dont_allow",
          },
        });
        console.log("✅ Image-to-video request accepted via SDK:", response);
        return response as any;
      } catch (sdkError: any) {
        console.warn("⚠️ SDK image-to-video failed, falling back to text-to-video with motion prompt...", sdkError.message);
        
        // Fall back to text-to-video but use the user's motion prompt
        // This is better than the old behaviour of using a generic prompt
        console.log("🔄 Using text-to-video with user's motion prompt:", imageToVideoPrompt);
        const response = await client.models.generateVideos({
          model: "veo-2.0-generate-001",
          prompt: imageToVideoPrompt,
          config: {
            aspectRatio: "9:16",
            numberOfVideos: 1,
            durationSeconds: duration === "5s" ? 5 : 10,
            personGeneration: "dont_allow",
          },
        });
        return response as any;
      }
    }
    
    // TEXT-TO-VIDEO mode (no source image, or image-to-video disabled)
    console.log("📝 TEXT-TO-VIDEO mode (no source image)...");
    console.log("📝 Text prompt:", textToVideoPrompt.substring(0, 200) + "...");
    
    const response = await client.models.generateVideos({
      model: "veo-2.0-generate-001",
      prompt: textToVideoPrompt,
      config: {
        aspectRatio: "9:16",
        numberOfVideos: 1,
        durationSeconds: duration === "5s" ? 5 : 10,
        personGeneration: "dont_allow",
      },
    });
    return response as any;
  };

  try {
    const mode = sourceImage ? 'IMAGE-TO-VIDEO' : 'TEXT-TO-VIDEO';
    console.log(`🎬 Starting VEO 2.0 video generation (${mode})...`);
    
    let result;
    
    // In production (Netlify), use serverless function for CORS-free API calls
    if (isNetlify && sourceImage) {
      console.log("🌐 Production detected - using Netlify serverless function...");
      
      // Convert source image to base64 if needed
      let imageBase64: string | undefined;
      let mimeType: string = 'image/png';
      
      if (sourceImage.startsWith('data:image/')) {
        const matches = sourceImage.match(/^data:(image\/\w+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          imageBase64 = matches[2];
        }
      } else if (sourceImage.startsWith('http')) {
        const converted = await urlToBase64(sourceImage);
        if (converted) {
          imageBase64 = converted.base64;
          mimeType = converted.mimeType;
        }
      }
      
      try {
        result = await tryNetlifyFunction(imageBase64, mimeType);
      } catch (netlifyError: any) {
        console.warn("⚠️ Netlify function failed:", netlifyError.message);
        // Fall back to SDK
        result = await tryGenerateVideo(getVideoClient, true);
      }
    } else {
      // Development or no source image - use SDK directly
      try {
        result = await tryGenerateVideo(getVideoClient, true);
      } catch (primaryError: any) {
        console.warn("⚠️ Primary VEO key failed:", primaryError.message);
        
        // Try backup key
        try {
          console.log("🔄 Trying backup VEO key...");
          result = await tryGenerateVideo(getVideoBackupClient, true);
        } catch (backupError: any) {
          console.error("❌ Backup key also failed:", backupError.message);
          
          // Return detailed failure reason
          return { 
            status: 'failed', 
            failureReason: `Image-to-video generation failed. VEO may not support this image format or the API structure has changed. Error: ${backupError.message}` 
          };
        }
      }
    }
    
    if (result.name) {
      console.log("Video generation started, operation:", result.name);
      return {
        status: 'pending',
        operationName: result.name,
      };
    }

    // If video is ready immediately (unlikely for VEO)
    if (result.generatedVideos && result.generatedVideos.length > 0) {
      const videoData = result.generatedVideos[0]?.video?.uri;
      if (videoData) {
        return {
          status: 'success',
          videoUrl: videoData,
        };
      }
    }

    return { status: 'failed', failureReason: 'No video generated' };
  } catch (error: any) {
    console.error("Video generation failed with both keys:", error);
    return { status: 'failed', failureReason: error.message || 'Video generation failed' };
  }
};

/**
 * Check the status of a video generation operation.
 * VEO video generation is async - call this to poll for completion.
 * Uses direct API call since the SDK's operations API has issues.
 */
export const checkVideoStatus = async (operationName: string): Promise<{
  status: 'pending' | 'success' | 'failed';
  videoUrl?: string;
  failureReason?: string;
}> => {
  const apiKey = process.env.VEO_API_KEY || process.env.API_KEY;
  
  try {
    // Use direct API call to check operation status
    // The operationName is like "models/veo-2.0-generate-001/operations/xxxxx"
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`,
      { method: 'GET' }
    );
    
    if (!response.ok) {
      console.error("Video status check failed:", response.status, response.statusText);
      // If 404, operation might have expired or doesn't exist
      if (response.status === 404) {
        return { status: 'failed' };
      }
      // For other errors, assume still pending (might be transient)
      return { status: 'pending' };
    }
    
    const result = await response.json();
    console.log("Video operation status:", result);
    
    if (result.done) {
      // Check for video in response - VEO uses different response structures
      // Try the new structure first (generateVideoResponse.generatedSamples)
      let videoUri = result.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      
      // Fallback to alternative structures
      if (!videoUri) {
        videoUri = result.response?.generatedVideos?.[0]?.video?.uri;
      }
      
      if (videoUri) {
        // Append API key to video URL for browser access
        // VEO video URLs require authentication
        const authenticatedUrl = videoUri.includes('?') 
          ? `${videoUri}&key=${apiKey}` 
          : `${videoUri}?key=${apiKey}`;
        
        console.log("Video ready:", authenticatedUrl);
        return { status: 'success', videoUrl: authenticatedUrl };
      }
      
      // Check for error in result
      if (result.error) {
        console.error("VEO returned error:", result.error);
        return { 
          status: 'failed', 
          failureReason: result.error.message || 'Video generation failed' 
        };
      }
      
      // Check for RAI content filter rejection (common failure mode)
      const generateVideoResponse = result.response?.generateVideoResponse;
      if (generateVideoResponse?.raiMediaFilteredCount > 0) {
        const reasons = generateVideoResponse.raiMediaFilteredReasons || [];
        const reason = reasons[0] || 'Content was filtered by safety settings';
        console.error("Video filtered by RAI:", reason);
        return { 
          status: 'failed', 
          failureReason: 'Video content was filtered by safety settings. Try a prompt without people or faces.'
        };
      }
      
      // Check if response exists and log its full structure
      if (result.response) {
        console.log("VEO response structure:", JSON.stringify(result.response, null, 2));
      }
      
      // If done but no video, it failed (likely content moderation or quota)
      console.error("Video operation done but no video - possible content rejection");
      return { 
        status: 'failed',
        failureReason: 'Video generation completed but no video was produced. The content may have been filtered.'
      };
    }
    
    // Still processing
    return { status: 'pending' };
  } catch (error) {
    console.error("Failed to check video status:", error);
    // On network errors, assume still pending (will retry)
    return { status: 'pending' };
  }
};

/**
 * Fetches a video URL and converts it to a blob URL for browser playback.
 * This bypasses CORS restrictions that prevent direct video playback.
 * 
 * @param videoUrl - The authenticated VEO video URL
 * @returns A blob URL that can be used in a <video> element, or undefined on failure
 */
export const fetchVideoAsBlob = async (videoUrl: string): Promise<string | undefined> => {
  try {
    console.log("Fetching video as blob to bypass CORS...");
    
    const response = await fetch(videoUrl, {
      method: 'GET',
      mode: 'cors',
    });
    
    if (!response.ok) {
      console.error("Failed to fetch video:", response.status, response.statusText);
      return undefined;
    }
    
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    console.log("Video blob URL created:", blobUrl);
    return blobUrl;
  } catch (error) {
    console.error("Failed to fetch video as blob:", error);
    return undefined;
  }
};

/**
 * Revokes a blob URL to free up memory.
 * Call this when the video player is closed.
 */
export const revokeBlobUrl = (blobUrl: string): void => {
  if (blobUrl.startsWith('blob:')) {
    URL.revokeObjectURL(blobUrl);
    console.log("Blob URL revoked:", blobUrl);
  }
};
