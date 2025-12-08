
import { GoogleGenAI } from "@google/genai";

export const generateImageWithGoogle = async (
  prompt: string, 
  // apiKey removed, using process.env.API_KEY
  model: string = 'gemini-3-pro-image-preview',
  baseUrl?: string
): Promise<string> => {
  
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment. Please connect your Google Account.");
  }

  // Configure client with optional Base URL
  const clientConfig: any = { apiKey };
  if (baseUrl) {
    // Remove trailing slash if present
    clientConfig.baseUrl = baseUrl.replace(/\/$/, '');
  }

  const ai = new GoogleGenAI(clientConfig);
  
  // Use the exact model name provided by the user. 
  const targetModel = model;

  console.log(`[GoogleService] Generating with model: ${targetModel}`);
  console.log(`[GoogleService] BaseURL: ${baseUrl || '(Default Google)'}`);
  
  try {
    // CASE 1: Imagen Models (e.g., imagen-3.0-generate-001)
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

    // CASE 2: Gemini Models (e.g., gemini-3-pro-image-preview, gemini-2.5-flash-image)
    else {
      const requestParams: any = {
        model: targetModel,
        contents: {
          parts: [
            { text: prompt }
          ]
        }
      };

      // Configuration specific to Gemini 3/Pro Image families
      if (targetModel.includes('gemini-3') || targetModel.includes('pro-image')) {
        requestParams.config = {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
          }
        };
      }

      const response = await ai.models.generateContent(requestParams);

      // Parse response for image data
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
        throw new Error(`权限不足 (403)。当前 Key 无法访问模型 "${targetModel}"。\n如果您使用中转服务，请检查 Base URL 是否正确。`);
    }

    if (error.message && error.message.includes("404")) {
        throw new Error(`模型未找到 (404)。服务端找不到模型 "${targetModel}"。\n1. 请检查模型名称是否与中转站支持的完全一致。\n2. 检查 Base URL 设置。`);
    }

    throw new Error(error.message || "生成图片失败");
  }
};
