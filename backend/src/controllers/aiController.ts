import { Request, Response } from 'express';
import { SettingsModel } from '../models/Settings';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Simple round-robin or random picker
const pickKey = (keys: string[]) => {
    if (!keys || keys.length === 0) return null;
    return keys[Math.floor(Math.random() * keys.length)];
};

export class AiController {

    static async generateImage(req: Request, res: Response) {
        try {
            const { prompt, model } = req.body;
            const settings = await SettingsModel.getSettings();

            if (!settings.aiConfig?.enabled) {
                return res.status(503).json({ error: 'AI generation service is disabled by admin' });
            }

            const keys = settings.aiConfig.googleKeys;
            const apiKey = pickKey(keys);

            if (!apiKey) {
                return res.status(500).json({ error: 'No API Keys configured in system' });
            }

            // Using official GoogleGenerativeAI SDK logic
            // Note: Current @google/generative-ai SDK doesn't natively support "Imagen" via the same class structure as Gemini in some versions,
            // or it requires specific beta endpoints.
            // For now, let's assume we are proxying the *exact* request logic used in frontend but with a backend key.

            // HOWEVER, the frontend code used @google/genai (experimental) or raw fetch.
            // Let's rely on standard fetch to avoiding SDK version hell if features are very new (like Gemini 3 Image).

            // Actually, for Gemini 3 Image (Nano Banana), it's a generateContent call with responseModalities.

            const genAI = new GoogleGenerativeAI(apiKey);

            // Logic for Gemini Image Generation
            // model: 'gemini-3-pro-image-preview' (as per frontend example)

            // Note: The specific model 'gemini-3-pro-image-preview' might use a different payload structure or be standard generateContent.
            // Let's assume standard generateContent but handle the result parsing.

            const modelInstance = genAI.getGenerativeModel({ model: model || 'gemini-2.0-flash' }); // Fallback

            // Construct request
            // If it's the "Nano Banana" style image gen, the frontend used explicit JSON.
            // Using the SDK:
            const result = await modelInstance.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                // If the model supports config for image output, passage it here?
                // The SDK might not support arbitrary config fields if typed strictly.
                // Let's use fetch for maximum flexibility if SDK fails us.
            });

            const response = result.response;
            // Parse response for image...
            // This is risky if SDK doesn't support the image parts easily.

            // FALLBACK TO RAW FETCH for stability with bleeding edge models
            const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
            const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

            const rawResponse = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseModalities: ["IMAGE"], // Force Image
                        // Frontend used this.
                    }
                })
            });

            if (!rawResponse.ok) {
                const errText = await rawResponse.text();
                throw new Error(`Google API Error: ${rawResponse.status} - ${errText}`);
            }

            const data = await rawResponse.json();

            // Parse like frontend
            let imageUrl = null;
            if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
                for (const part of data.candidates[0].content.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        const mimeType = part.inlineData.mimeType || 'image/png';
                        imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
                        break;
                    }
                }
            }

            if (!imageUrl) {
                // Try text fallback?
                throw new Error('No image data returned from AI');
            }

            res.json({ imageUrl });

        } catch (error: any) {
            console.error('AI Generate Image Error:', error);
            res.status(500).json({ error: error.message || 'Generation failed' });
        }
    }

    static async chat(req: Request, res: Response) {
        let apiKey = '';
        try {
            const { history, message, model } = req.body;
            const settings = await SettingsModel.getSettings();

            if (!settings.aiConfig?.enabled) {
                return res.status(503).json({ error: 'AI service disabled' });
            }

            const keys = settings.aiConfig.googleKeys;
            const pickedKey = pickKey(keys);

            if (!pickedKey) {
                return res.status(500).json({ error: 'No API Keys configured' });
            }
            apiKey = pickedKey;

            // Unify logic: Always use fetch with configurable Base URL to ensure v1beta/custom compatibility.
            // Default Base URL is standard Google v1beta
            let baseUrl = settings.aiConfig.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';

            // Robustly handle trailing slash and trailing '/models'
            let cleanBaseUrl = baseUrl.replace(/\/$/, '');
            if (cleanBaseUrl.endsWith('/models')) {
                cleanBaseUrl = cleanBaseUrl.slice(0, -7);
            }
            cleanBaseUrl = cleanBaseUrl.replace(/\/$/, '');

            const chatUrl = `${cleanBaseUrl}/models/${model || 'gemini-3-pro-preview'}:generateContent?key=${apiKey}`;

            const payload = {
                contents: [...history, { role: 'user', parts: [{ text: message }] }],
                generationConfig: { maxOutputTokens: 8000 }
            };

            const rawRes = await fetch(chatUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!rawRes.ok) {
                const err = await rawRes.text();
                console.error(`[AI Proxy Error] Status: ${rawRes.status}, URL: ${chatUrl}`);
                console.error(`[AI Proxy Response] ${err}`);

                // Return detailed error for debugging
                return res.status(rawRes.status).json({
                    error: `Google API Error (${rawRes.status}): ${err}`,
                    debug: { url: chatUrl.replace(apiKey, '***'), model }
                });
            }

            const data = await rawRes.json();
            // Parse response
            let text = '';
            if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
                text = data.candidates[0].content.parts.map((p: any) => p.text).join('');
            }
            res.json({ text });

        } catch (error: any) {
            console.error('AI Chat Error (Key used: ' + (apiKey ? apiKey.substring(0, 8) + '...' : 'none') + '):', error);
            res.status(500).json({ error: error.message || 'Chat failed', details: error.toString() });
        }
    }
}
