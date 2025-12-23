import { GoogleGenAI, Type, Schema } from "@google/genai";
import { BrandProfile, SocialPost } from "../types";
import { searchPexelsImage, isPexelsConfigured } from "./pexelsService";
import { getLogoUrlSync, extractDomain } from "./logoService";
import { queueGeminiRequest, queueImagenRequest, queueVeoRequest, rateLimiter } from "./rateLimiterService";

/**
 * Check if API keys are configured
 */
const API_KEY = process.env.API_KEY || '';
const IMAGEN_API_KEY = process.env.IMAGEN_API_KEY || API_KEY;
const VEO_API_KEY = process.env.VEO_API_KEY || API_KEY;
const VEO_API_KEY_2 = process.env.VEO_API_KEY_2 || VEO_API_KEY;

// Debug: Log API key status (first 10 chars only for security)
console.log('🔑 API Key Debug:', {
  hasKey: !!API_KEY,
  keyPrefix: API_KEY ? API_KEY.substring(0, 10) + '...' : 'EMPTY',
  keyLength: API_KEY.length,
});

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

/**
 * Normalise and safeguard brand profile fields so downstream generation never
 * ends up with empty offerings/strategy (which causes irrelevant outputs or placeholder fallbacks).
 */
const normaliseStringArray = (arr: any): string[] => {
  if (!Array.isArray(arr)) return [];
  return arr.map(s => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
};

const buildFallbackOfferings = (profile: BrandProfile): string[] => {
  const haystack = `${profile.name} ${profile.industry} ${profile.products} ${profile.essence || ''}`.toLowerCase();

  // Athletic / footwear / apparel (covers Nike-like brands)
  if (
    haystack.includes('nike') ||
    haystack.includes('footwear') ||
    haystack.includes('shoe') ||
    haystack.includes('trainer') ||
    haystack.includes('sportswear') ||
    haystack.includes('athletic') ||
    haystack.includes('running') ||
    haystack.includes('fitness') ||
    haystack.includes('apparel')
  ) {
    return [
      'Running shoes',
      'Training shoes',
      'Basketball shoes',
      'Football boots',
      'Lifestyle trainers',
      'Performance running tops',
      'Training tops',
      'Sports bras',
      'Performance leggings',
      'Running shorts',
      'Track jackets',
      'Gym bags & accessories',
    ];
  }

  // Default (generic but still useful; prevents empty prompts)
  return [
    'Core product range',
    'Signature collection',
    'Seasonal collection',
    'Best-selling items',
    'Limited edition drops',
    'Bundles & multi-buy offers',
    'Gift cards',
    'Online exclusives',
    'Customer favourites',
    'New arrivals',
  ];
};

const buildFallbackStrategy = (profile: BrandProfile): string => {
  const name = profile.name || 'this brand';
  const industry = profile.industry || 'your industry';
  const vibe = profile.vibe || 'confident and clear';

  return [
    `Target audience: people actively searching for trustworthy ${industry} options, plus existing customers who already like ${name}.`,
    `Positioning: highlight what makes ${name} different and why it matters (quality, performance, value, or community).`,
    `Content tone: ${vibe}. Use short, benefit-led messaging paired with product-first visuals.`,
    `Channels: prioritise Instagram and TikTok for discovery, and LinkedIn for credibility and storytelling when relevant.`,
    `Cadence: rotate product spotlights, social proof, and education so the feed stays varied whilst staying on-brand.`,
  ].join(' ');
};

const normaliseBrandProfile = (profile: BrandProfile): BrandProfile => {
  const services = normaliseStringArray((profile as any).services);
  const colors = normaliseStringArray((profile as any).colors);

  const safeColors =
    colors.length >= 2
      ? colors
      : ['#111827', '#6366f1', '#a855f7']; // dark + indigo + purple defaults

  const safeServices = services.length >= 3 ? services : buildFallbackOfferings(profile);
  const safeStrategy =
    typeof profile.strategy === 'string' && profile.strategy.trim().length >= 80
      ? profile.strategy.trim()
      : buildFallbackStrategy(profile);

  return {
    ...profile,
    colors: safeColors,
    services: safeServices,
    strategy: safeStrategy,
    essence: (profile.essence || '').trim() || profile.name,
    logoUrl: profile.logoUrl,
    // imageAssets removed - all images now generated fresh by Imagen
  };
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
 * Helper: Perform research using Google Search tool (Step 1), then extract JSON (Step 2).
 * This splits the process to avoid "Tool use with response mime type application/json is unsupported" error.
 */
const researchAndExtract = async <T>(
  prompt: string,
  schema: Schema,
  modelId: string = "gemini-2.5-flash"
): Promise<T> => {
  // Step 1: Research (Tool use, returns text)
  console.log("🔍 Step 1: Researching...");
  const researchResponse = await getTextClient().models.generateContent({
    model: modelId,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "text/plain", // Explicitly request text for tool use
    },
  });

  const researchText = researchResponse.text;
  if (!researchText) throw new Error("No research data returned from AI");

  // Step 2: Extract JSON (No tools, returns JSON)
  console.log("📊 Step 2: Extracting JSON...");
  const extractPrompt = `
    Based on the following research data, extract the required information in JSON format.
    
    RESEARCH DATA:
    ${researchText}
    
    CRITICAL: Return ONLY valid JSON matching the schema.
  `;

  const extractResponse = await getTextClient().models.generateContent({
    model: modelId,
    contents: extractPrompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  const jsonText = extractResponse.text;
  if (!jsonText) throw new Error("No JSON returned from extraction step");

  return JSON.parse(jsonText) as T;
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
 * Helper function to enrich incomplete brand profiles with targeted queries
 */
const enrichBrandProfile = async (
  baseProfile: BrandProfile, 
  url: string, 
  issues: string[]
): Promise<BrandProfile> => {
  console.log("🔄 Enriching incomplete profile...", issues);
  
  // Build targeted enrichment query
  let enrichmentQuery = `I need more detailed information about ${baseProfile.name} (${url}).\n\n`;
  
  if (issues.some(i => i.includes('services'))) {
    enrichmentQuery += `
      CRITICAL: Find their SPECIFIC product/service names.
      Search for:
      - Product catalog pages
      - Service listing pages
      - Menu/navigation items
      - "What we offer" sections
      
      Return 15-20 SPECIFIC items they sell/offer.
      NOT categories, NOT generic descriptions.
      ACTUAL product names or service packages.
      
      Examples of GOOD data:
      - Nike: "Air Max 270", "Jordan 1 High", "Dri-FIT Running Shorts"
      - Restaurant: "Margherita Pizza", "Caesar Salad", "Tiramisu"
      - Travel: "Gatwick Airport Parking", "Heathrow Executive Lounge"
    `;
  }
  
  if (issues.some(i => i.includes('strategy'))) {
    enrichmentQuery += `
      CRITICAL: Analyze their marketing approach.
      Look for:
      - Target audience indicators (age, demographics on site)
      - Brand messaging and tone
      - Competitor positioning
      - Social media presence and style
      - Unique selling propositions
      
      Write a detailed 3-5 sentence marketing strategy covering:
      1. WHO (target audience)
      2. WHAT (differentiators)
      3. HOW (content approach)
      4. WHERE (channels)
      5. WHY (value proposition)
    `;
  }
  
  const enrichmentPrompt = `
    ${enrichmentQuery}
    
    Current incomplete data:
    Services: ${baseProfile.services?.join(', ') || 'EMPTY - NEEDS 10+ SPECIFIC ITEMS'}
    Strategy: ${baseProfile.strategy || 'EMPTY - NEEDS 100+ CHAR PARAGRAPH'}
    
    Goal: Return a complete brand profile with the missing data filled in.
  `;
  
  const enrichedSchema: Schema = {
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
      logoUrl: { type: Type.STRING },
    },
    required: ["services", "strategy"],
  };
  
  try {
    const enriched = await researchAndExtract<BrandProfile>(enrichmentPrompt, enrichedSchema);
    
    console.log("✅ Enrichment complete:", {
      servicesCount: enriched.services?.length || 0,
      strategyLength: enriched.strategy?.length || 0,
    });
    
    // Merge with base profile, preferring enriched data if better
    return {
      ...baseProfile,
      services: enriched.services && enriched.services.length >= 10 
        ? enriched.services 
        : baseProfile.services,
      strategy: enriched.strategy && enriched.strategy.length >= 100
        ? enriched.strategy
        : baseProfile.strategy,
    };
  } catch (error) {
    console.error("❌ Enrichment failed, returning base profile:", error);
    return baseProfile;
  }
};

/**
 * Analyzes the provided website URL with enhanced validation and enrichment.
 * Uses combined research + extraction approach with quality gates.
 */
export const analyzeBrand = async (url: string): Promise<BrandProfile> => {
  console.log("🔍 Analyzing brand with enhanced validation...");
  
  // Enhanced schema with strict requirements
  const enhancedSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      industry: { type: Type.STRING },
      products: { type: Type.STRING, description: "2-3 sentence overview of what they sell" },
      services: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        // minItems: 10, // Not supported in all Schema versions, handled in prompt
        description: "Array of 10-20 SPECIFIC product/service names (NOT generic categories)"
      },
      socialHandles: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Social media URLs/handles" },
      colors: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Brand hex color codes" },
      vibe: { type: Type.STRING, description: "Brand voice/personality" },
      visualStyle: { type: Type.STRING, description: "Art direction for image generation" },
      competitors: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 real competitors" },
      strategy: { 
        type: Type.STRING,
        // minLength: 100, // Not supported in all Schema versions
        description: "Detailed 3-5 sentence marketing strategy (minimum 100 characters)"
      },
      essence: { type: Type.STRING, description: "One sentence summary of what this business does" },
      confidence: { type: Type.NUMBER, description: "Confidence score 0-100 on data quality" },
      logoUrl: { type: Type.STRING, description: "URL to the official company logo (transparent PNG preferred)" }
      // NOTE: imageAssets removed - AI cannot reliably find real image URLs on websites
      // All images are now generated fresh by Imagen based on content topics
    },
    required: ["name", "industry", "products", "services", "socialHandles", "colors", "vibe", "visualStyle", "competitors", "strategy", "essence", "confidence"],
  };

  // Combined research + extraction prompt
  const combinedPrompt = `
    Research and analyze the business at: ${url}
    
    Use Google Search to find comprehensive information about this business.
    
    CRITICAL DATA REQUIREMENTS:
    
    1. LOGO URL:
       - Find the official company logo URL.
       - Prefer transparent PNG or SVG if available.
       - Look for: 'link[rel="icon"]', 'meta[property="og:image"]', or scrape the logo from the homepage.
    
    2. SERVICES/PRODUCTS (MINIMUM 10 ITEMS - THIS IS MANDATORY):
       - Find SPECIFIC product names, service offerings, or packages
       - DO NOT use generic categories like "footwear", "services", "products"
       - BE SPECIFIC: exact names, model numbers, package titles
       
       Examples by industry:
       - Retail/Fashion: "Air Max 270", "Jordan 1 High", "Dri-FIT Running Shorts"
       - Food/Restaurant: "Margherita Pizza", "Caesar Salad", "Tiramisu"
       - Travel: "Gatwick Airport Parking", "Heathrow Lounge Access", "Hotel + Parking Package"
       - Services: "SEO Audit Package", "Full Website Redesign", "Monthly Maintenance Plan"
       - SaaS: "Starter Plan", "Business Plan", "Enterprise Plan"
       
       Search strategies:
       - Check navigation menu items
       - Look for product/service catalog pages
       - Find pricing pages
       - Check "What we offer" sections
       
       If you find fewer than 10, search more specifically:
       - "${url} products"
       - "${url} services offered"
       - "${url} what do they sell"
    
    4. MARKETING STRATEGY (MINIMUM 100 CHARACTERS - BE DETAILED):
       Must be a substantive paragraph (3-5 sentences) covering:
       
       - WHO: Target audience (demographics, psychographics)
       - WHAT: Key differentiators from competitors
       - HOW: Content positioning and tone
       - WHERE: Primary channels and platforms
       - WHY: Value proposition and unique benefits
       
       Example for Nike:
       "Target audience: Athletes and fitness enthusiasts aged 18-45 who value performance 
       and style. Differentiation through innovation (Air technology) and athlete 
       endorsements. Content should be motivational and aspirational, showcasing real 
       athletes and everyday fitness journeys. Focus on Instagram and TikTok for younger 
       demographics, emphasizing Just Do It messaging and community building."
    
    5. VALIDATION BEFORE RETURNING:
       - Count services: must have ≥10 items
       - Check specificity: no generic words like "products", "services"
       - Strategy length: must be ≥100 characters
       - Strategy substance: must cover audience + differentiators + approach
    
    Return complete brand profile as JSON.
  `;

  try {
    const profileData = await researchAndExtract<BrandProfile>(combinedPrompt, enhancedSchema);
    
    const profile = normaliseBrandProfile(profileData);
    
    // Use reliable logo service instead of AI-extracted logoUrl
    const reliableLogoUrl = getLogoUrlSync(url);
    if (reliableLogoUrl) {
      profile.logoUrl = reliableLogoUrl;
      console.log("🖼️ Logo URL set from logo service:", reliableLogoUrl);
    }
    
    console.log("📊 Initial profile quality:", {
      name: profile.name,
      servicesCount: profile.services?.length || 0,
      strategyLength: profile.strategy?.length || 0,
      confidence: profile.confidence,
    });
    
    // Enhanced validation with specific quality gates
    const validationErrors: string[] = [];
    
    // Check 1: Sufficient services count
    if (!profile.services || profile.services.length < 10) {
      validationErrors.push(`Insufficient services data (${profile.services?.length || 0}/10 minimum)`);
    }
    
    // Check 2: Services are specific, not generic
    const genericTerms = ['product', 'service', 'offering', 'solution', 'item'];
    const hasGenericServices = profile.services?.some(s => {
      const lower = s.toLowerCase();
      return genericTerms.some(term => lower === term || lower === `${term}s`);
    });
    if (hasGenericServices) {
      validationErrors.push("Services contain generic categories instead of specific names");
    }
    
    // Check 3: Strategy is detailed enough
    if (!profile.strategy || profile.strategy.length < 100) {
      validationErrors.push(`Strategy too brief (${profile.strategy?.length || 0}/100 chars minimum)`);
    }
    
    // Check 4: Strategy has substance (not just generic filler)
    const hasSubstance = profile.strategy && (
      profile.strategy.toLowerCase().includes('target') ||
      profile.strategy.toLowerCase().includes('audience') ||
      profile.strategy.toLowerCase().includes('customer')
    );
    if (!hasSubstance) {
      validationErrors.push("Strategy lacks target audience definition");
    }
    
    // Check 5: Confidence threshold
    if (profile.confidence && profile.confidence < 20) {
      validationErrors.push("Low confidence score indicates insufficient data");
    }
    
    // If validation fails, attempt enrichment
    if (validationErrors.length > 0) {
      console.warn("⚠️ Initial analysis incomplete:", validationErrors);
      console.log("🔄 Attempting targeted enrichment...");
      
      const enrichedProfile = normaliseBrandProfile(await enrichBrandProfile(profile, url, validationErrors));
      
      // Ensure logo URL is set from reliable source
      if (!enrichedProfile.logoUrl || enrichedProfile.logoUrl.includes('undefined')) {
        enrichedProfile.logoUrl = getLogoUrlSync(url);
      }
      
      // Validate enriched profile
      const finalErrors: string[] = [];
      if (!enrichedProfile.services || enrichedProfile.services.length < 10) {
        finalErrors.push("Still insufficient services after enrichment");
      }
      if (!enrichedProfile.strategy || enrichedProfile.strategy.length < 100) {
        finalErrors.push("Strategy still too brief after enrichment");
      }
      
      if (finalErrors.length > 0) {
        console.error("❌ Enrichment failed to meet requirements:", finalErrors);
        console.log("Returning best-effort profile with warnings");
      } else {
        console.log("✅ Enrichment successful - profile now complete");
      }
      
      return enrichedProfile;
    }
    
    console.log("✅ Initial analysis passed all validation");
    return profile;

  } catch (error: any) {
    console.error("Brand analysis failed:", error);
    throw new Error(
      error.message || "Could not analyze website. Please ensure the URL is correct and the website is active."
    );
  }
};

