
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
  // Ensure Base URL doesn't have trailing slash
  let cleanBaseUrl = apiConfig.baseUrl.replace(/\/$/, '');

  // Robustness: strip /chat/completions if user accidentally included it
  if (cleanBaseUrl.endsWith('/chat/completions')) {
    cleanBaseUrl = cleanBaseUrl.replace(/\/chat\/completions$/, '');
  }

  const path = apiConfig.endpointPath.startsWith('/') ? apiConfig.endpointPath : `/${apiConfig.endpointPath}`;

  // Robustness: For OpenAI-compatible endpoints, ensure /v1 exists
  // Many users forget to add /v1 to the base URL
  if (path === '/chat/completions' && !cleanBaseUrl.endsWith('/v1')) {
    const isV1Beta = cleanBaseUrl.endsWith('/v1beta'); // Don't break Gemini
    if (!isV1Beta) {
      cleanBaseUrl = `${cleanBaseUrl}/v1`;
    }
  }

  const endpoint = `${cleanBaseUrl}${path}`;

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

  // 5 Minute Timeout for Video Generation
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CustomService] API Error: ${response.status} - ${errorText}`);

      // Handle HTML Errors (Nginx 404/405/500)
      if (errorText.trim().startsWith('<')) {
        throw new Error(`API Error (${response.status}): Upstream Server returned HTML. Please check your Sora Base URL configuration.`);
      }

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
    let lineBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      lineBuffer += chunk;

      const lines = lineBuffer.split(/\r?\n/);
      // Keep the last partial line in the buffer
      lineBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

        if (trimmedLine.startsWith('data: ')) {
          try {
            const jsonStr = trimmedLine.slice(6);
            if (jsonStr.startsWith('{')) {
              const data = JSON.parse(jsonStr);

              // 1. Accumulate Text Content (Standard Chat Delta)
              const contentDelta = data.choices?.[0]?.delta?.content;
              if (contentDelta) {
                accumulatedContent += contentDelta;
              }

              // 2. Enhanced URL Detection (Recursive search for any 'url' fields)
              const searchUrl = (obj: any): string | null => {
                if (!obj || typeof obj !== 'object') return null;

                // Check common URL fields
                const keys = ['url', 'video_url', 'imageUrl', 'image_url', 'output_url'];
                for (const key of keys) {
                  if (obj[key] && typeof obj[key] === 'string' && obj[key].startsWith('http')) {
                    return obj[key];
                  }
                }

                // Recursive search in arrays and objects
                for (const k in obj) {
                  const found: string | null = searchUrl(obj[k]);
                  if (found) return found;
                }
                return null;
              };

              const foundUrl = searchUrl(data);
              if (foundUrl && !accumulatedContent.includes(foundUrl)) {
                // If it's a direct URL field, we prioritize it
                // If Strategy 1 was used before, we can set a flag or just return early later
                console.log('[CustomService] Found URL in JSON field:', foundUrl);
                if (!accumulatedContent.includes(foundUrl)) {
                  accumulatedContent += " " + foundUrl + " ";
                }
              }
            }
          } catch (e) {
            console.debug("Skipping non-JSON or partial stream chunk:", trimmedLine);
          }
        }
      }
    }

    // Process remaining buffer if it looks like a complete line (unlikely with SSE but good practice)
    if (lineBuffer.trim().startsWith('data: ')) {
      // ... optionally handle last line if not ending with newline
    }

    console.log('[CustomService] Stream completed.');
    console.log('[CustomService] Accumulated Content:', accumulatedContent);

    // --- Result Extraction ---

    // Strategy 2: Extract URL from accumulated content string
    // This handles cases where the URL is in markdown like [Video](http://...) or just raw
    const urlRegex = /(https?:\/\/[^\s<>"'()]+)/g;
    const matches = accumulatedContent.match(urlRegex);

    if (matches && matches.length > 0) {
      // Return the first URL found, cleaned of trailing punctuation
      const cleanUrl = matches[0].replace(/[.,;!?]$/, "");
      console.log('[CustomService] Extracted URL from content:', cleanUrl);
      return cleanUrl;
    }

    // Strategy 3: Handle Error Messages in Content
    // Short content with no URL is often an error message from the upstream provider
    if (accumulatedContent.length > 0 && accumulatedContent.length < 500 && !accumulatedContent.includes('http')) {
      throw new Error(`API Response: ${accumulatedContent}`);
    }

    throw new Error("Could not find video URL in the response content. Reference: " + accumulatedContent.substring(0, 100));

  } catch (error) {
    console.error("Custom API Generation Error:", error);
    throw error;
  }
};
