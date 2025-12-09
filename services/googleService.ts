import { GoogleGenAI } from "@google/genai";
import { DEFAULT_GOOGLE_CONFIG } from "../constants";

export const generateImageWithGoogle = async (
  prompt: string, 
  model: string = 'gemini-3-pro-image-preview',
  baseUrl?: string
): Promise<string> => {
  
  // Logic: 
  // 1. Try process.env.API_KEY (injected by AI Studio)
  // 2. Fallback to DEFAULT_GOOGLE_CONFIG.apiKey (hardcoded in constants for Cloud Run)
  let apiKey = process.env.API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    apiKey = DEFAULT_GOOGLE_CONFIG?.apiKey;
  }

  if (!apiKey) {
    throw new Error("API Key not found. Please connect Google Account or configure DEFAULT_GOOGLE_CONFIG.");
  }

  // Configure client with optional Base URL
  const clientConfig: any = { apiKey };
  
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
      const requestParams: any = {
        model: targetModel,
        contents: {
          parts: [
            { text: prompt }
          ]
        }
      };

      if (targetModel.includes('gemini-3') || targetModel.includes('pro-image')) {
        requestParams.config = {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
          }
        };
      }

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