import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, GenerationTask, GenerationStatus } from '../types';
import { UploadIcon, SparklesIcon, ImageIcon } from './Icons';
import { apiService } from '../services/apiService';
import { generateWithChat, prepareGeminiHistory, fileToGenerativePart } from '../services/googleService';
import ReactMarkdown from 'react-markdown';

interface ChatInterfaceProps {
    task: GenerationTask;
    apiKey: string;
    isAuthenticated?: boolean;
    onUpdateTask: (task: GenerationTask) => void;
    onGenerateImage: (prompt: string) => Promise<string | null>;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ task, apiKey, isAuthenticated, onUpdateTask, onGenerateImage }) => {
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [attachedImage, setAttachedImage] = useState<{ file: File, preview: string } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [task.messages]);

    const handleSendMessage = async () => {
        if ((!input.trim() && !attachedImage) || isSending) return;

        const currentInput = input;
        const currentImage = attachedImage;

        // Auto Connect Logic check (if implemented elsewhere, but here we just error or fallback)
        const hasClientKey = apiKey && apiKey.length > 0;
        const canUseProxy = isAuthenticated;

        if (!hasClientKey && !canUseProxy) {
            alert("请先配置 API Key 或登录以使用聊天功能。");
            return;
        }

        // Clear input immediately
        setInput('');
        setAttachedImage(null);
        setIsSending(true);

        // 1. Create User Message
        const userMessage: ChatMessage = {
            role: 'user',
            content: currentInput,
            timestamp: Date.now(),
            attachments: currentImage ? [{
                type: 'image',
                url: currentImage.preview,
                mimeType: currentImage.file.type
            }] : undefined
        };

        // 2. Create Placeholder AI Message
        const aiPlaceholder: ChatMessage = {
            role: 'model',
            content: '',
            timestamp: Date.now() + 1,
            isGenerating: true
        };

        // Update Task locally
        const updatedMessages = [...(task.messages || []), userMessage, aiPlaceholder];
        const updatedTask = {
            ...task,
            messages: updatedMessages
        };
        onUpdateTask(updatedTask);

        try {
            const realHistory = task.messages || [];
            let result;

            if (canUseProxy) {
                // Priority 1: Authenticated User -> Use Backend Proxy (Stable, No GFW issues)
                // 1. Convert History
                const historyContents = prepareGeminiHistory(realHistory);

                // 2. Prepare Current Message
                if (currentImage) {
                    // console.warn("Image upload not fully supported in Proxy mode yet.");
                }

                // Call backend
                const res = await apiService.chatWithAi(historyContents, userMessage.content, 'gemini-3-pro-preview');
                result = { text: res.text, toolCall: undefined };

            } else if (hasClientKey) {
                // Priority 2: Guest with Key -> Use Client Side Direct Call
                result = await generateWithChat({
                    history: realHistory,
                    newMessage: userMessage.content,
                    image: currentImage?.file,
                    apiKey
                });
            } else {
                // Should be caught by validation check above, but fallback
                throw new Error("Impossible state: No Auth and No Key");
            }

            // 4. Handle Tool Calls
            let finalContent = result.text;
            let toolCall = result.toolCall;
            let toolResult = undefined;

            if (toolCall && toolCall.name === 'generate_image') {
                const promptToGen = toolCall.args.prompt;

                const toolMsgIndex = updatedMessages.length - 1;
                updatedMessages[toolMsgIndex] = {
                    ...updatedMessages[toolMsgIndex],
                    toolCall: { id: toolCall.id, name: toolCall.name, args: toolCall.args }
                };
                onUpdateTask({ ...task, messages: [...updatedMessages] });

                try {
                    const imageUrl = await onGenerateImage(promptToGen);
                    if (imageUrl) {
                        toolResult = { id: toolCall.id, result: { success: true, imageUrl } };
                    } else {
                        toolResult = { id: toolCall.id, result: { success: false, error: "Generation failed" } };
                    }
                } catch (err) {
                    toolResult = { id: toolCall.id, result: { success: false, error: String(err) } };
                }
            }

            // 5. Final Update
            const finalAiMessage: ChatMessage = {
                role: 'model',
                content: finalContent || (toolCall ? "" : "Received empty response"),
                timestamp: Date.now(),
                isGenerating: false,
                toolCall: toolCall ? { id: toolCall.id, name: toolCall.name, args: toolCall.args } : undefined,
                toolResult: toolResult
            };

            const finalMessages = [...updatedMessages];
            finalMessages[finalMessages.length - 1] = finalAiMessage;

            onUpdateTask({
                ...task,
                messages: finalMessages,
                status: GenerationStatus.COMPLETED
            });

        } catch (error: any) {
            console.error("Chat Error:", error);
            const finalMessages = [...updatedMessages];
            finalMessages[finalMessages.length - 1] = {
                role: 'model',
                content: `Error: ${error.message || 'Failed to generate response'}`,
                timestamp: Date.now(),
                isGenerating: false
            };
            onUpdateTask({
                ...task,
                messages: finalMessages,
                status: GenerationStatus.FAILED
            });
        } finally {
            setIsSending(false);
        }
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                setAttachedImage({
                    file,
                    preview: ev.target?.result as string
                });
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="flex flex-col h-full bg-black text-white rounded-2xl overflow-hidden border border-zinc-800">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5 text-pink-500" />
                    Gemini Chat
                </h3>
                <span className="text-xs text-zinc-500 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">Model: gemini-3-pro-preview</span>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                {(!task.messages || task.messages.length === 0) && (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500 opacity-50">
                        <SparklesIcon className="w-12 h-12 mb-2" />
                        <p>开始新的对话...</p>
                    </div>
                )}

                {task.messages?.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 ${msg.role === 'user'
                            ? 'bg-gradient-to-br from-pink-600 to-rose-600 text-white rounded-tr-sm'
                            : 'bg-zinc-800 text-zinc-200 rounded-tl-sm border border-zinc-700'
                            }`}>

                            {/* Attachments */}
                            {msg.attachments?.map((att, i) => (
                                <div key={i} className="mb-3 rounded-lg overflow-hidden border border-white/20">
                                    <img src={att.url} alt="Attachment" className="max-w-[200px] max-h-[200px] object-cover" />
                                </div>
                            ))}

                            {/* Text Content */}
                            {msg.isGenerating ? (
                                <div className="flex gap-1 h-6 items-center px-2">
                                    <div className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            ) : (
                                <div className="prose prose-invert prose-sm max-w-none">
                                    <ReactMarkdown children={msg.content} />
                                </div>
                            )}

                            {/* Tool Calls (e.g. Generating Image) */}
                            {msg.toolCall && (
                                <div className="mt-3 p-3 bg-black/30 rounded-lg border border-white/10 text-xs font-mono w-full">
                                    <div className="flex items-center gap-2 text-pink-300 mb-1">
                                        <ImageIcon className="w-3 h-3" />
                                        <span>Generating Image...</span>
                                    </div>
                                    <div className="text-zinc-500 truncate">Prompt: {msg.toolCall.args.prompt}</div>
                                </div>
                            )}

                            {/* Tool Results (The Generated Image) */}
                            {msg.toolResult && msg.toolResult.result.imageUrl && (
                                <div className="mt-3 rounded-lg overflow-hidden border border-zinc-700 shadow-lg">
                                    <img src={msg.toolResult.result.imageUrl} alt="Generated" className="w-full h-auto" />
                                </div>
                            )}
                            {msg.toolResult && msg.toolResult.result.error && (
                                <div className="mt-3 p-2 bg-red-900/20 text-red-300 text-xs rounded border border-red-900/50">
                                    Error: {msg.toolResult.result.error}
                                </div>
                            )}

                        </div>
                        <span className="text-[10px] text-zinc-600 mt-1 px-1">
                            {msg.role === 'user' ? 'You' : 'Gemini'} • {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-zinc-900 border-t border-zinc-800">
                {attachedImage && (
                    <div className="mb-3 inline-block relative group">
                        <img src={attachedImage.preview} alt="Preview" className="h-16 w-16 object-cover rounded-lg border border-zinc-700" />
                        <button
                            onClick={() => setAttachedImage(null)}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            ×
                        </button>
                    </div>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors shrink-0"
                        title="Upload Image"
                    >
                        <UploadIcon className="w-6 h-6" />
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageSelect}
                    />

                    <div className="flex-1 relative">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            placeholder="Type a message or ask to generate an image..."
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-4 pr-12 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-600/50 resize-none h-[52px] max-h-[150px]"
                            disabled={isSending}
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={(!input.trim() && !attachedImage) || isSending}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-pink-600 text-white rounded-lg hover:bg-pink-500 disabled:opacity-50 disabled:hover:bg-pink-600 transition-colors"
                        >
                            <SparklesIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;