/**
 * Analyzes an additional URL and merges it into the existing profile.
 */
export const mergeSourceUrl = async (currentProfile: BrandProfile, newUrl: string): Promise<BrandProfile> => {
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
  
    const schema: Schema = {
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
        logoUrl: { type: Type.STRING },
      },
      required: ["name", "industry", "products", "services", "colors", "vibe", "visualStyle", "competitors", "strategy"]
    };

    try {
      const enriched = await researchAndExtract<BrandProfile>(prompt, schema);
      return enriched;
    } catch (e) {
      console.error("Merge failed", e);
      return currentProfile;
    }
};

/**
 * Validates a visual prompt to ensure it meets brand requirements
 */
const validateVisualPrompt = (
  prompt: string, 
  profile: BrandProfile
): { valid: boolean; issues: string[]; details: { hasProduct: boolean; hasColors: boolean; hasComposition: boolean; wordCount: number } } => {
  const issues: string[] = [];
  const lower = prompt.toLowerCase();
  
  // Check 1: Does it mention a specific product from the services list?
  const hasProduct = profile.services.some(service => 
    lower.includes(service.toLowerCase())
  );
  if (!hasProduct) {
    issues.push("No specific product mentioned from offerings list");
  }
  
  // Check 2: Does it reference brand colors?
  const hasColors = profile.colors.some(color => 
    lower.includes(color.toLowerCase())
  );
  if (!hasColors) {
    issues.push("Brand colors not referenced");
  }
  
  // Check 3: Composition type specified?
  const compositionTypes = [
    'close-up', 'close up', 'wide angle', 'overhead', 'flat lay', 
    'dynamic', 'action shot', 'product shot', 'lifestyle shot'
  ];
  const hasComposition = compositionTypes.some(type => 
    lower.includes(type)
  );
  if (!hasComposition) {
    issues.push("No composition type specified");
  }
  
  // Check 4: Minimum length (should be detailed, 30-60 words)
  const wordCount = prompt.split(/\s+/).length;
  if (wordCount < 30) {
    issues.push(`Visual prompt too short (${wordCount}/30 words minimum)`);
  }
  
  // Check 5: Brand style mentioned?
  const hasBrandStyle = lower.includes(profile.visualStyle.toLowerCase().split(' ')[0]) ||
                        lower.includes(profile.industry.toLowerCase());
  if (!hasBrandStyle) {
    issues.push("Brand visual style not referenced");
  }
  
  return {
    valid: issues.length === 0,
    issues,
    details: { hasProduct, hasColors, hasComposition, wordCount }
  };
};

