import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { GoogleAuth } from "google-auth-library";

interface VideoRequest {
  action?: "generate" | "status";
  // For generate action
  imageBase64?: string;
  mimeType?: string;
  motionPrompt?: string;
  duration?: "5s" | "10s";
  // For status action
  operationName?: string;
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
    const { action = "generate", imageBase64, mimeType, motionPrompt, duration, operationName } = JSON.parse(
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

    // Handle STATUS action - check operation status
    if (action === "status" && operationName) {
      console.log("🔍 Checking operation status:", operationName);
      
      const location = "us-central1";
      
      // VEO 2.0 uses predictLongRunning which returns an LRO with UUID-style operation ID
      // The standard operations.get API expects numeric Long IDs, not UUIDs
      // So we need to use fetchPredictOperation on the model endpoint instead
      
      // Extract model path from operation name
      // Format: projects/{project}/locations/{location}/publishers/google/models/{model}/operations/{opId}
      const modelMatch = operationName.match(/^(projects\/[^/]+\/locations\/[^/]+\/publishers\/google\/models\/[^/]+)\/operations\/([^/]+)$/);
      
      let statusEndpoint: string;
      let requestBody: any = {};
      let method = "GET";
      
      if (modelMatch) {
        // VEO model operation - use fetchPredictOperation
        const modelPath = modelMatch[1];
        const opId = modelMatch[2];
        
        // Use the LRO wait endpoint which works with UUID operation IDs
        statusEndpoint = `https://${location}-aiplatform.googleapis.com/v1/${operationName}:wait`;
        method = "POST";
        requestBody = { timeout: "1s" }; // Short timeout to just check status
        
        console.log("📡 VEO status endpoint (LRO wait):", statusEndpoint);
      } else if (!operationName.startsWith('projects/')) {
        // Just an operation ID - construct standard path
        statusEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/operations/${operationName}`;
        console.log("📡 Standard operations endpoint:", statusEndpoint);
      } else {
        // Full path but not a model operation - try direct GET
        statusEndpoint = `https://${location}-aiplatform.googleapis.com/v1/${operationName}`;
        console.log("📡 Direct operation endpoint:", statusEndpoint);
      }
      
      let statusResponse = await fetch(statusEndpoint, {
        method: method,
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: method === "POST" ? JSON.stringify(requestBody) : undefined,
      });
      
      // If LRO wait fails, try direct GET on the operation
      if (!statusResponse.ok && method === "POST") {
        console.log("⚠️ LRO wait failed, trying direct GET...");
        const directEndpoint = `https://${location}-aiplatform.googleapis.com/v1/${operationName}`;
        
        statusResponse = await fetch(directEndpoint, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        });
      }
      
      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.error("❌ Status check failed:", statusResponse.status, errorText);
        
        // For 404/400, provide more helpful debugging info
        if (statusResponse.status === 404 || statusResponse.status === 400) {
          console.error("❌ Operation check failed - may have expired or invalid format");
          console.error("   Endpoint:", statusEndpoint);
          console.error("   Operation name:", operationName);
          
          // Parse error for more details
          let errorMessage = "Video operation check failed.";
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error?.message || errorMessage;
          } catch {}
          
          return {
            statusCode: 200, // Return 200 so client knows function worked
            headers,
            body: JSON.stringify({
              status: "failed",
              done: true,
              error: errorMessage,
            }),
          };
        }
        
        return {
          statusCode: statusResponse.status,
          headers,
          body: JSON.stringify({
            status: "error",
            error: `Status check failed: ${statusResponse.status}`,
            details: errorText,
          }),
        };
      }
      
      const statusResult = await statusResponse.json();
      console.log("📊 Operation status:", JSON.stringify(statusResult, null, 2));
      
      if (statusResult.done) {
        // Check for video in response
        const videoUri = statusResult.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
          || statusResult.response?.generatedVideos?.[0]?.video?.uri;
        
        if (videoUri) {
          console.log("✅ Video ready:", videoUri);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              status: "success",
              done: true,
              videoUrl: videoUri,
            }),
          };
        }
        
        // Check for error
        if (statusResult.error) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              status: "failed",
              done: true,
              error: statusResult.error.message || "Video generation failed",
            }),
          };
        }
        
        // Check for content filter
        const raiCount = statusResult.response?.generateVideoResponse?.raiMediaFilteredCount;
        if (raiCount > 0) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              status: "failed",
              done: true,
              error: "Video content was filtered by safety settings. Try a different prompt.",
            }),
          };
        }
        
        // Done but no video - unknown failure
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            status: "failed",
            done: true,
            error: "Video generation completed but no video was returned",
            rawResponse: statusResult.response,
          }),
        };
      }
      
      // Still processing
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: "pending",
          done: false,
          metadata: statusResult.metadata,
        }),
      };
    }
    
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
      console.error("❌ Vertex AI error:", response.status);
      console.error("   Full error response:", errorText);
      console.error("   Endpoint:", endpoint);
      console.error("   Project:", projectId);
      
      // Parse error for better debugging
      let errorDetails = errorText;
      let errorCode = "";
      let errorReason = "";
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = errorJson.error?.message || errorText;
        errorCode = errorJson.error?.code || "";
        errorReason = errorJson.error?.status || "";
        console.error("   Error code:", errorCode);
        console.error("   Error reason:", errorReason);
        console.error("   Error message:", errorDetails);
      } catch {}
      
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: `Vertex AI error: ${response.status}`,
          details: errorDetails,
          code: errorCode,
          reason: errorReason,
          endpoint: endpoint,
          project: projectId,
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
