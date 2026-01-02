import { Request, Response } from 'express';
import { SettingsModel } from '../models/Settings';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Simple round-robin or random picker
const pickKey = (keys: string[]) => {
    if (!keys || keys.length === 0) return null;
    return keys[Math.floor(Math.random() * keys.length)];
};

import { UserModel } from '../models/User';
import { TaskModel } from '../models/Task';

export class AiController {

    static async proxyMedia(req: Request, res: Response) {
        try {
            const { url } = req.query;
            if (!url || typeof url !== 'string') {
                return res.status(400).send('Missing url parameter');
            }

            // Prepare Headers for Upstream
            const headers: HeadersInit = {};

            // Forward Range header if present (Critical for video seeking/safari)
            if (req.headers.range) {
                headers['Range'] = req.headers.range;
            }

            const response = await fetch(url, { headers });

            if (!response.ok) {
                // Determine status code (upstream might return 206 or 200 or error)
                return res.status(response.status).send(`Upstream Error: ${response.statusText}`);
            }

            // Forward Response Headers
            const contentType = response.headers.get('content-type');
            if (contentType) res.setHeader('Content-Type', contentType);

            const contentLength = response.headers.get('content-length');
            if (contentLength) res.setHeader('Content-Length', contentLength);

            const contentRange = response.headers.get('content-range');
            if (contentRange) res.setHeader('Content-Range', contentRange);

            const acceptRanges = response.headers.get('accept-ranges');
            if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
            else res.setHeader('Accept-Ranges', 'bytes'); // Ensure we advertise range support

            // Set Status Code (206 for Partial Content, 200 for Full)
            res.status(response.status);

            // Pipe stream
            // @ts-ignore
            if (response.body && typeof response.body.pipe === 'function') {
                // @ts-ignore
                response.body.pipe(res);
            } else {
                // Web Streams (fetch in Node 20+)
                const reader = response.body?.getReader();
                if (reader) {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        res.write(value);
                    }
                    res.end();
                } else {
                    res.status(500).send('No readable stream');
                }
            }

        } catch (error: any) {
            console.error('Proxy Error:', error);
            if (!res.headersSent) res.status(500).send('Proxy Failed');
        }
    }

    static async generateImage(req: Request, res: Response) {
        try {
            const { prompt, model } = req.body;
            // @ts-ignore
            const userId = req.userId;

            // 1. Check Quota
            if (userId) {
                const user = await UserModel.findById(userId);
                if (!user) return res.status(404).json({ error: 'User not found' });
                if (user.quota.imageCount >= user.quota.dailyImageLimit) {
                    return res.status(429).json({ error: 'Daily image quota exceeded' });
                }
                const newQuota = { ...user.quota, imageCount: (user.quota.imageCount || 0) + 1 };
                await UserModel.update(userId, { quota: newQuota });
            }

            const settings = await SettingsModel.getSettings();
            if (!settings.aiConfig?.enabled) {
                return res.status(503).json({ error: 'AI generation service is disabled by admin' });
            }

            const keys = settings.aiConfig.googleKeys;
            const apiKey = pickKey(keys);
            if (!apiKey) return res.status(500).json({ error: 'No API Keys configured' });

            // 2. Prepare Request (Use v1beta for Gemini 3 / Image)
            // Use Settings-defined Base URL or Default
            let baseUrl = settings.aiConfig.baseUrl || 'https://generativelanguage.googleapis.com';

            // Clean Base URL
            let cleanBaseUrl = baseUrl.replace(/\/$/, '');
            if (cleanBaseUrl.endsWith('/models')) cleanBaseUrl = cleanBaseUrl.slice(0, -7);
            cleanBaseUrl = cleanBaseUrl.replace(/\/$/, '');
            // Force v1beta if not specified, mostly for new models
            if (!cleanBaseUrl.endsWith('/v1beta')) {
                // If ending in v1/v1alpha, strip? Or assume standard domain
                if (cleanBaseUrl.endsWith('/v1')) cleanBaseUrl = cleanBaseUrl.slice(0, -3);
                if (!cleanBaseUrl.endsWith('/v1beta')) cleanBaseUrl += '/v1beta';
            }

            // Construct Endpoint
            const targetModel = model || 'gemini-3-pro-image-preview';
            const url = `${cleanBaseUrl}/models/${targetModel}:generateContent?key=${apiKey}`;

            console.log(`[AI Proxy] Generating Image with ${targetModel} via ${url.replace(apiKey, '***')}`);

            // Construct Payload
            const payload = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseModalities: ["IMAGE"],
                    // Optional: Image params if supported by 'generationConfig' in this API version
                }
            };

            const rawResponse = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!rawResponse.ok) {
                const errText = await rawResponse.text();
                throw new Error(`Google API Error: ${rawResponse.status} - ${errText}`);
            }

            const data = await rawResponse.json();

            // Parse response for image (Standard Gemini Image format)
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
                throw new Error('No image data returned from AI (Response parsed successfully but no inlineData found)');
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
            // @ts-ignore
            const userId = req.userId;

            // 1. Check Quota
            if (userId) {
                const user = await UserModel.findById(userId);
                if (!user) return res.status(404).json({ error: 'User not found' });

                // Check limit
                if (user.quota.chatCount >= (user.quota.dailyChatLimit || 50)) {
                    return res.status(429).json({ error: 'Daily chat quota exceeded' });
                }

                // Increment Usage
                const newQuota = { ...user.quota, chatCount: (user.quota.chatCount || 0) + 1 };
                await UserModel.update(userId, { quota: newQuota });
            }

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
                // Check for 404 which might indicate "Model not found" or "API Version mismatch"
                if (rawRes.status === 404) {
                    throw new Error(`Model '${model || 'gemini-3-pro-preview'}' not found on this endpoint (${cleanBaseUrl}). Check API version or model name.`);
                }

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
    static async generateVideo(req: Request, res: Response) {
        // @ts-ignore
        const currentTaskId = req.body.taskId;

        try {
            const { prompt, model } = req.body;
            // @ts-ignore
            const userId = req.userId;

            // 1. Check Quota
            if (userId) {
                const user = await UserModel.findById(userId);
                if (!user) return res.status(404).json({ error: 'User not found' });

                if (user.quota.videoCount >= user.quota.videoLimit) {
                    return res.status(429).json({ error: 'Daily video quota exceeded' });
                }

                // Increment Usage
                const newQuota = { ...user.quota, videoCount: (user.quota.videoCount || 0) + 1 };
                await UserModel.update(userId, { quota: newQuota });
            }

            const settings = await SettingsModel.getSettings();
            if (!settings.aiConfig?.enabled) {
                return res.status(503).json({ error: 'AI service disabled' });
            }

            const keys = settings.aiConfig.googleKeys;
            const apiKey = pickKey(keys);
            if (!apiKey) return res.status(500).json({ error: 'No API Keys configured' });

            // Video Generation Logic (Veo / Sora)
            // Assuming Veo uses Labs API or Vertex AI.
            // For this Proxy implementation, we'll try to follow the structure of Google Labs API if documented,
            // OR use a mock/custom endpoint if Veo is not public.
            // --- BRANCH LOIC ---
            const targetModel = model || 'sora-video-landscape-10s'; // Default to Sora if not specified? 
            // Actually frontend defaults to 'sora-video-landscape-10s' for "Video" tab usually.

            let finalVideoUrl = null;

            // CASE A: VEO (Google)
            if (targetModel.includes('veo')) {
                const keys = settings.aiConfig.googleKeys;
                const apiKey = pickKey(keys);
                if (!apiKey) return res.status(500).json({ error: 'No Google API Keys configured' });

                let baseUrl = settings.aiConfig.baseUrl || 'https://generativelanguage.googleapis.com';
                let cleanBaseUrl = baseUrl.replace(/\/$/, '');
                if (cleanBaseUrl.endsWith('/models')) cleanBaseUrl = cleanBaseUrl.slice(0, -7);
                cleanBaseUrl = cleanBaseUrl.replace(/\/$/, '');
                if (!cleanBaseUrl.endsWith('/v1beta')) cleanBaseUrl += '/v1beta';

                const url = `${cleanBaseUrl}/models/${targetModel}:generateVideos?key=${apiKey}`;
                const payload = {
                    prompt: prompt,
                    config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
                };

                const initRes = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!initRes.ok) {
                    const errText = await initRes.text();
                    throw new Error(`Veo Init Failed: ${initRes.status} - ${errText}`);
                }

                const initData = await initRes.json();
                let operation = initData;
                if (!operation.name) throw new Error("Invalid Veo Response: No operation name");

                const operationName = operation.name;
                const pollUrl = `${cleanBaseUrl}/${operationName}?key=${apiKey}`;

                let attempts = 0;
                while (attempts < 30) {
                    await new Promise(r => setTimeout(r, 2000));
                    attempts++;
                    const pollRes = await fetch(pollUrl);
                    const pollData = await pollRes.json();
                    if (pollData.done) {
                        if (pollData.error) throw new Error(`Video Gen Failed: ${pollData.error.message}`);
                        if (pollData.response?.generatedVideos?.[0]?.video?.uri) finalVideoUrl = pollData.response.generatedVideos[0].video.uri;
                        else if (pollData.result?.generatedVideos?.[0]?.video?.uri) finalVideoUrl = pollData.result.generatedVideos[0].video.uri;
                        break;
                    }
                }
                if (!finalVideoUrl) throw new Error("Video generation timed out.");

                // Key required for Veo
                finalVideoUrl = `${finalVideoUrl}&key=${apiKey}`;
            }

            // CASE B: SORA / CUSTOM (Sora2API)
            else {
                // Use Hardcoded Fallback for now as user relies on 'constants.ts' default
                // TODO: Add to System Settings later
                const SORA_BASE_URL = 'https://sora2api-584967513363.us-west1.run.app/v1';
                const SORA_API_KEY = 'han1234';
                // Note: In production, these should be env vars or settings.

                const endpoint = `${SORA_BASE_URL}/chat/completions`;

                // Construct Payload (OpenAI Compatible)
                const payload = {
                    model: targetModel,
                    messages: [{ role: 'user', content: prompt }], // Simple text-to-video
                    stream: true
                };

                console.log(`[AI Proxy-Sora] Generating: ${prompt} via ${endpoint}`);

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SORA_API_KEY}`
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errText = await response.text();
                    console.error('[AI Proxy-Sora] API Error:', response.status, errText);
                    throw new Error(`Sora API Error: ${response.status} - ${errText}`);
                }

                if (!response.body) throw new Error("No response body for stream");

                // Parse Stream for URL
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let accumulatedContent = '';
                let chunkCount = 0;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    chunkCount++;
                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;

                    if (chunkCount < 5) console.log(`[AI Proxy-Sora] Chunk ${chunkCount}:`, chunk.substring(0, 100));

                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep incomplete line

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
                            try {
                                const json = JSON.parse(trimmed.slice(6));
                                // 1. Accumulate Content
                                const content = json.choices?.[0]?.delta?.content || '';
                                if (content) accumulatedContent += content;

                                // 2. Check Direct Fields
                                if (json.error) {
                                    console.error("[AI Proxy-Sora] Stream Error:", json.error);
                                    throw new Error(`Sora2API Stream Error: ${json.error.message || JSON.stringify(json.error)}`);
                                }
                                if (json.url) finalVideoUrl = json.url;
                                if (json.video_url) finalVideoUrl = json.video_url;
                                if (json.data && json.data.url) finalVideoUrl = json.data.url;
                            } catch (e: any) {
                                // Re-throw if it's our explicit error
                                if (e.message.startsWith('Sora2API Stream Error')) throw e;
                                /* ignore parse error */
                            }
                        }
                    }
                }

                // 3. Extract from Accumulated Content if not found directly
                if (!finalVideoUrl && accumulatedContent) {
                    console.log('[AI Proxy-Sora] Accumulated Content Length:', accumulatedContent.length);
                    // Match http/https urls
                    const match = accumulatedContent.match(/(https?:\/\/[^\s<>"'()]+)/);
                    if (match) {
                        finalVideoUrl = match[0];
                    }
                }

                if (!finalVideoUrl) {
                    // Fallback: Check leftover buffer
                    if (buffer.includes('http')) {
                        const match = buffer.match(/(https?:\/\/[^\s<>"'()]+)/);
                        if (match) finalVideoUrl = match[0];
                    }
                }

                if (!finalVideoUrl) {
                    console.error("[AI Proxy-Sora] Full Accumulated Content:", accumulatedContent);
                    throw new Error("Could not extract Video URL from Sora stream. (Content length: " + accumulatedContent.length + ")");
                }

                // Clean URL (remove trailing punctuation if any)
                finalVideoUrl = finalVideoUrl.replace(/[.,;!?]$/, "");
                console.log('[AI Proxy-Sora] Success URL:', finalVideoUrl);
            }

            // --- PROXY MODIFICATION ---
            const proxyUrl = `${req.protocol}://${req.get('host')}/api/ai/proxy?url=${encodeURIComponent(finalVideoUrl)}`;

            // --- PERSISTENCE: Save to DB if taskId is present ---
            if (currentTaskId) {
                await TaskModel.update(currentTaskId, {
                    status: 'COMPLETED',
                    videoUrl: proxyUrl, // Store the PROXY URL so persistent history also works through proxy
                    completedAt: new Date()
                });
                console.log(`[AI Controller] Updated Task ${currentTaskId} to COMPLETED`);
            }

            return res.json({ videoUrl: proxyUrl });

        } catch (error: any) {
            console.error('AI Generate Video Error:', error);

            // --- PERSISTENCE: Save Error to DB ---
            if (currentTaskId) {
                await TaskModel.update(currentTaskId, {
                    status: 'FAILED',
                    error: error.message || 'Generation failed',
                    completedAt: new Date()
                });
            }

            // Prevent res.json if already sent? (Express handles this usually but good to be safe if stream was piped - here we didn't pipe)
            if (!res.headersSent) {
                res.status(500).json({ error: error.message || 'Video generation failed' });
            }
        }
    }
}
