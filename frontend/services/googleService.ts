import { GoogleGenAI } from "@google/genai";
import { DEFAULT_GOOGLE_CONFIG } from "../constants";

export const generateImageWithGoogle = async (
  prompt: string,
  model: string = 'gemini-3-pro-image-preview',  // Gemini 3 Pro Image (Nano Banana Pro)
  baseUrl?: string,
  apiKey?: string
): Promise<string> => {

  // 1. Prefer passed apiKey (from user settings)
  // 2. Fallback to import.meta.env.VITE_GOOGLE_API_KEY
  // 3. Fallback to DEFAULT_GOOGLE_CONFIG.apiKey
  let finalApiKey = apiKey;
  if (!finalApiKey || finalApiKey.trim() === '') {
    finalApiKey = import.meta.env.VITE_GOOGLE_API_KEY || DEFAULT_GOOGLE_CONFIG?.apiKey;
  }

  // Sanitization: Remove any non-ASCII characters (often causes Header errors)
  if (finalApiKey) {
    // eslint-disable-next-line no-control-regex
    finalApiKey = finalApiKey.replace(/[^\x00-\x7F]/g, "").trim();
  }

  if (!finalApiKey) {
    throw new Error("API Key not found. Please enter your Google API Key in Settings.");
  }

  // Configure client with optional Base URL
  const clientConfig: any = { apiKey: finalApiKey };

  // Use passed baseUrl, or fallback to default config baseUrl if exists, otherwise standard Google
  const finalBaseUrl = baseUrl || DEFAULT_GOOGLE_CONFIG?.baseUrl;
  if (finalBaseUrl) {
    clientConfig.baseUrl = finalBaseUrl.replace(/\/$/, '');
  }

  const ai = new GoogleGenAI(clientConfig);

  const targetModel = model;

  console.log(`[GoogleService] Generating with model: ${targetModel}`);

  try {
    // CASE 1: Imagen Models
    if (targetModel.startsWith('imagen')) {
      const response = await ai.models.generateImages({
        model: targetModel,
        prompt: prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: '1:1',
          outputMimeType: 'image/jpeg'
        }
      });

      const base64Data = response.generatedImages?.[0]?.image?.imageBytes;
      if (base64Data) {
        return `data:image/jpeg;base64,${base64Data}`;
      }
      throw new Error("Imagen 模型未返回有效的图片数据");
    }

    // CASE 2: Gemini Models
    else {
      // For gemini-3-pro-image-preview (Nano Banana Pro)
      if (targetModel.includes('gemini-3-pro-image')) {
        const requestParams: any = {
          model: targetModel,
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: {
              aspectRatio: '1:1',
              imageSize: '1K'
            }
          }
        };

        const response = await ai.models.generateContent(requestParams);

        if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
              const base64Data = part.inlineData.data;
              const mimeType = part.inlineData.mimeType || 'image/png';
              return `data:${mimeType};base64,${base64Data}`;
            }
          }
        }
        throw new Error("Gemini 3 Pro Image 未返回有效的图片数据");
      }

      // For gemini-2.5-flash-image or other Gemini image models
      else {
        const requestParams: any = {
          model: targetModel,
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ]
        };

        const response = await ai.models.generateContent(requestParams);

        if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
              const base64Data = part.inlineData.data;
              const mimeType = part.inlineData.mimeType || 'image/png';
              return `data:${mimeType};base64,${base64Data}`;
            }
          }
        }
        throw new Error("Gemini 模型未返回有效的图片数据");
      }
    }

  } catch (error: any) {
    console.error("Google Image Generation Error:", error);

    if (error.message && (error.message.includes("403") || error.message.includes("PERMISSION_DENIED"))) {
      throw new Error(`权限不足 (403)。当前 Key 无法访问模型 "${targetModel}"。`);
    }

    if (error.message && error.message.includes("404")) {
      throw new Error(`模型未找到 (404)。服务端找不到模型 "${targetModel}"。请检查 Base URL。`);
    }

    throw new Error(error.message || "生成图片失败");
  }
};

// --- Chat Functionality ---

import { ChatMessage } from '../types';