/**
 * Generates text content and visual prompts for social media posts based on the brand profile.
 * Now with enhanced validation and brand enforcement to ensure on-brand image generation.
 */
export const generateContentIdeas = async (profile: BrandProfile, count: number = 5, customInstruction?: string): Promise<SocialPost[]> => {
  const modelId = "gemini-2.5-flash";

  // Safety: ensure prompts never reference undefined offerings/strategy
  const safeProfile = normaliseBrandProfile(profile);
  const offeringsList = safeProfile.services.length > 0 ? safeProfile.services.join(', ') : '';
  const exampleOfferings = safeProfile.services.slice(0, 3).filter(Boolean);
  const exampleOfferingsText = exampleOfferings.length > 0 ? exampleOfferings.map(s => `"${s}"`).join(', ') : '"(use an exact product name from the brand)"';

  let specificInstruction = "";
  if (customInstruction) {
      specificInstruction = `USER OVERRIDE: The user specifically wants this: "${customInstruction}". IGNORE generic strategy and focus entirely on this request.`;
  }

  const prompt = `
    You are an ELITE Social Media Creative Director at a top marketing agency, working for ${safeProfile.name}.
    Your designs rival Canva Pro templates - polished, scroll-stopping, and conversion-focused.
    
    BRAND DNA:
    - Industry: ${safeProfile.industry}
    - Products: ${safeProfile.products}
    - Specific Offerings: ${offeringsList}
    - Brand Voice: ${safeProfile.vibe}
    - Strategy: ${safeProfile.strategy}
    - Essence: ${safeProfile.essence}
    
    ${specificInstruction}

    YOUR MISSION: Create ${count} PREMIUM social media posts that look like they cost £500 each.
    
    PRODUCT FOCUS (CRITICAL):
    Each post MUST spotlight ONE specific offering: ${offeringsList}
    NO generic content. Use EXACT product/service names.
    
    CAPTION FORMATTING (CANVA-STYLE):
    - Use line breaks for readability
    - Start with a HOOK (question, bold statement, or emoji)
    - Include a clear CTA (call-to-action)
    - British English spelling
    
    PLATFORM MASTERY:
    1. **LinkedIn**: Professional storytelling (100-200 words). Value-first. End with engagement question.
    2. **Instagram**: Punchy, visual-first (under 40 words). Use 1-2 emojis strategically. Hook in first line.
    3. **TikTok**: Trend-aware, casual, engaging. Use current lingo. Under 30 words.
    4. **Twitter/X**: Sharp, provocative. Drive clicks. Under 20 words.
    
    VISUAL PROMPT RULES (THIS CREATES THE CANVA-QUALITY IMAGE):
    The 'visualPrompt' creates the AI-generated marketing visual. Make it STUNNING.
    
    THINK LIKE A CANVA PRO DESIGNER - 6-STEP STRUCTURE:
    
    1. LAYOUT TYPE (pick one):
       - "Elegant flat lay arrangement" (product + props)
       - "Hero product shot with gradient background"
       - "Lifestyle mockup scene"
       - "Bold geometric composition"
       - "Minimalist centered product"
    
    2. THE STAR: Name the EXACT product/service
       ❌ WRONG: "athletic shoes"
       ✅ RIGHT: "${exampleOfferingsText}"
    
    3. DESIGN ELEMENTS (Canva-style):
       - Geometric shapes, abstract elements, or props
       - Clean negative space
       - ${safeProfile.visualStyle}
    
    4. BRAND COLOUR PALETTE (use these EXACTLY):
       - Primary: ${safeProfile.colors[0]}
       - Secondary: ${safeProfile.colors[1]}
       - Accent: ${safeProfile.colors[2] || '#ffffff'}
       Format: "Background in ${safeProfile.colors[0]}, accents in ${safeProfile.colors[1]}"
    
    5. LIGHTING & ATMOSPHERE:
       - "Soft studio lighting with subtle shadows"
       - "Bright, airy, clean white light"
       - "Dramatic contrast with deep shadows"
       - "Warm golden hour glow"
    
    6. QUALITY KEYWORDS (always include):
       "Ultra-high quality, 8K resolution, professional marketing photography, social media optimised, no text, no logos, no watermarks"
    
    CANVA-QUALITY EXAMPLE:
    "Elegant flat lay of ${exampleOfferingsText} on ${safeProfile.colors[0]} textured background. Geometric ${safeProfile.colors[1]} accent shapes frame the composition. Soft diffused studio lighting creates clean shadows. Minimalist styling with strategic negative space. Ultra-high quality professional marketing photography, 8K, no text or logos."
    
    LENGTH: 50-70 words. Dense with visual instructions.

    Return a JSON array of ${count} posts. Each must have stunning visualPrompt.
  `;

  try {
    // Use rate-limited queue for Gemini API calls
    const response = await queueGeminiRequest(async () => {
      console.log('📝 Generating content ideas via rate-limited queue...');
      return getTextClient().models.generateContent({
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
    }, 3); // Priority 3 (higher priority for content generation)

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
 * Image source tracking for user feedback
 */
export type ImageSource = 'imagen3' | 'gemini-flash' | 'pexels' | 'placeholder';

/**
 * Result from image generation with source tracking
 */
export interface ImageGenerationResult {
  imageUrl?: string;
  source: ImageSource;
  error?: string;
}

/**
 * Diagnostic logging for Imagen failures
 */
const diagnoseImagenFailure = (context: {
  model: string;
  apiKeyPrefix: string;
  error: any;
  attemptNumber: number;
}) => {
  const errorDetails = {
    model: context.model,
    apiKeyPrefix: context.apiKeyPrefix,
    attemptNumber: context.attemptNumber,
    errorCode: context.error?.code || 'UNKNOWN',
    errorMessage: context.error?.message || String(context.error),
    errorStatus: context.error?.status || 'N/A',
    errorDetails: context.error?.details || null,
    timestamp: new Date().toISOString(),
  };
  
  console.error('🔴 IMAGEN DIAGNOSTIC:', JSON.stringify(errorDetails, null, 2));
  
  // Specific guidance based on error type
  if (context.error?.message?.includes('API key')) {
    console.error('💡 FIX: Check that VITE_IMAGEN_API_KEY is set correctly in Netlify');
  } else if (context.error?.message?.includes('not found') || context.error?.message?.includes('404')) {
    console.error('💡 FIX: Imagen 3 model may not be enabled. Enable it in Google Cloud Console');
  } else if (context.error?.message?.includes('quota') || context.error?.message?.includes('rate')) {
    console.error('💡 FIX: API quota exceeded. Wait or increase quota in Google Cloud Console');
  } else if (context.error?.message?.includes('permission') || context.error?.message?.includes('403')) {
    console.error('💡 FIX: API key lacks permission for Imagen. Enable Imagen API in Cloud Console');
  }
  
  return errorDetails;
};

/**
 * Generate image using Gemini Flash with native image generation
 * Tries multiple Gemini image models in order of preference
 */
const generateImageWithGemini = async (
  prompt: string,
  aspectRatio: string = "1:1"
): Promise<string | undefined> => {
  // Gemini models with image generation capability (in order of preference)
  const geminiImageModels = [
    "gemini-2.5-flash-image",         // Native image generation
    "gemini-2.5-flash-image-preview", // Preview version
    "gemini-2.0-flash-exp",           // Experimental
  ];
  
  for (const model of geminiImageModels) {
    console.log(`🎨 Attempting ${model} image generation...`);
    
    try {
      const response = await getTextClient().models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "text/plain",
        },
      });
      
      // Check if response contains image data
      const text = response.text;
      if (text && text.includes('data:image')) {
        console.log(`✅ ${model} returned image data`);
        return text.trim();
      }
      
      // Try to extract base64 image from response parts
      const parts = (response as any).candidates?.[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData?.mimeType?.startsWith('image/')) {
            console.log(`✅ ${model} returned inline image`);
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
        }
      }
      
      console.warn(`⚠️ ${model} did not return image data`);
    } catch (error: any) {
      console.warn(`⚠️ ${model} failed:`, error?.message || error);
      continue;
    }
  }
  
  return undefined;
};

