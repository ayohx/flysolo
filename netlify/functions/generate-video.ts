import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

interface VideoRequest {
  imageBase64?: string;
  mimeType?: string;
  motionPrompt: string;
  duration: "5s" | "10s";
}

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

    const apiKey = process.env.VEO_API_KEY;

    if (!apiKey) {
      console.error("VEO_API_KEY not configured");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "VEO API key not configured" }),
      };
    }

    // Build request body based on whether we have an image
    let requestBody: any;

    if (imageBase64 && mimeType) {
      // IMAGE-TO-VIDEO mode
      console.log("🎬 IMAGE-TO-VIDEO mode - animating source image...");
      requestBody = {
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
          durationSeconds: duration === "5s" ? 5 : 10,
          personGeneration: "dont_allow",
        },
      };
    } else {
      // TEXT-TO-VIDEO mode
      console.log("📝 TEXT-TO-VIDEO mode...");
      requestBody = {
        instances: [
          {
            prompt: motionPrompt,
          },
        ],
        parameters: {
          aspectRatio: "9:16",
          sampleCount: 1,
          durationSeconds: duration === "5s" ? 5 : 10,
          personGeneration: "dont_allow",
        },
      };
    }

    console.log("📤 Sending request to VEO API...");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:generateVideo?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ VEO API error:", response.status, errorText);
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
    console.log("✅ VEO API success:", result.name);

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