interface ChatOptions {
  history: ChatMessage[];
  newMessage: string;
  image?: File;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export const generateWithChat = async (options: ChatOptions) => {
  const { history, newMessage, image, apiKey, baseUrl } = options;
  const model = options.model || 'gemini-3-pro-preview'; // Default to a strong model for chat

  // 1. Resolve Config
  let finalApiKey = apiKey;
  if (!finalApiKey || finalApiKey.trim() === '') {
    finalApiKey = import.meta.env.VITE_GOOGLE_API_KEY || DEFAULT_GOOGLE_CONFIG?.apiKey;
  }
  if (finalApiKey) {
    // eslint-disable-next-line no-control-regex
    finalApiKey = finalApiKey.replace(/[^\x00-\x7F]/g, "").trim();
  }
  if (!finalApiKey) {
    throw new Error("API Key not found.");
  }

  const clientConfig: any = { apiKey: finalApiKey };
  const finalBaseUrl = baseUrl || DEFAULT_GOOGLE_CONFIG?.baseUrl;
  if (finalBaseUrl) {
    clientConfig.baseUrl = finalBaseUrl.replace(/\/$/, '');
  }

  const ai = new GoogleGenAI(clientConfig);

  // 2. Prepare Tools
  const tools = [
    {
      functionDeclarations: [
        {
          name: "generate_image",
          description: "Generate an image when the user EXPLICITLY asks you to create, draw, or generate a picture. ONLY use this when the user requests visual content like 'draw a cat' or 'create an image of'. Do NOT use this for questions about yourself or general conversation.",
          parameters: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description: "The detailed prompt for generating the image."
              }
            },
            required: ["prompt"]
          }
        }
      ]
    }
  ];

  // 3. Prepare History (Convert to Gemini Format)
  // Gemini expects: { role: 'user' | 'model', parts: [...] }
  // We need to filter out 'tool' related internal states if we are just re-sending history,
  // BUT for Gemini 1.5, we should ideally maintain the multi-turn function calling history if we want to be correct.
  // For simplicity v1: We will convert previous text/image messages. 
  // If we want to support multi-turn properly, we need to map our ChatMessage structure accurately to Gemini's Content structure.

  // 3. Prepare History (Convert to Gemini Format)
  const historyContents: any[] = [];

  for (const msg of history) {
    // 1. User Message
    if (msg.role === 'user') {
      const parts: any[] = [];
      if (msg.content) parts.push({ text: msg.content });

      // Handle Attachments
      if (msg.attachments) {
        for (const att of msg.attachments) {
          if (att.url.startsWith('data:')) {
            const base64Data = att.url.split(',')[1];
            const mimeType = att.url.split(';')[0].split(':')[1];
            parts.push({
              inlineData: { mimeType: mimeType, data: base64Data }
            });
          }
        }
      }

      historyContents.push({ role: 'user', parts });
    }

    // 2. Model Message (Text or Tool Call)
    if (msg.role === 'model') {
      // If this message initiated a tool call
      if (msg.toolCall) {
        // Function call should be in its own turn, without text
        const functionCallParts = [{
          functionCall: {
            name: msg.toolCall.name,
            args: msg.toolCall.args
          }
        }];

        // Push the MODEL turn with ONLY the function call
        historyContents.push({ role: 'model', parts: functionCallParts });

        // 3. Immediate Tool Result Turn (USER role in Gemini)
        // If we have a result, we must provide it as the NEXT turn immediately
        if (msg.toolResult) {
          // SANITIZATION: Do NOT send the full base64 image data back to the model in history.
          // This causes massive token usage (treating base64 as text) and hits the 1M limit instantly.
          let sanitizedResult = msg.toolResult.result;

          // Check if result has imageUrl and it's a data URL
          if (sanitizedResult && typeof sanitizedResult === 'object' && sanitizedResult.imageUrl && typeof sanitizedResult.imageUrl === 'string' && sanitizedResult.imageUrl.startsWith('data:')) {
            // Create a copy and replace imageUrl with a placeholder
            sanitizedResult = {
              ...sanitizedResult,
              imageUrl: "<Image Data Omitted for Context Efficiency>"
            };
          }

          historyContents.push({
            role: 'user',
            parts: [{
              functionResponse: {
                name: msg.toolCall.name,
                response: {
                  content: sanitizedResult
                }
              }
            }]
          });
        }
      } else {
        // Just a normal text response
        const parts: any[] = [];
        if (msg.content) parts.push({ text: msg.content });

        if (parts.length > 0) {
          historyContents.push({ role: 'model', parts });
        }
      }
    }
  }

  // 4. Current Message Construction
  const currentParts: any[] = [{ text: newMessage }];
  if (image) {
    // Convert File to Base64
    const base64 = await fileToGenerativePart(image);
    currentParts.push(base64);
  }

  // 5. GenerateContent
  // We use generateContent with `contents` = [...history, current]
  // Note: We use the stateless `generateContent` instead of `startChat` to have full control over history construction every time.

  const req: any = {
    model: model,
    contents: [...historyContents, { role: 'user', parts: currentParts }],
    config: {
      systemInstruction: "You are Gemini, a helpful AI assistant created by Google. Always respond to questions with natural text. ONLY call the generate_image function when users explicitly ask you to draw, create, or generate a picture. For questions like 'who are you', 'what can you do', etc., respond with text, NOT with function calls or JSON. IMPORTANT: When you use the generate_image function, you are using the Gemini 3 Pro Image (also called Nano Banana Pro) model, NOT Imagen. If users ask what model generated the images, tell them it's Gemini 3 Pro Image.",
      tools: tools,
      toolConfig: { functionCallingConfig: { mode: "AUTO" } }
    }
  };

  console.log("Gemini Chat Request:", JSON.stringify(req, null, 2));
  const result = await ai.models.generateContent(req);
  console.log("Gemini Chat Response:", JSON.stringify(result, null, 2));

  // Robust handling: simpler SDKs may return the response object directly
  const response = result.response || result;

  let toolCall = undefined;
  let text = "";

  // Parse Candidates
  if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.text) {
        text += part.text;
      }
      if (part.functionCall) {
        toolCall = {
          id: 'call_' + Date.now(), // Gemini doesn't always give ID in some versions, generate one
          name: part.functionCall.name,
          args: part.functionCall.args
        };
      }
    }
  }

  console.log("Extracted text:", text);
  console.log("Extracted toolCall:", toolCall);

  return { text, toolCall };
};

async function fileToGenerativePart(file: File): Promise<{ inlineData: { data: string; mimeType: string } }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // remove data:image/xxx;base64,
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}