/**
 * Direct REST API call to Imagen 4 (bypasses SDK issues)
 * Sometimes more reliable than using the SDK
 */
const generateImageWithRestApi = async (
  prompt: string,
  apiKey: string,
  aspectRatio: string = "1:1"
): Promise<string | undefined> => {
  // Try Imagen 4 models in order of preference
  const modelsToTry = [
    "imagen-4.0-generate-001",
    "imagen-4.0-fast-generate-001",
  ];
  
  for (const model of modelsToTry) {
    const result = await tryImagenRestApi(prompt, apiKey, model, aspectRatio);
    if (result) return result;
  }
  
  return undefined;
};

/**
 * Helper: Try a specific Imagen model via REST API
 */
const tryImagenRestApi = async (
  prompt: string,
  apiKey: string,
  model: string,
  aspectRatio: string = "1:1"
): Promise<string | undefined> => {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateImage?key=${apiKey}`;
  
  console.log('🌐 Attempting Imagen 3 via direct REST API...');
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: { text: prompt },
        numberOfImages: 1,
        aspectRatio: aspectRatio === "9:16" ? "9:16" : aspectRatio === "16:9" ? "16:9" : "1:1",
        safetyFilterLevel: "BLOCK_ONLY_HIGH",
        personGeneration: "allow_adult",
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Imagen REST API error:', response.status, errorText);
      
      // Parse error for more specific guidance
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          console.error('   📋 Error message:', errorJson.error.message);
          if (errorJson.error.message.includes('not found')) {
            console.error('   💡 FIX: Enable Imagen API in Google Cloud Console');
          } else if (errorJson.error.message.includes('permission')) {
            console.error('   💡 FIX: API key lacks Imagen permissions');
          }
        }
      } catch {}
      
      return undefined;
    }
    
    const result = await response.json();
    
    // Extract image from response
    const imageData = result.generatedImages?.[0]?.image?.imageBytes ||
                      result.images?.[0]?.bytesBase64Encoded;
    
    if (imageData) {
      console.log('✅ Imagen REST API returned image!');
      return `data:image/png;base64,${imageData}`;
    }
    
    console.warn('⚠️ Imagen REST API response had no image data:', JSON.stringify(result).substring(0, 200));
    return undefined;
  } catch (error: any) {
    console.error('❌ Imagen REST API failed:', error?.message || error);
    return undefined;
  }
};

/**
 * Generates an image for a specific post using Imagen 3 model.
 * 
 * ENHANCED MULTI-LAYER FALLBACK CHAIN:
 * 1. Try Imagen 3 with all available API keys (highest quality)
 * 2. Try Gemini 2.0 Flash image generation (reliable)
 * 3. Fallback to Pexels stock images (with brand context)
 * 4. Ultimate fallback: branded placeholder (never fails)
 * 
 * CRITICAL: This uses ENHANCED prompt engineering to ensure brand DNA is respected.
 * Now with FULL DIAGNOSTIC LOGGING to identify why Imagen might fail.
 */
export const generatePostImage = async (
  visualPrompt: string, 
  profile: BrandProfile, 
  aspectRatio: string = "1:1"
): Promise<string | undefined> => {
  const safeProfile = normaliseBrandProfile(profile);

  // ENHANCED prompt engineering for Imagen 3
  // Best practices: Be specific, visual, and action-oriented
  // Imagen 3 responds best to descriptive scene-setting prompts
  
  const primaryColor = safeProfile.colors[0] || '#1a1a2e';
  const secondaryColor = safeProfile.colors[1] || '#4a4a8a';
  const accentColor = safeProfile.colors[2] || '#7c3aed';
  
  // Build a highly visual, specific prompt optimised for Imagen 3
  const finalPrompt = `
Professional marketing photograph for ${safeProfile.name} (${safeProfile.industry}).

SCENE DESCRIPTION:
${visualPrompt}

VISUAL STYLE:
${safeProfile.visualStyle}. Professional ${safeProfile.industry} marketing aesthetic.

COLOUR PALETTE (CRITICAL):
Primary: ${primaryColor} (dominant colour in scene)
Secondary: ${secondaryColor} (supporting accents)
Accent: ${accentColor} (highlights and details)
Use these exact brand colours prominently in the composition.

PHOTOGRAPHY STYLE:
- High-end commercial product photography
- Studio quality lighting with soft shadows
- Sharp focus, shallow depth of field where appropriate
- Composition suitable for Instagram/social media

TECHNICAL REQUIREMENTS:
- NO text, NO logos, NO watermarks, NO writing
- NO people, NO faces, NO hands (product-focused only)
- Photorealistic, 8K quality
- Clean, modern, professional aesthetic
- High contrast, vibrant colours
- Suitable for social media marketing
  `.trim();
  
  console.log('📝 Final Imagen prompt (first 300 chars):', finalPrompt.substring(0, 300) + '...');

  // Use ONLY the dedicated IMAGEN_API_KEY for image generation
  // This prevents accidentally using other API keys that may be rate-limited
  const imagenApiKey = process.env.IMAGEN_API_KEY;
  
  if (!imagenApiKey) {
    console.error('❌ No IMAGEN_API_KEY configured - falling back to placeholder');
    return getBrandedPlaceholderImage(safeProfile, visualPrompt);
  }
  
  const uniqueApiKeys = [imagenApiKey];

  // Log API key for debugging (first 10 chars only)
  console.log('🔑 Imagen API Key:', imagenApiKey.substring(0, 10) + '...');
  
  console.log('🖼️ Attempting Imagen image generation...');

  // Imagen model candidates to try with each key (ordered by preference)
  // Updated: Imagen 4.0 is now the latest, Imagen 3.0 has been deprecated
  const modelCandidates = [
    "imagen-4.0-generate-001",       // Imagen 4 (highest quality, current)
    "imagen-4.0-fast-generate-001",  // Imagen 4 Fast (faster, good quality)
    "imagen-4.0-ultra-generate-001", // Imagen 4 Ultra (highest quality)
    "imagen-3.0-generate-001",       // Imagen 3 (legacy fallback)
  ];

  let lastError: any = null;
  let attemptCount = 0;
  const diagnosticErrors: any[] = [];

  // ==========================================
  // LAYER 1: Try Imagen 3 with all API keys
  // ==========================================
  for (let keyIndex = 0; keyIndex < uniqueApiKeys.length; keyIndex++) {
    const apiKey = uniqueApiKeys[keyIndex];
    const apiKeyPrefix = apiKey.substring(0, 10) + '...';
    console.log(`🔑 Trying API key ${keyIndex + 1}/${uniqueApiKeys.length} (${apiKeyPrefix})`);
    
    try {
      const client = new GoogleGenAI({ apiKey });
      
      // Try each model with this API key
      for (const model of modelCandidates) {
        attemptCount++;
        console.log(`   📸 Attempt ${attemptCount}: ${model}`);
        
        try {
          const response = await client.models.generateImages({
            model,
            prompt: finalPrompt,
            config: {
              numberOfImages: 1,
              aspectRatio: aspectRatio === "9:16" ? "9:16" : aspectRatio === "16:9" ? "16:9" : "1:1",
            },
          });

          if (response.generatedImages && response.generatedImages.length > 0) {
            const imageData = response.generatedImages[0].image?.imageBytes;
            if (imageData) {
              console.log(`✅ IMAGEN 3 SUCCESS with key ${keyIndex + 1}, model: ${model}`);
              console.log('   🎨 Image Source: IMAGEN 3 AI-GENERATED');
              return `data:image/png;base64,${imageData}`;
            }
          }

          console.warn(`   ⚠️ ${model}: API returned but no images in response`);
          diagnosticErrors.push({
            model,
            apiKeyPrefix,
            error: 'Empty response - no images returned',
            attemptNumber: attemptCount,
          });
        } catch (err: any) {
          lastError = err;
          // Detailed diagnostic logging
          const diagnostic = diagnoseImagenFailure({
            model,
            apiKeyPrefix,
            error: err,
            attemptNumber: attemptCount,
          });
          diagnosticErrors.push(diagnostic);
          continue;
        }
      }
    } catch (err: any) {
      lastError = err;
      console.error(`❌ API key ${keyIndex + 1} client initialization failed:`, err?.message || err);
      continue;
    }
  }
  
  // Log summary of all Imagen failures
  console.error('📊 IMAGEN SDK FAILURE SUMMARY:', {
    totalAttempts: attemptCount,
    uniqueKeysTriedCount: uniqueApiKeys.length,
    lastErrorMessage: lastError?.message || 'Unknown',
    diagnosticCount: diagnosticErrors.length,
  });
  
  // ==========================================
  // LAYER 1.5: Try Imagen via direct REST API (bypasses SDK issues)
  // ==========================================
  console.log('🔄 Trying Imagen 3 via direct REST API (SDK may have issues)...');
  
  for (const apiKey of uniqueApiKeys) {
    const restImage = await generateImageWithRestApi(finalPrompt, apiKey, aspectRatio);
    if (restImage) {
      console.log('✅ IMAGEN 3 REST API SUCCESS');
      console.log('   🎨 Image Source: IMAGEN 3 AI-GENERATED (via REST)');
      return restImage;
    }
  }
  
  console.log('❌ Imagen REST API also failed for all keys');

  // ==========================================
  // LAYER 2: Try Gemini 2.0 Flash (experimental)
  // ==========================================
  console.log(`🔄 All ${attemptCount} Imagen attempts failed. Trying Gemini 2.0 Flash...`);
  
  // Build a simpler prompt for Gemini (it's more flexible)
  const geminiImagePrompt = `
    Generate a professional marketing image for ${safeProfile.name}.
    
    Visual description: ${visualPrompt}
    
    Brand colours: ${safeProfile.colors.slice(0, 3).join(', ')}
    Style: ${safeProfile.visualStyle}
    
    Requirements:
    - High-quality, professional marketing imagery
    - No text, no logos, no watermarks
    - Social media optimised
  `;
  
  const geminiImage = await generateImageWithGemini(geminiImagePrompt, aspectRatio);
  if (geminiImage) {
    console.log('✅ GEMINI 2.0 FLASH SUCCESS');
    console.log('   🎨 Image Source: GEMINI AI-GENERATED');
    return geminiImage;
  }
  
  // ==========================================
  // LAYER 3: Pexels Stock Photos (with brand context)
  // ==========================================
  console.log(`🔄 Gemini fallback failed. Trying Pexels stock images...`);
  
  if (isPexelsConfigured()) {
    try {
      const pexelsOrientation = aspectRatio === "9:16" ? 'portrait' : aspectRatio === "16:9" ? 'landscape' : 'square';
      const pexelsImage = await searchPexelsImage(safeProfile, visualPrompt, pexelsOrientation);
      
      if (pexelsImage) {
        console.log(`✅ Pexels image found as fallback`);
        console.log('   📷 Image Source: PEXELS STOCK PHOTO (AI generation failed)');
        console.warn('   ⚠️ This is a stock photo, NOT an AI-generated image!');
        return pexelsImage;
      }
    } catch (pexelsError) {
      console.warn('⚠️ Pexels fallback failed:', pexelsError);
    }
  } else {
    console.log('⚠️ Pexels not configured (VITE_PEXELS_API_KEY missing)');
  }

  // ==========================================
  // LAYER 4: Branded Placeholder (never fails)
  // ==========================================
  console.log('🎨 Using branded placeholder as final fallback');
  console.warn('   ⚠️ This is a PLACEHOLDER, not real content!');
  console.warn('   💡 To fix: Configure Imagen 3 API in Google Cloud Console');
  console.warn('   💡 Ensure VITE_GEMINI_API_KEY has access to Imagen API');
  
  return getBrandedPlaceholderImage(safeProfile, visualPrompt);
};

/**
 * Enhanced image generation with source tracking and RATE LIMITING
 * Returns both the image URL and where it came from
 * 
 * CRITICAL: This function now uses the rate limiter to prevent 429 errors.
 * Imagen requests are queued and executed with proper delays between them.
 */
export const generatePostImageWithSource = async (
  visualPrompt: string, 
  profile: BrandProfile, 
  aspectRatio: string = "1:1"
): Promise<ImageGenerationResult> => {
  const safeProfile = normaliseBrandProfile(profile);
  
  const primaryColor = safeProfile.colors[0] || '#1a1a2e';
  const secondaryColor = safeProfile.colors[1] || '#4a4a8a';
  const accentColor = safeProfile.colors[2] || '#7c3aed';
  
  const finalPrompt = `
Professional marketing photograph for ${safeProfile.name} (${safeProfile.industry}).

SCENE DESCRIPTION:
${visualPrompt}

VISUAL STYLE:
${safeProfile.visualStyle}. Professional ${safeProfile.industry} marketing aesthetic.

COLOUR PALETTE (CRITICAL):
Primary: ${primaryColor} (dominant colour in scene)
Secondary: ${secondaryColor} (supporting accents)
Accent: ${accentColor} (highlights and details)

PHOTOGRAPHY STYLE:
- High-end commercial product photography
- Studio quality lighting with soft shadows
- Sharp focus, composition suitable for Instagram/social media

TECHNICAL REQUIREMENTS:
- NO text, NO logos, NO watermarks
- Photorealistic, high quality
- Clean, modern, professional aesthetic
  `.trim();

  // Use ONLY the dedicated IMAGEN_API_KEY for image generation
  const imagenApiKey = process.env.IMAGEN_API_KEY;
  
  if (!imagenApiKey) {
    console.error('❌ No IMAGEN_API_KEY configured');
    // Fall through to Pexels/placeholder fallbacks
  }
  
  const allApiKeys = imagenApiKey ? [imagenApiKey] : [];
  
  // LAYER 1: Try Imagen 4 via rate-limited queue
  // This is the CRITICAL change - all Imagen requests go through the queue
  const imagenModels = ["imagen-4.0-generate-001", "imagen-4.0-fast-generate-001"];
  
  for (const apiKey of allApiKeys) {
    for (const model of imagenModels) {
      try {
        // Queue the Imagen request with rate limiting
        const imageData = await queueImagenRequest(async () => {
          console.log(`🖼️ Image generation queued: ${model}`);
          const client = new GoogleGenAI({ apiKey });
          const response = await client.models.generateImages({
            model,
            prompt: finalPrompt,
            config: { numberOfImages: 1, aspectRatio: aspectRatio === "9:16" ? "9:16" : "1:1" },
          });
          return response.generatedImages?.[0]?.image?.imageBytes;
        }, 5); // Priority 5 (medium)
        
        if (imageData) {
          console.log(`✅ Imagen 4 SUCCESS with model: ${model}`);
          return { imageUrl: `data:image/png;base64,${imageData}`, source: 'imagen3' };
        }
      } catch (err: any) {
        // Log but continue to next model/key
        console.warn(`⚠️ Imagen ${model} failed:`, err?.message?.substring(0, 100));
      }
    }
  }
  
  // LAYER 2: Try Imagen REST API (also rate-limited)
  for (const apiKey of allApiKeys) {
    try {
      const restImage = await queueImagenRequest(async () => {
        return generateImageWithRestApi(finalPrompt, apiKey, aspectRatio);
      }, 6);
      
      if (restImage) {
        return { imageUrl: restImage, source: 'imagen3' };
      }
    } catch {}
  }
  
  // LAYER 3: Try Gemini (different rate limit)
  try {
    const geminiImage = await queueGeminiRequest(async () => {
      return generateImageWithGemini(finalPrompt, aspectRatio);
    }, 7);
    
    if (geminiImage) {
      return { imageUrl: geminiImage, source: 'gemini-flash' };
    }
  } catch {}
  
  // LAYER 4: Pexels (no rate limiting needed - different API)
  if (isPexelsConfigured()) {
    const pexelsOrientation = aspectRatio === "9:16" ? 'portrait' : 'square';
    const pexelsImage = await searchPexelsImage(safeProfile, visualPrompt, pexelsOrientation);
    if (pexelsImage) {
      return { imageUrl: pexelsImage, source: 'pexels' };
    }
  }
  
  // LAYER 5: Placeholder (no API call)
  return { 
    imageUrl: getBrandedPlaceholderImage(safeProfile, visualPrompt), 
    source: 'placeholder',
    error: 'All AI image generation methods failed. Using branded placeholder.',
  };
};

/**
 * Get current API rate limiter status (for debugging/UI)
 */
export const getApiStatus = () => {
  return rateLimiter.getStatus();
};

/**
 * Clear all pending API requests (e.g., when switching brands)
 */
export const clearPendingRequests = () => {
  rateLimiter.clearQueues();
};

/**
 * Branded placeholder image (no random landscapes) used only when image generation fails.
 * This keeps the UI stable and avoids confusing, off-brand visuals like deserts/cactuses.
 */
const toBase64Utf8 = (input: string): string => {
  // btoa expects Latin-1; encode to UTF-8 safely
  return btoa(unescape(encodeURIComponent(input)));
};

const getBrandedPlaceholderImage = (profile: BrandProfile, seed: string = ''): string => {
  // Ensure colors are valid hex strings
  const colors = normaliseStringArray(profile.colors).map(c => c.startsWith('#') ? c : '#CCCCCC');
  const c1 = colors[0] || '#111827';
  const c2 = colors[1] || '#6366f1';
  const c3 = colors[2] || '#a855f7';

  const seedNum = seed
    ? seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
    : 210;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${c1}"/>
          <stop offset="55%" stop-color="${c2}"/>
          <stop offset="100%" stop-color="${c3}"/>
        </linearGradient>
        <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="40"/>
        </filter>
      </defs>
      <rect width="800" height="800" fill="url(#bg)"/>
      <g filter="url(#blur)" opacity="0.55">
        <circle cx="220" cy="250" r="190" fill="${c2}"/>
        <circle cx="610" cy="310" r="220" fill="${c3}"/>
        <circle cx="430" cy="610" r="240" fill="${c1}"/>
      </g>
      <g opacity="0.15">
        <path d="M0,560 C220,520 300,760 520,720 C660,696 720,580 800,560 L800,800 L0,800 Z" fill="#ffffff"/>
      </g>
      <g opacity="0.12" transform="translate(400 400) rotate(${seedNum})">
        <rect x="-340" y="-6" width="680" height="12" rx="6" fill="#ffffff"/>
        <rect x="-6" y="-340" width="12" height="680" rx="6" fill="#ffffff"/>
      </g>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" fill="#ffffff" opacity="0.8">
        ${profile.name}
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;base64,${toBase64Utf8(svg)}`;
};

