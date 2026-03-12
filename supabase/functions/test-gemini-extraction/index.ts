// Diagnostic function: Test Gemini extraction with a specific document
// Deployed temporarily to diagnose why Gemini fails on 8-page rental agreement
// DELETE THIS FUNCTION after diagnosis

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const body = await req.json();
    const { extraction_id } = body;

    if (!extraction_id) {
      return new Response(JSON.stringify({ error: "Missing extraction_id" }), { status: 400, headers });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY_SECURED");
    const vertexAiCredentials = Deno.env.get("VERTEX_AI_CREDENTIALS");
    const vertexAiProjectId = Deno.env.get("VERTEX_AI_PROJECT_ID") || "flent-ai-project-2";

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get the extraction record
    const { data: extraction, error: fetchError } = await supabase
      .from("extracted_rental_info")
      .select("id, document_storage_path, raw_extraction_data")
      .eq("id", extraction_id)
      .single();

    if (fetchError || !extraction) {
      return new Response(JSON.stringify({ error: "Extraction not found", detail: fetchError?.message }), { status: 404, headers });
    }

    // 2. Get OCR text from raw_extraction_data if available, or re-OCR
    let documentText = "";

    if (extraction.raw_extraction_data?.document?.text) {
      documentText = extraction.raw_extraction_data.document.text;
      console.log(`[test-gemini] Using cached OCR text: ${documentText.length} chars`);
    } else {
      // Need to download and OCR the document
      const { data: fileData, error: downloadError } = await supabase
        .storage
        .from("rent-agreements")
        .download(extraction.document_storage_path);

      if (downloadError || !fileData) {
        return new Response(JSON.stringify({ error: "File download failed", detail: downloadError?.message }), { status: 500, headers });
      }

      // Convert to base64 for Document AI
      const arrayBuffer = await fileData.arrayBuffer();
      const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      console.log(`[test-gemini] Downloaded file: ${arrayBuffer.byteLength} bytes, OCR-ing with Document AI...`);

      // OCR with Document AI
      const gcpCredentials = Deno.env.get("GCP_CREDENTIALS_JSON");
      if (!gcpCredentials) {
        return new Response(JSON.stringify({ error: "No GCP_CREDENTIALS_JSON" }), { status: 500, headers });
      }

      const credentialsJson = JSON.parse(gcpCredentials);
      const accessToken = await getGCPAccessToken(credentialsJson);

      const processorId = Deno.env.get("GCP_PROCESSOR_ID") || "a70fa5c4de9ef4be";
      const location = "us";
      const projectId = credentialsJson.project_id;

      const docAIResponse = await fetch(
        `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rawDocument: {
              content: base64Content,
              mimeType: "application/pdf",
            },
          }),
        }
      );

      if (!docAIResponse.ok) {
        const errorText = await docAIResponse.text();
        return new Response(JSON.stringify({ error: "Document AI failed", detail: errorText }), { status: 500, headers });
      }

      const docAIResult = await docAIResponse.json();
      documentText = docAIResult.document?.text || "";
      console.log(`[test-gemini] OCR complete: ${documentText.length} chars, ${docAIResult.document?.pages?.length} pages`);
    }

    if (documentText.length < 100) {
      return new Response(JSON.stringify({ error: "Document text too short", length: documentText.length }), { status: 400, headers });
    }

    // 3. Test Gemini extraction - try both paths and capture errors
    const results: any = {
      document_text_length: documentText.length,
      document_text_preview: documentText.substring(0, 500),
      vertex_ai: { attempted: false, success: false, error: null, response: null },
      api_key: { attempted: false, success: false, error: null, response: null },
    };

    // --- Vertex AI Gemini (global endpoint) ---
    if (vertexAiCredentials && vertexAiProjectId) {
      results.vertex_ai.attempted = true;
      try {
        const vertexCreds = JSON.parse(vertexAiCredentials);
        const vertexToken = await getGCPAccessToken(vertexCreds);

        // Use GLOBAL endpoint (no region prefix) — provisioned throughput
        console.log(`[test-gemini] Calling Vertex AI Gemini GLOBAL (project: ${vertexAiProjectId})...`);

        const prompt = buildExtractionPrompt(documentText);
        const endpoint = `https://aiplatform.googleapis.com/v1/projects/${vertexAiProjectId}/locations/global/publishers/google/models/gemini-3-flash-preview:generateContent`;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${vertexToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192,
              responseMimeType: "application/json",
            },
          }),
        });

        const statusCode = response.status;
        const responseText = await response.text();
        console.log(`[test-gemini] Vertex AI response: ${statusCode}, ${responseText.length} chars`);

        if (!response.ok) {
          results.vertex_ai.error = `HTTP ${statusCode}: ${responseText.substring(0, 1000)}`;
        } else {
          const parsed = JSON.parse(responseText);
          const textContent = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
          results.vertex_ai.response = textContent.substring(0, 2000);

          if (textContent) {
            const jsonMatch = textContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const extractedJson = JSON.parse(jsonMatch[0]);
                results.vertex_ai.success = true;
                results.vertex_ai.extracted = extractedJson;
              } catch (parseErr: any) {
                results.vertex_ai.error = `JSON parse failed: ${parseErr.message}`;
              }
            } else {
              results.vertex_ai.error = "No JSON found in response";
            }
          } else {
            // Check for safety/blocking
            results.vertex_ai.error = "Empty text content";
            results.vertex_ai.full_response = parsed;
          }
        }
      } catch (err: any) {
        results.vertex_ai.error = `Exception: ${err.message}`;
        console.error("[test-gemini] Vertex AI exception:", err.message, err.stack?.substring(0, 500));
      }
    } else {
      results.vertex_ai.error = "No VERTEX_AI_CREDENTIALS configured";
    }

    // --- API Key Gemini ---
    if (geminiApiKey) {
      results.api_key.attempted = true;
      try {
        console.log(`[test-gemini] Calling Gemini API key (prefix: ${geminiApiKey.substring(0, 10)}...)...`);

        const prompt = buildExtractionPrompt(documentText);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 8192,
                responseMimeType: "application/json",
              },
            }),
          }
        );

        const statusCode = response.status;
        const responseText = await response.text();
        console.log(`[test-gemini] API key response: ${statusCode}, ${responseText.length} chars`);

        if (!response.ok) {
          results.api_key.error = `HTTP ${statusCode}: ${responseText.substring(0, 1000)}`;
        } else {
          const parsed = JSON.parse(responseText);
          const textContent = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
          results.api_key.response = textContent.substring(0, 2000);

          if (textContent) {
            const jsonMatch = textContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const extractedJson = JSON.parse(jsonMatch[0]);
                results.api_key.success = true;
                results.api_key.extracted = extractedJson;
              } catch (parseErr: any) {
                results.api_key.error = `JSON parse failed: ${parseErr.message}`;
              }
            } else {
              results.api_key.error = "No JSON found in response";
            }
          } else {
            results.api_key.error = "Empty text content";
            results.api_key.full_response = parsed;
          }
        }
      } catch (err: any) {
        results.api_key.error = `Exception: ${err.message}`;
        console.error("[test-gemini] API key exception:", err.message, err.stack?.substring(0, 500));
      }
    } else {
      results.api_key.error = "No GEMINI_API_KEY_SECURED set";
    }

    // 4. Store diagnostic results in the extraction record
    await supabase
      .from("extracted_rental_info")
      .update({
        gemini_raw_response: results,
      })
      .eq("id", extraction_id);

    return new Response(JSON.stringify({ success: true, results }), { status: 200, headers });

  } catch (err: any) {
    console.error("[test-gemini] Fatal error:", err.message, err.stack);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
});

