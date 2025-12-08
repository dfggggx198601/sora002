import { GoogleGenAI } from "@google/genai";
import { GenerationConfig } from "../types";

// Helper to encode file to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

export const generateWithVeo = async (config: GenerationConfig): Promise<string> => {
  // 1. Ensure API Key is selected
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      throw new Error("API_KEY_MISSING");
    }
  }

  // 2. Initialize Client (New instance per call to ensure fresh key)
  // The API key is injected via process.env.API_KEY by the environment wrapper automatically
  // when using window.aistudio.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // 3. Prepare Payload
  const modelName = 'veo-3.1-fast-generate-preview'; // Using fast preview for responsiveness
  
  // Default aspect ratio if not provided
  const aspectRatio = config.aspectRatio === '1:1' ? '16:9' : (config.aspectRatio || '16:9');
  
  let operation;

  try {
    if (config.image) {
      // Image-to-Video
      const base64Image = await fileToBase64(config.image);
      
      operation = await ai.models.generateVideos({
        model: modelName,
        prompt: config.prompt, // Prompt is optional but recommended
        image: {
          imageBytes: base64Image,
          mimeType: config.image.type,
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p', // Veo fast supports 720p
          aspectRatio: aspectRatio, // 1:1 not supported by Veo fast natively in all modes, mapping to 16:9 safe default
        }
      });
    } else {
      // Text-to-Video
      operation = await ai.models.generateVideos({
        model: modelName,
        prompt: config.prompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: aspectRatio,
        }
      });
    }

    // 4. Poll for Completion
    // It can take a few minutes.
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    // 5. Retrieve Video
    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) {
      throw new Error("No video URI returned from API.");
    }

    // The download link needs the API key appended manually for fetch, 
    // but for displaying in a <video> tag, we might need to proxy or fetch blob.
    // The instructions say: "You must append an API key when fetching from the download link."
    const authenticatedUrl = `${videoUri}&key=${process.env.API_KEY}`;
    
    // Check validity
    const response = await fetch(authenticatedUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.statusText}`);
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);

  } catch (error: any) {
    console.error("Veo Generation Error:", error);
    if (error.message && error.message.includes("Requested entity was not found")) {
        throw new Error("API_KEY_INVALID");
    }
    throw error;
  }
};