/**
 * Soft refresh: Enrich an existing brand profile with new data.
 * Looks for new products, services, or marketing insights without replacing existing data.
 * 
 * @param currentProfile - The existing brand profile
 * @param url - The brand URL to re-analyze
 * @returns Updated profile and list of changes found
 */
export const softRefreshBrand = async (
  currentProfile: BrandProfile,
  url: string
): Promise<{ 
  updatedProfile: BrandProfile; 
  newOfferings: string[];
  changes: string[];
}> => {
  console.log("🔄 Soft refresh: Looking for new data for", currentProfile.name);
  
  const changes: string[] = [];
  const newOfferings: string[] = [];
  
  try {
    // Research for new products/services
    const refreshPrompt = `
      I already have this brand profile for ${currentProfile.name} (${url}):
      
      Current Services: ${currentProfile.services.slice(0, 10).join(', ')}
      Current Strategy: ${currentProfile.strategy?.substring(0, 200)}...
      
      Search for any NEW information about this brand that we might have missed:
      1. New products or services launched recently
      2. New marketing campaigns or initiatives
      3. Updated brand messaging or positioning
      4. New social media accounts or content strategies
      5. Recent news or announcements
      6. New product images or marketing materials
      
      Return ONLY new information that is NOT already in the current profile.
    `;
    
    const refreshSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        newServices: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING },
          description: "New products/services not in current list"
        },
        strategyUpdates: { 
          type: Type.STRING,
          description: "Any updates to marketing strategy"
        },
        newSocialHandles: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING },
          description: "New social media accounts found"
        },
        newImageAssets: { 
          type: Type.ARRAY, 
          items: { 
            type: Type.OBJECT,
            properties: {
              url: { type: Type.STRING },
              label: { type: Type.STRING }
            }
          },
          description: "New product images found"
        },
        recentNews: { 
          type: Type.STRING,
          description: "Any recent news or announcements"
        },
      },
      required: ["newServices"],
    };
    
    const refreshData = await researchAndExtract<{
      newServices?: string[];
      strategyUpdates?: string;
      newSocialHandles?: string[];
      newImageAssets?: Array<{ url: string; label: string }>;
      recentNews?: string;
    }>(refreshPrompt, refreshSchema);
    
    // Merge new data
    let updatedProfile = { ...currentProfile };
    
    // Add new services (deduplicated)
    if (refreshData.newServices && refreshData.newServices.length > 0) {
      const existingServicesLower = currentProfile.services.map(s => s.toLowerCase());
      const trulyNew = refreshData.newServices.filter(
        s => !existingServicesLower.includes(s.toLowerCase())
      );
      
      if (trulyNew.length > 0) {
        updatedProfile.services = [...trulyNew, ...currentProfile.services];
        newOfferings.push(...trulyNew);
        changes.push(`Found ${trulyNew.length} new offerings`);
      }
    }
    
    // Add new social handles
    if (refreshData.newSocialHandles && refreshData.newSocialHandles.length > 0) {
      const existingHandles = currentProfile.socialHandles || [];
      const existingHandlesLower = existingHandles.map(h => h.toLowerCase());
      const newHandles = refreshData.newSocialHandles.filter(
        h => !existingHandlesLower.includes(h.toLowerCase())
      );
      
      if (newHandles.length > 0) {
        updatedProfile.socialHandles = [...existingHandles, ...newHandles];
        changes.push(`Found ${newHandles.length} new social accounts`);
      }
    }
    
    // NOTE: imageAssets logic removed - AI cannot reliably find real URLs
    // All images are now generated fresh by Imagen
    
    // Append strategy updates if significant
    if (refreshData.strategyUpdates && refreshData.strategyUpdates.length > 50) {
      // Don't replace, just log for now
      changes.push(`New strategy insights found`);
    }
    
    console.log(`✅ Soft refresh complete:`, changes);
    
    return {
      updatedProfile: normaliseBrandProfile(updatedProfile),
      newOfferings,
      changes,
    };
    
  } catch (error) {
    console.error("Soft refresh failed:", error);
    return {
      updatedProfile: currentProfile,
      newOfferings: [],
      changes: ['Refresh failed - using existing data'],
    };
  }
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
  
  // For IMAGE-TO-VIDEO: Prompt describes ONLY motion/animation, NOT content
  // VEO's RAI filter rejects prompts mentioning people, so use abstract motion descriptions
  // The image itself provides the visual content - we just describe HOW to animate it
  const safeMotionPrompts = [
    "Gentle parallax effect with soft depth of field",
    "Slow cinematic zoom with smooth camera movement",
    "Subtle atmospheric motion with natural flow",
    "Slow pan across the scene with professional lighting",
    "Smooth dolly zoom with elegant motion blur",
  ];
  const randomMotion = safeMotionPrompts[Math.floor(Math.random() * safeMotionPrompts.length)];
  
  // Combine user's motion intent with safe motion - avoid triggering RAI
  const imageToVideoPrompt = sanitisedPrompt.length > 0 
    ? `${randomMotion}. ${sanitisedPrompt}. Keep faithful to source image.`
    : `${randomMotion}. Keep faithful to source image.`;

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
      // Handle specific error cases
      if (response.status === 404) {
        console.error("❌ Netlify function not found (404) - Check if function is deployed");
        console.error("   Ensure netlify.toml has 'functions = netlify/functions'");
        console.error("   Ensure package @netlify/functions is installed");
        console.error("   Run 'netlify deploy' to deploy functions");
        throw new Error('Video generation function not deployed. Please check Netlify configuration.');
      }
      
      let errorMessage = `Netlify function error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.details || errorMessage;
        console.error("❌ Netlify function error:", errorData);
      } catch {
        // Could not parse JSON error
        console.error("❌ Netlify function error:", response.status, response.statusText);
      }
      
      throw new Error(errorMessage);
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

  // Helper function for TEXT-TO-VIDEO only (SDK based)
  // Used ONLY when there is NO source image
  const tryTextToVideo = async (clientGetter: () => GoogleGenAI) => {
    const client = clientGetter();
    // VEO image-to-video supports [4, 6, 8] seconds, not 5
    const durationSeconds = duration === "5s" ? 6 : 8;
    
    console.log("📝 TEXT-TO-VIDEO mode (no source image)...");
    console.log("📝 Text prompt:", textToVideoPrompt.substring(0, 200) + "...");
    
    // Use SDK for text-to-video
    // Note: VEO 3 is preferred but may not be available in all regions
    // Falls back to VEO 2 if VEO 3 fails
    const veoModels = ["veo-3.0-generate-001", "veo-2.0-generate-001"];
    let response: any;
    
    for (const veoModel of veoModels) {
      try {
        console.log(`🎬 Trying ${veoModel} for text-to-video...`);
        response = await client.models.generateVideos({
          model: veoModel,
          prompt: textToVideoPrompt,
          config: {
            aspectRatio: "9:16",
            numberOfVideos: 1,
            durationSeconds: durationSeconds,
            personGeneration: "dont_allow",
          },
        });
        console.log(`✅ ${veoModel} accepted the request`);
        break; // Success - exit loop
      } catch (modelError: any) {
        console.warn(`⚠️ ${veoModel} failed:`, modelError?.message?.substring(0, 100));
        if (veoModel === veoModels[veoModels.length - 1]) {
          throw modelError; // Last model failed, re-throw
        }
        // Continue to next model
      }
    }
    return response as any;
  };

  try {
    const mode = sourceImage ? 'IMAGE-TO-VIDEO (Vertex AI)' : 'TEXT-TO-VIDEO (SDK)';
    console.log(`🎬 Starting VEO video generation: ${mode}`);
    
    let result;
    
    // IMAGE-TO-VIDEO: ALWAYS use Netlify serverless function (routes to Vertex AI)
    // This is the ONLY reliable way to do image-to-video
    if (sourceImage) {
      console.log("🌐 Using Netlify serverless function → Vertex AI for image-to-video...");
      
      // Convert source image to base64 if needed
      let imageBase64: string | undefined;
      let mimeType: string = 'image/png';
      
      if (sourceImage.startsWith('data:image/')) {
        const matches = sourceImage.match(/^data:(image\/\w+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          imageBase64 = matches[2];
          console.log(`📷 Extracted base64: ${mimeType}, ${Math.round(imageBase64.length / 1024)}KB`);
        }
      } else if (sourceImage.startsWith('http')) {
        console.log("🔄 Converting URL to base64...");
        const converted = await urlToBase64(sourceImage);
        if (converted) {
          imageBase64 = converted.base64;
          mimeType = converted.mimeType;
          console.log(`📷 Converted: ${mimeType}, ${Math.round(imageBase64.length / 1024)}KB`);
        }
      }
      
      if (!imageBase64) {
        console.error("❌ Failed to extract/convert image to base64");
        return { 
          status: 'failed', 
          failureReason: 'Could not process source image for video generation' 
        };
      }
      
      try {
        result = await tryNetlifyFunction(imageBase64, mimeType);
      } catch (netlifyError: any) {
        console.error("❌ Netlify/Vertex AI function failed:", netlifyError.message);
        return { 
          status: 'failed', 
          failureReason: `Image-to-video failed: ${netlifyError.message}. Check Vertex AI credentials.` 
        };
      }
    } else {
      // TEXT-TO-VIDEO: No source image - use SDK directly
      console.log("📝 No source image - using text-to-video via SDK...");
      try {
        result = await tryTextToVideo(getVideoClient);
      } catch (primaryError: any) {
        console.warn("⚠️ Primary VEO key failed:", primaryError.message);
        
        try {
          console.log("🔄 Trying backup VEO key...");
          result = await tryTextToVideo(getVideoBackupClient);
        } catch (backupError: any) {
          console.error("❌ Backup key also failed:", backupError.message);
          return { 
            status: 'failed', 
            failureReason: `Text-to-video failed: ${backupError.message}` 
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
 * Routes through Netlify serverless function to bypass CORS.
 */
export const checkVideoStatus = async (operationName: string): Promise<{
  status: 'pending' | 'success' | 'failed';
  videoUrl?: string;
  failureReason?: string;
}> => {
  try {
    // Route through Netlify function to bypass CORS
    console.log("🔍 Checking video status via Netlify function:", operationName);
    
    const response = await fetch('/.netlify/functions/generate-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'status',
        operationName: operationName,
      }),
    });
    
    if (!response.ok) {
      console.error("Video status check failed:", response.status, response.statusText);
      if (response.status === 404) {
        // 404 can mean:
        // 1. Netlify function not deployed (check netlify.toml and redeploy)
        // 2. Operation name not found (VEO operation expired or invalid)
        console.error("❌ 404 Error - Check if Netlify function is deployed and GOOGLE_CLOUD_PROJECT_ID/GOOGLE_SERVICE_ACCOUNT_KEY are set");
        return { 
          status: 'failed', 
          failureReason: 'Video operation not found. The function may not be deployed or the operation expired.'
        };
      }
      // For other errors, allow retry
      return { status: 'pending' };
    }
    
    const result = await response.json();
    console.log("📊 Video operation status:", result);
    
    if (result.status === 'success' && result.videoUrl) {
      console.log("✅ Video ready:", result.videoUrl);
      return { status: 'success', videoUrl: result.videoUrl };
    }
    
    if (result.status === 'failed') {
      console.error("❌ Video generation failed:", result.error);
      return { 
        status: 'failed', 
        failureReason: result.error || 'Video generation failed'
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