function buildExtractionPrompt(documentText: string): string {
  return `You are analyzing a document that the user claims is an Indian rental/lease agreement. First determine if it actually IS a rental/lease agreement, then extract information.

DOCUMENT TEXT:
${documentText.substring(0, 50000)}

Extract and return a JSON object with these exact fields (use null for fields you cannot find):
{
  "is_rental_agreement": true/false,
  "document_type_detected": "what type of document this actually is",
  "rejection_reason": "if is_rental_agreement is false, explain why. null if true",
  "property_name": "SHORT display name",
  "property_address": "FULL verbose address",
  "property_city": "city name",
  "property_state": "state name",
  "property_pincode": "6-digit pincode",
  "monthly_rent": "number only in rupees",
  "security_deposit": "number only in rupees",
  "contract_start_date": "YYYY-MM-DD format",
  "contract_end_date": "YYYY-MM-DD format",
  "contract_length_months": "duration in months as number",
  "tenant_names": ["array of tenant names"],
  "landlord_names": ["array of landlord names"],
  "confidence": "your confidence 0-100"
}

IMPORTANT:
- FIRST: Determine is_rental_agreement. Set to true ONLY if it is a rental/lease agreement.
- Return ONLY the JSON object, no other text.`;
}

// GCP auth helpers
async function getGCPAccessToken(credentials: { client_email: string; private_key: string }): Promise<string> {
  const jwt = await createJWT(credentials);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenResult = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenResult.access_token) {
    throw new Error(`GCP auth failed: ${tokenResult.error_description || tokenResult.error}`);
  }
  return tokenResult.access_token;
}

function base64url(data: string | Uint8Array): string {
  let base64: string;
  if (typeof data === 'string') {
    base64 = btoa(data);
  } else {
    base64 = btoa(String.fromCharCode(...data));
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createJWT(credentials: { client_email: string; private_key: string }): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const keyData = credentials.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");

  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));
  const encoder = new TextEncoder();

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(signatureInput)
  );

  const signatureB64 = base64url(new Uint8Array(signature));
  return `${signatureInput}.${signatureB64}`;
}
