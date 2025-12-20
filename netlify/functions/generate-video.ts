import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { GoogleAuth } from "google-auth-library";

interface VideoRequest {
  imageBase64?: string;
  mimeType?: string;
  motionPrompt: string;
  duration: "5s" | "10s";
}

/**
 * VEO Video Generation Serverless Function (Vertex AI)
 * 
 * Uses Vertex AI API for proper image-to-video support.
 * This bypasses CORS issues and uses the correct API format.
 * 
 * Modes:
 * 1. IMAGE-TO-VIDEO: Animates the source image (first frame = source image)
 * 2. TEXT-TO-VIDEO: Creates video from text prompt (fallback)
 * 
 * Authentication: Service Account with Vertex AI User role
 */
const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

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

    // Get GCP credentials from environment
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    if (!projectId || !serviceAccountKey) {
      console.error("❌ Missing GCP credentials");
      console.error(`   Project ID: ${projectId ? "✓" : "✗"}`);
      console.error(`   Service Account Key: ${serviceAccountKey ? "✓" : "✗"}`);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: "GCP credentials not configured",
          details: "Missing GOOGLE_CLOUD_PROJECT_ID or GOOGLE_SERVICE_ACCOUNT_KEY"
        }),
      };
    }

    // Parse service account credentials
    let credentials;
    try {
      credentials = JSON.parse(serviceAccountKey);
    } catch (parseError) {
      console.error("❌ Failed to parse service account key:", parseError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Invalid service account key format" }),
      };
    }

    // Create Google Auth client with service account
    const auth = new GoogleAuth({
      credentials: credentials,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    // Get access token
    const accessToken = await auth.getAccessToken();
    if (!accessToken) {
      console.error("❌ Failed to get access token");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Failed to authenticate with GCP" }),
      };
    }

    console.log("✅ GCP authentication successful");
    
    // Duration in seconds (VEO supports 5-8 seconds)
    const durationSeconds = duration === "5s" ? 5 : 8;
    
    // Vertex AI endpoint for VEO
    // Using veo-2.0-generate-001 for image-to-video stability
    const location = "us-central1";
    const model = "veo-2.0-generate-001";
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predictLongRunning`;

    let requestBody: any;
    
    if (imageBase64 && mimeType) {
      // IMAGE-TO-VIDEO mode - Vertex AI format
      console.log("🎬 IMAGE-TO-VIDEO mode via Vertex AI");
      console.log(`   Image size: ${Math.round(imageBase64.length / 1024)}KB`);
      console.log(`   MIME type: ${mimeType}`);
      console.log(`   Motion prompt: ${motionPrompt.substring(0, 100)}...`);
      console.log(`   Duration: ${durationSeconds}s`);
      
      requestBody = {
        instances: [{
          prompt: motionPrompt,
          image: {
            bytesBase64Encoded: imageBase64,
            mimeType: mimeType,
          },
        }],
        parameters: {
          aspectRatio: "9:16",
          sampleCount: 1,
          durationSeconds: durationSeconds,
          personGeneration: "dont_allow",
        },
      };
    } else {
      // TEXT-TO-VIDEO mode
      console.log("📝 TEXT-TO-VIDEO mode via Vertex AI");
      console.log(`   Prompt: ${motionPrompt.substring(0, 100)}...`);
      
      requestBody = {
        instances: [{
          prompt: motionPrompt,
        }],
        parameters: {
          aspectRatio: "9:16",
          sampleCount: 1,
          durationSeconds: durationSeconds,
          personGeneration: "dont_allow",
        },
      };
    }

    console.log(`📤 Sending request to Vertex AI: ${endpoint}`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Vertex AI error:", response.status, errorText);
      
      // Parse error for better debugging
      let errorDetails = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = errorJson.error?.message || errorText;
      } catch {}
      
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: `Vertex AI error: ${response.status}`,
          details: errorDetails,
        }),
      };
    }

    const result = await response.json();
    console.log("✅ Vertex AI request accepted");
    console.log("   Operation:", result.name);

    // Return the operation name for status polling
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        name: result.name,
        done: result.done || false,
        metadata: result.metadata,
      }),
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
