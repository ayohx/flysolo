import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

interface VideoRequest {
  imageBase64?: string;
  mimeType?: string;
  motionPrompt: string;
  duration: "5s" | "10s";
}

/**
 * VEO Video Generation Serverless Function
 * 
 * Supports two modes:
 * 1. IMAGE-TO-VIDEO: Animates a source image (recommended for consistent results)
 *    - Passes the exact image the user sees on the card
 *    - Uses the image as the "first frame" and animates it
 * 
 * 2. TEXT-TO-VIDEO: Creates video from text prompt only (fallback)
 * 
 * API: Uses Google Generative Language API with VEO 2.0
 * (VEO 2.0 is more stable for image-to-video than VEO 3.0)
 */
const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  try {
    const { imageBase64, mimeType, motionPrompt, duration } = JSON.parse(
      event.body || "{}"
    ) as VideoRequest;

    // Try primary VEO key first, then fallback
    const apiKey = process.env.VEO_API_KEY || process.env.VITE_VEO_API_KEY || process.env.API_KEY;

    if (!apiKey) {
      console.error("VEO_API_KEY not configured");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "VEO API key not configured" }),
      };
    }

    // Build request body based on whether we have an image
    // VEO 2.0 image-to-video uses a specific format with the image as first frame
    let requestBody: any;
    
    // VEO 2.0 supports 5-10 seconds, VEO 3.0 supports 4-8 seconds
    // Using VEO 2.0 for better image-to-video support
    const durationSeconds = duration === "5s" ? 5 : 8;

    if (imageBase64 && mimeType) {
      // IMAGE-TO-VIDEO mode - animate the EXACT source image
      console.log("🎬 IMAGE-TO-VIDEO mode - animating source image...");
      console.log(`   Image size: ${Math.round(imageBase64.length / 1024)}KB, Type: ${mimeType}`);
      console.log(`   Motion prompt: ${motionPrompt.substring(0, 100)}...`);
      
      // VEO 2.0 image-to-video format according to Generative Language API docs
      // The image is passed as the reference/starting frame
      requestBody = {
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: imageBase64,
                },
              },
              {
                text: motionPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["VIDEO"],
          videoConfig: {
            aspectRatio: "9:16",
            numberOfVideos: 1,
            durationSeconds: durationSeconds,
            personGeneration: "dont_allow",
          },
        },
      };
    } else {
      // TEXT-TO-VIDEO mode (no source image)
      console.log("📝 TEXT-TO-VIDEO mode...");
      requestBody = {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: motionPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["VIDEO"],
          videoConfig: {
            aspectRatio: "9:16",
            numberOfVideos: 1,
            durationSeconds: durationSeconds,
            personGeneration: "dont_allow",
          },
        },
      };
    }

    console.log("📤 Sending request to VEO API...");

    // Use generateContent endpoint which supports multimodal input
    // For pure video generation, we need the video model endpoint
    const endpoint = imageBase64 
      ? `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:generateContent?key=${apiKey}`
      : `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:generateVideo?key=${apiKey}`;
    
    // If text-only, use the older format that works
    if (!imageBase64) {
      requestBody = {
        instances: [
          {
            prompt: motionPrompt,
          },
        ],
        parameters: {
          aspectRatio: "9:16",
          sampleCount: 1,
          durationSeconds: durationSeconds,
          personGeneration: "dont_allow",
        },
      };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ VEO API error:", response.status, errorText);
      
      // If image-to-video fails, try alternative VEO endpoint
      if (imageBase64) {
        console.log("🔄 Trying alternative image-to-video endpoint...");
        
        const altRequestBody = {
          instances: [
            {
              prompt: motionPrompt,
              image: {
                bytesBase64Encoded: imageBase64,
                mimeType: mimeType,
              },
            },
          ],
          parameters: {
            aspectRatio: "9:16",
            sampleCount: 1,
            durationSeconds: durationSeconds,
            personGeneration: "dont_allow",
          },
        };
        
        const altResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:generateVideo?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(altRequestBody),
          }
        );
        
        if (altResponse.ok) {
          const altResult = await altResponse.json();
          console.log("✅ Alternative VEO endpoint success:", altResult.name);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(altResult),
          };
        }
        
        const altErrorText = await altResponse.text();
        console.error("❌ Alternative endpoint also failed:", altResponse.status, altErrorText);
      }
      
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: `VEO API error: ${response.status}`,
          details: errorText,
        }),
      };
    }

    const result = await response.json();
    console.log("✅ VEO API success:", result.name || "Response received");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error: any) {
    console.error("❌ Function error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
    };
  }
};

export { handler };

