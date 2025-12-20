
import { GenerationConfig, CustomApiConfig } from "../types";

// Helper to encode file to Base64 (Full Data URL for some APIs)
const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export const generateWithCustomApi = async (
  genConfig: GenerationConfig,
  apiConfig: CustomApiConfig
): Promise<string> => {
  // Ensure Base URL doesn't have trailing slash and path starts with slash
  const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');
  const path = apiConfig.endpointPath.startsWith('/') ? apiConfig.endpointPath : `/${apiConfig.endpointPath}`;
  const endpoint = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiConfig.apiKey) {
    headers['Authorization'] = `Bearer ${apiConfig.apiKey}`;
  }

  // Construct payload for Chat Completions (OpenAI Compatible)
  const messages: any[] = [];
  
  if (genConfig.image) {
    // Multimodal request (Image-to-Video)
    const base64Image = await fileToDataURL(genConfig.image);
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: genConfig.prompt },
        { 
          type: 'image_url', 
          image_url: { 
            url: base64Image 
          } 
        }
      ]
    });
  } else {
    // Text-to-Video
    messages.push({
      role: 'user',
      content: genConfig.prompt
    });
  }

  // Use the explicitly selected model (e.g., sora-video-landscape-10s)
  // ENABLE STREAMING as required by the API
  const payload = {
    model: genConfig.model, 
    messages: messages,
    stream: true 
  };

  console.log(`[CustomService] POST ${endpoint} (Stream Mode)`);
  console.log(`[CustomService] Payload:`, JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CustomService] API Error: ${response.status} - ${errorText}`);
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error && errorJson.error.message) {
            throw new Error(errorJson.error.message);
        }
      } catch (e) {
        // ignore parse error
      }
      throw new Error(`API Error (${response.status}): ${errorText}`);
    }

    // --- Stream Handling ---
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) {
      throw new Error("Failed to initialize stream reader");
    }

    let accumulatedContent = '';
    let accumulatedDataUrl = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
        
        if (trimmedLine.startsWith('data: ')) {
          try {
            const jsonStr = trimmedLine.slice(6);
            const data = JSON.parse(jsonStr);

            // 1. Accumulate Text Content (Standard Chat Delta)
            const contentDelta = data.choices?.[0]?.delta?.content;
            if (contentDelta) {
              accumulatedContent += contentDelta;
            }

            // 2. Check for URL in special data fields (some proxies emit this in stream)
            if (data.data && Array.isArray(data.data) && data.data.length > 0 && data.data[0].url) {
                accumulatedDataUrl = data.data[0].url;
            }
          } catch (e) {
            console.warn("Error parsing stream chunk:", e);
          }
        }
      }
    }

    console.log('[CustomService] Stream completed. Accumulated Content:', accumulatedContent);

    // --- Result Extraction ---

    // Strategy 1: Direct URL found in stream object
    if (accumulatedDataUrl) {
        console.log('[CustomService] Found URL in stream data object');
        return accumulatedDataUrl;
    }

    // Strategy 2: Extract URL from accumulated content string
    // Regex matches http/https URLs, being careful about markdown boundaries like ) or ] or "
    const urlRegex = /(https?:\/\/[^\s<>"'()]+)/g;
    const matches = accumulatedContent.match(urlRegex);

    if (matches && matches.length > 0) {
        // Return the first URL found. 
        // We clean trailing punctuation that might have been captured (like a period at end of sentence)
        const cleanUrl = matches[0].replace(/[.,;!?]$/, "");
        console.log('[CustomService] Extracted URL from content:', cleanUrl);
        return cleanUrl;
    }

    // Strategy 3: Handle Error Messages in Content
    // If we have content but no URL, it's likely an error message
    if (accumulatedContent.length > 0 && accumulatedContent.length < 500) {
        throw new Error(`Generation Error: ${accumulatedContent}`);
    }

    throw new Error("Could not find video URL in the response content.");

  } catch (error) {
    console.error("Custom API Generation Error:", error);
    throw error;
  }
};
