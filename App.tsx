
import React, { useState, useRef, useEffect } from 'react';
import { 
  GenerationConfig, 
  GenerationTask, 
  GenerationStatus,
  AppSettings
} from './types';
import { DEFAULT_CUSTOM_CONFIG } from './constants';
import { generateWithCustomApi } from './services/customService';
import { generateImageWithGoogle } from './services/googleService';
import { SparklesIcon, UploadIcon, VideoIcon, HistoryIcon, PlayIcon, SettingsIcon, ImageIcon } from './components/Icons';

const App = () => {
  // --- State ---
  // 配置状态
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [googleBaseUrl, setGoogleBaseUrl] = useState<string>(''); 
  const [showConfig, setShowConfig] = useState(false);
  const [activeTab, setActiveTab] = useState<'video' | 'image'>('video');

  // 视频生成 - 输入区域状态
  const [prompt, setPrompt] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('sora-video-landscape-10s');
  
  // 视频生成 - 辅助AI生图状态 (作为参考图)
  const [isRefImageMode, setIsRefImageMode] = useState(false); 
  const [refImagePrompt, setRefImagePrompt] = useState('');
  const [isGeneratingRefImage, setIsGeneratingRefImage] = useState(false);

  // 独立图片生成 - 输入区域状态
  const [standaloneImagePrompt, setStandaloneImagePrompt] = useState('');
  // 新增：图片生成模型选择
  const [selectedImageModel, setSelectedImageModel] = useState<string>('gemini-3-pro-image-preview');

  // 任务管理状态
  const [tasks, setTasks] = useState<GenerationTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化：检查 AI Studio Auth 状态 和 Base URL
  useEffect(() => {
    const checkAuth = async () => {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setIsGoogleConnected(hasKey);
      }
    };
    checkAuth();

    const savedUrl = localStorage.getItem('google_base_url');
    if (savedUrl) setGoogleBaseUrl(savedUrl);
  }, []);

  // Auth Handler
  const handleConnectGoogle = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success after dialog interaction to avoid race condition
      setIsGoogleConnected(true);
    } else {
      alert("AI Studio 环境未检测到。请确保在 Google AI Studio/IDX 环境中运行。");
    }
  };

  // 保存 Base URL
  const handleSaveBaseUrl = (url: string) => {
    setGoogleBaseUrl(url);
    localStorage.setItem('google_base_url', url);
  };

  // 获取当前正在查看的任务对象
  const activeTask = tasks.find(t => t.id === activeTaskId) || null;

  // --- Handlers ---

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
      setIsRefImageMode(false); // 切回上传模式
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 逻辑 A：生成作为视频参考图的图片
  const handleGenerateRefImage = async () => {
    if (!refImagePrompt) {
      alert("请输入图片描述");
      return;
    }
    
    // Auth Check
    if (!isGoogleConnected) {
       await handleConnectGoogle();
       // Don't proceed immediately, let user click again after connecting
       return;
    }

    setIsGeneratingRefImage(true);
    try {
      // 使用 Gemini 3 Pro Image (Official)
      const base64Url = await generateImageWithGoogle(
        refImagePrompt, 
        // No API Key passed
        'gemini-3-pro-image-preview',
        googleBaseUrl 
      );
      
      // 将 Base64 转换为 File 对象，以便兼容现有的上传逻辑
      const res = await fetch(base64Url);
      const blob = await res.blob();
      const file = new File([blob], "ai_ref_image.png", { type: "image/png" });
      
      setSelectedImage(file);
      setIsRefImageMode(false); // 生成成功后切回预览
      setRefImagePrompt(''); // 清空图片提示词
    } catch (error: any) {
      alert(`图片生成失败: ${error.message}`);
      // If error is related to Auth, reset state
      if (error.message.includes("API Key")) {
        setIsGoogleConnected(false);
      }
    } finally {
      setIsGeneratingRefImage(false);
    }
  };

  // 逻辑 B：独立生成图片任务 (新 Tab 功能)
  const handleGenerateStandaloneImage = async () => {
    if (!standaloneImagePrompt) {
      alert("请输入图片描述");
      return;
    }

    // Auth Check
    if (!isGoogleConnected) {
       await handleConnectGoogle();
       return;
    }

    // 确定使用的模型
    const finalModel = selectedImageModel;
    if (!finalModel) {
       alert("请指定模型名称");
       return;
    }

    // 1. 创建新任务
    const newTask: GenerationTask = {
      id: Date.now().toString(),
      type: 'IMAGE',
      status: GenerationStatus.GENERATING,
      prompt: standaloneImagePrompt,
      model: finalModel,
      createdAt: Date.now(),
    };

    setTasks(prev => [newTask, ...prev]);
    setActiveTaskId(newTask.id);
    setStandaloneImagePrompt('');

    // 2. 执行生成
    try {
      const base64Url = await generateImageWithGoogle(
        newTask.prompt, 
        // No API Key passed
        finalModel,
        googleBaseUrl
      );
      
      // 转换为 Blob URL 以优化内存展示
      const res = await fetch(base64Url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      setTasks(prev => prev.map(t => 
        t.id === newTask.id 
          ? { 
              ...t, 
              status: GenerationStatus.COMPLETED, 
              imageUrl: objectUrl,
              completedAt: Date.now() 
            } 
          : t
      ));

    } catch (err: any) {
      setTasks(prev => prev.map(t => 
        t.id === newTask.id 
          ? { 
              ...t, 
              status: GenerationStatus.FAILED, 
              error: err.message || "图片生成失败",
              completedAt: Date.now()
            } 
          : t
      ));
      if (err.message && err.message.includes("API Key")) {
        setIsGoogleConnected(false);
      }
    }
  };

  // 逻辑 C：生成视频任务
  const handleGenerateVideo = () => {
    if (!prompt && !selectedImage) {
      alert("请输入提示词或上传一张图片");
      return;
    }

    const newTaskImagePreview = selectedImage ? URL.createObjectURL(selectedImage) : undefined;
    
    // 1. 创建新任务对象
    const newTask: GenerationTask = {
      id: Date.now().toString(),
      type: 'VIDEO',
      status: GenerationStatus.GENERATING,
      prompt: prompt || (selectedImage ? `图生视频: ${selectedImage.name}` : '未命名任务'),
      model: selectedModel,
      createdAt: Date.now(),
      imagePreviewUrl: newTaskImagePreview
    };

    // 2. 更新状态：加入任务列表，并自动选中当前新任务
    setTasks(prev => [newTask, ...prev]);
    setActiveTaskId(newTask.id);

    // 3. 准备API配置
    const apiGenConfig: GenerationConfig = {
      prompt,
      image: selectedImage || undefined,
      model: selectedModel
    };

    // 4. 清空输入框
    setPrompt('');
    clearImage();

    // 5. 触发异步请求
    runGenerationInBackground(newTask.id, apiGenConfig);
  };

  // 后台执行视频生成逻辑
  const runGenerationInBackground = async (taskId: string, config: GenerationConfig) => {
    try {
      const videoUrl = await generateWithCustomApi(config, DEFAULT_CUSTOM_CONFIG);
      setTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { 
              ...t, 
              status: GenerationStatus.COMPLETED, 
              videoUrl: videoUrl,
              completedAt: Date.now() 
            } 
          : t
      ));
    } catch (err: any) {
      console.error(err);
      setTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { 
              ...t, 
              status: GenerationStatus.FAILED, 
              error: err.message || "生成失败，未知错误",
              completedAt: Date.now()
            } 
          : t
      ));
    }
  };

  const formatDuration = (start: number, end?: number) => {
    if (!end) return '...';
    const seconds = ((end - start) / 1000).toFixed(1);
    return `${seconds}秒`;
  };

  const videoModels = [
    { id: 'sora-video-landscape-10s', name: '横屏 (16:9) - 10秒' },
    { id: 'sora-video-landscape-15s', name: '横屏 (16:9) - 15秒' },
    { id: 'sora-video-portrait-10s', name: '竖屏 (9:16) - 10秒' },
    { id: 'sora-video-portrait-15s', name: '竖屏 (9:16) - 15秒' },
  ];

  const imageModels = [
    { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image (官方SDK)' },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-black text-zinc-100 font-sans selection:bg-purple-500/30">
      
      {/* Sidebar */}
      <aside className="w-full md:w-80 bg-zinc-950 border-r border-zinc-900 flex flex-col h-[35vh] md:h-screen z-20">
        <div className="p-5 border-b border-zinc-900 flex items-center gap-3 bg-zinc-950 sticky top-0 z-10">
          <div className="p-2 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg shadow-lg shadow-purple-900/20">
            <SparklesIcon className="text-white w-5 h-5" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">Sora 创意工坊</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider px-2 mb-2">
            <HistoryIcon className="w-4 h-4" />
            <span>创作历史</span>
          </div>
          
          {tasks.length === 0 ? (
            <div className="text-center py-10 px-4">
              <p className="text-zinc-600 text-sm">暂无任务</p>
              <p className="text-zinc-700 text-xs mt-1">开始生成视频或图片吧</p>
            </div>
          ) : (
            tasks.map(task => (
              <button
                key={task.id}
                onClick={() => setActiveTaskId(task.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all group relative overflow-hidden ${
                  activeTask?.id === task.id 
                    ? 'bg-zinc-900 border-purple-600/50 shadow-lg shadow-purple-900/10' 
                    : 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                }`}
              >
                <div className="flex justify-between items-start mb-2 relative z-10">
                  <div className="flex items-center gap-2">
                    {/* Icon based on Type */}
                    {task.type === 'VIDEO' ? (
                       <VideoIcon className="w-3 h-3 text-purple-400" />
                    ) : (
                       <ImageIcon className="w-3 h-3 text-pink-400" />
                    )}

                    {task.status === GenerationStatus.GENERATING && (
                      <div className="flex items-center gap-1.5 bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded text-[10px] font-bold border border-yellow-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></div>
                        生成中
                      </div>
                    )}
                    {task.status === GenerationStatus.COMPLETED && (
                       <div className="flex gap-2">
                        <span className="bg-green-500/10 text-green-500 px-2 py-0.5 rounded text-[10px] font-bold border border-green-500/20">完成</span>
                        <span className="text-[10px] text-zinc-500 flex items-center">⏱ {formatDuration(task.createdAt, task.completedAt)}</span>
                       </div>
                    )}
                    {task.status === GenerationStatus.FAILED && (
                       <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-[10px] font-bold border border-red-500/20">失败</span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    {new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex gap-3">
                  {task.imagePreviewUrl && (
                    <img src={task.imagePreviewUrl} alt="ref" className="w-8 h-8 rounded object-cover border border-zinc-700 flex-shrink-0" />
                  )}
                  {task.type === 'IMAGE' && task.imageUrl && (
                    <img src={task.imageUrl} alt="res" className="w-8 h-8 rounded object-cover border border-zinc-700 flex-shrink-0" />
                  )}
                  <p className="text-sm text-zinc-300 line-clamp-2 font-medium leading-snug relative z-10">
                    {task.prompt}
                  </p>
                </div>
                {task.status === GenerationStatus.GENERATING && (
                   <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-purple-600 to-indigo-600 animate-[width_20s_ease-out_forwards] w-0"></div>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-[65vh] md:h-screen overflow-hidden relative">
        
        {/* Top Bar */}
        <header className="h-14 border-b border-zinc-900 flex items-center justify-between px-6 bg-black/80 backdrop-blur-md z-10 sticky top-0">
          <div className="flex items-center gap-2">
             <span className="text-zinc-400 text-sm font-medium">AI 创意控制台</span>
          </div>
          <div className="flex items-center gap-3">
             <button 
               onClick={!isGoogleConnected ? handleConnectGoogle : () => setShowConfig(!showConfig)}
               className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-2 ${
                 isGoogleConnected 
                   ? 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20' 
                   : 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600'
               }`}
             >
               <SettingsIcon className="w-3 h-3" />
               {isGoogleConnected ? 'Google 已连接 (点击配置代理)' : '连接 Google 账号'}
             </button>
          </div>
        </header>

        {/* Workspace */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Left Column: Input Area */}
          <div className="w-full md:w-1/2 lg:w-[40%] border-r border-zinc-900 flex flex-col bg-black">
             
             {/* Tab Switcher */}
             <div className="flex border-b border-zinc-900">
               <button 
                 onClick={() => setActiveTab('video')}
                 className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors relative ${activeTab === 'video' ? 'text-white bg-zinc-900/50' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/20'}`}
               >
                 <VideoIcon className="w-4 h-4" />
                 视频生成
                 {activeTab === 'video' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></div>}
               </button>
               <button 
                 onClick={() => setActiveTab('image')}
                 className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors relative ${activeTab === 'image' ? 'text-white bg-zinc-900/50' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/20'}`}
               >
                 <ImageIcon className="w-4 h-4" />
                 图片生成
                 {activeTab === 'image' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-600"></div>}
               </button>
             </div>

             <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-xl mx-auto space-y-6">
                  
                  {/* Google Configuration (Hidden by default, showed if connected + clicked) */}
                  {showConfig && isGoogleConnected && (
                    <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-white">Google 服务配置</h3>
                        <button onClick={() => setShowConfig(false)} className="text-xs text-zinc-500 hover:text-white">关闭</button>
                      </div>
                      
                      <div className="p-2 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-400">
                        ✅ 您的 Google 账号已连接。API Key 将自动管理。
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-zinc-400">API Base URL (可选)</label>
                        <input 
                          type="text"
                          value={googleBaseUrl}
                          onChange={(e) => handleSaveBaseUrl(e.target.value)}
                          placeholder="https://generativelanguage.googleapis.com"
                          className="w-full bg-black border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                        />
                        <p className="text-[10px] text-zinc-600">
                          默认为 Google 官方地址。如使用中转(OneAPI)，请填写代理地址。<br/>
                          <span className="text-yellow-500/80">注意：部分中转站可能需要手动加上 /google 后缀</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ============ VIDEO TAB CONTENT ============ */}
                  {activeTab === 'video' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      <div>
                        <h2 className="text-lg font-bold text-white mb-1">新建视频任务</h2>
                        <p className="text-xs text-zinc-500">输入描述，AI 将为您生成视频。</p>
                      </div>

                      {/* Text Prompt */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-zinc-400">视频提示词 (Prompt)</label>
                        <textarea
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder="请详细描述您想生成的视频画面..."
                          className="w-full h-32 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-600/50 resize-none transition-all"
                        />
                      </div>

                      {/* Image Upload / AI Ref Generation */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="block text-sm font-medium text-zinc-400">参考图 (可选)</label>
                          <div className="flex gap-2 text-xs">
                              {isRefImageMode ? (
                                <button onClick={() => setIsRefImageMode(false)} className="text-zinc-500 hover:text-white">返回上传</button>
                              ) : (
                                <>
                                  {selectedImage ? (
                                    <button onClick={clearImage} className="text-red-400 hover:text-red-300">移除图片</button>
                                  ) : (
                                    <button onClick={() => setIsRefImageMode(true)} className="text-purple-400 hover:text-purple-300 flex items-center gap-1">
                                      <SparklesIcon className="w-3 h-3" />
                                      AI 生成参考图
                                    </button>
                                  )}
                                </>
                              )}
                          </div>
                        </div>
                        
                        {/* Ref Mode 1: Image Generation */}
                        {isRefImageMode ? (
                            <div className="border border-purple-500/30 bg-purple-500/5 rounded-xl p-4 space-y-3">
                              <label className="text-xs font-bold text-purple-300">使用 Gemini 3 Pro 生成参考图</label>
                              <textarea
                                  value={refImagePrompt}
                                  onChange={(e) => setRefImagePrompt(e.target.value)}
                                  placeholder="描述您想生成的图片内容..."
                                  className="w-full h-20 bg-black/50 border border-purple-500/20 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-purple-500"
                              />
                              <button
                                onClick={handleGenerateRefImage}
                                disabled={isGeneratingRefImage}
                                className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                              >
                                {isGeneratingRefImage ? '正在生成...' : (isGoogleConnected ? '立即生成并使用' : '请先连接 Google 账号')}
                                {!isGeneratingRefImage && <SparklesIcon className="w-3 h-3" />}
                              </button>
                            </div>
                        ) : (
                          /* Ref Mode 2: Upload */
                          <div 
                              onClick={() => fileInputRef.current?.click()}
                              className={`relative group cursor-pointer border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all ${
                                selectedImage ? 'border-purple-500/50 bg-purple-500/5' : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/30'
                              }`}
                          >
                              <input 
                                ref={fileInputRef}
                                type="file" 
                                accept="image/*" 
                                onChange={handleImageSelect}
                                className="hidden" 
                              />
                              
                              {selectedImage ? (
                                <div className="relative w-full h-32 bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center">
                                  <img 
                                    src={URL.createObjectURL(selectedImage)} 
                                    alt="Preview" 
                                    className="h-full object-contain"
                                  />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <span className="text-xs text-white">点击更换</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center">
                                  <UploadIcon className="w-8 h-8 text-zinc-500 mb-2 group-hover:text-zinc-400 transition-colors" />
                                  <p className="text-xs text-zinc-500">点击上传图片 (支持拖拽)</p>
                                </div>
                              )}
                          </div>
                        )}
                      </div>

                      {/* Model Selection */}
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-zinc-500 uppercase">视频模型配置</label>
                        <select 
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-600/50"
                        >
                          {videoModels.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={handleGenerateVideo}
                        className="w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all shadow-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-900/20 hover:shadow-purple-900/40 transform hover:-translate-y-0.5 active:translate-y-0"
                      >
                        <VideoIcon className="w-5 h-5" />
                        开始生成视频
                      </button>
                    </div>
                  )}

                  {/* ============ IMAGE TAB CONTENT ============ */}
                  {activeTab === 'image' && (
                     <div className="space-y-6 animate-in fade-in duration-300">
                        <div>
                          <h2 className="text-lg font-bold text-white mb-1">新建图片任务</h2>
                          <p className="text-xs text-zinc-500">使用 Gemini 3 Pro 生成高质量图片。</p>
                        </div>

                        {/* Text Prompt */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-zinc-400">图片描述 (Prompt)</label>
                          <textarea
                            value={standaloneImagePrompt}
                            onChange={(e) => setStandaloneImagePrompt(e.target.value)}
                            placeholder="请描述您想生成的图片内容，例如：一只在霓虹灯下奔跑的赛博朋克猫..."
                            className="w-full h-40 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-600/50 resize-none transition-all"
                          />
                        </div>

                         {/* Image Model Selection */}
                        <div className="space-y-2">
                           <label className="block text-xs font-medium text-zinc-500 uppercase">图片模型配置</label>
                           <select 
                              value={selectedImageModel}
                              onChange={(e) => setSelectedImageModel(e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-pink-600/50"
                           >
                              {imageModels.map(m => (
                                 <option key={m.id} value={m.id}>
                                    {m.name}
                                 </option>
                              ))}
                           </select>
                        </div>

                         {/* Action Button */}
                        <button
                          onClick={handleGenerateStandaloneImage}
                          className="w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all shadow-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-pink-900/20 hover:shadow-pink-900/40 transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                          <ImageIcon className="w-5 h-5" />
                          {isGoogleConnected ? '开始生成图片' : '连接 Google 账号以开始'}
                        </button>
                     </div>
                  )}

                </div>
             </div>
          </div>

          {/* Right Column: Preview Area */}
          <div className="w-full md:w-1/2 lg:w-[60%] bg-zinc-950 flex flex-col items-center justify-center p-6 relative border-l border-zinc-900/50">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/40 to-zinc-950 -z-10"></div>
             
             {activeTask ? (
               <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col h-full justify-center">
                  
                  {/* Task Header info */}
                  <div className="mb-4">
                    <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-3">
                        {activeTask.status === GenerationStatus.COMPLETED && "✅ 生成成功"}
                        {activeTask.status === GenerationStatus.FAILED && "❌ 生成失败"}
                        {activeTask.status === GenerationStatus.GENERATING && "⏳ 正在生成中..."}
                    </h2>
                    <div className="flex gap-4 text-xs text-zinc-500">
                      <span className={`px-2 py-0.5 rounded border ${activeTask.type === 'VIDEO' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-pink-500/10 border-pink-500/20 text-pink-400'}`}>
                        {activeTask.type === 'VIDEO' ? '视频任务' : '图片任务'}
                      </span>
                      <p>ID: {activeTask.id}</p>
                      <p>Model: {activeTask.model}</p>
                      {activeTask.completedAt && (
                        <p className="text-zinc-400">总耗时: {formatDuration(activeTask.createdAt, activeTask.completedAt)}</p>
                      )}
                    </div>
                  </div>

                  {/* Main Display Box */}
                  <div className="relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 group flex-shrink-0 min-h-[300px] flex items-center justify-center">
                    
                    {/* CASE 1: Completed VIDEO */}
                    {activeTask.status === GenerationStatus.COMPLETED && activeTask.type === 'VIDEO' && activeTask.videoUrl && (
                      <video 
                        src={activeTask.videoUrl} 
                        controls 
                        autoPlay 
                        loop
                        className="w-full h-full object-contain max-h-[60vh]"
                      />
                    )}

                    {/* CASE 2: Completed IMAGE */}
                    {activeTask.status === GenerationStatus.COMPLETED && activeTask.type === 'IMAGE' && activeTask.imageUrl && (
                      <img 
                        src={activeTask.imageUrl} 
                        alt="Generated Result"
                        className="w-full h-full object-contain max-h-[60vh]"
                      />
                    )}

                    {/* CASE 3: Generating */}
                    {activeTask.status === GenerationStatus.GENERATING && (
                       <div className="flex flex-col items-center justify-center p-12 text-center">
                          <div className={`w-16 h-16 border-4 rounded-full animate-spin mb-6 ${activeTask.type === 'VIDEO' ? 'border-purple-500/30 border-t-purple-500' : 'border-pink-500/30 border-t-pink-500'}`}></div>
                          <p className="text-lg font-medium text-white animate-pulse">正在渲染{activeTask.type === 'VIDEO' ? '视频' : '图片'}...</p>
                          <p className="text-sm text-zinc-500 mt-2 max-w-md">
                            您的任务正在云端处理中，请耐心等待。
                          </p>
                          <div className="mt-6 px-4 py-2 bg-zinc-900 rounded-lg border border-zinc-800">
                             <span className="text-xs text-zinc-400">Prompt: </span>
                             <span className="text-xs text-zinc-300 italic">"{activeTask.prompt.substring(0, 50)}..."</span>
                          </div>
                       </div>
                    )}

                    {/* CASE 4: Failed */}
                    {activeTask.status === GenerationStatus.FAILED && (
                       <div className="flex flex-col items-center justify-center p-12 text-center w-full">
                          <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                             <span className="text-3xl text-red-500">⚠️</span>
                          </div>
                          <h3 className="text-lg font-bold text-red-400 mb-2">生成出错</h3>
                          <p className="text-zinc-400 text-sm mb-4">API 返回了以下错误信息：</p>
                          <div className="w-full max-w-lg bg-red-950/30 border border-red-900/50 rounded-lg p-4 text-left overflow-x-auto">
                            <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono break-all">
                              {activeTask.error || "未知错误，请检查网络连接或 API 配置。"}
                            </pre>
                          </div>
                       </div>
                    )}
                  </div>

                  {/* Footer Info / Actions */}
                  {activeTask.status === GenerationStatus.COMPLETED && (
                    <div className="mt-6 space-y-4">
                      {/* URL Box (Only for Video usually, but useful for debug) */}
                      {activeTask.type === 'VIDEO' && activeTask.videoUrl && (
                        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4">
                          <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2 block">视频真实链接 (URL)</label>
                          <div className="flex gap-2">
                            <input 
                              readOnly
                              value={activeTask.videoUrl}
                              className="flex-1 bg-black border border-zinc-800 rounded px-3 py-2 text-xs text-blue-400 font-mono focus:outline-none focus:border-blue-500/50"
                              onClick={(e) => e.currentTarget.select()}
                            />
                            <button 
                              onClick={() => {
                                  navigator.clipboard.writeText(activeTask.videoUrl || '');
                                  alert('链接已复制');
                              }}
                              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs text-white rounded transition-colors"
                            >
                              复制
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center">
                        <p className="text-zinc-500 text-sm max-w-[70%] line-clamp-2" title={activeTask.prompt}>
                           <span className="text-zinc-400 font-medium">提示词:</span> {activeTask.prompt}
                        </p>
                        
                        <a 
                          href={activeTask.type === 'VIDEO' ? activeTask.videoUrl : activeTask.imageUrl} 
                          download={activeTask.type === 'VIDEO' ? `sora-video-${activeTask.id}.mp4` : `gemini-image-${activeTask.id}.png`}
                          className="px-6 py-2.5 bg-white text-black hover:bg-zinc-200 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-white/10 flex items-center gap-2"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <UploadIcon className="w-4 h-4 rotate-180" />
                          下载{activeTask.type === 'VIDEO' ? '视频' : '图片'}
                        </a>
                      </div>
                    </div>
                  )}
               </div>
             ) : (
               // Empty State
               <div className="text-center space-y-4 max-w-sm">
                  <div className="w-24 h-24 bg-zinc-900/50 border border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
                    <SparklesIcon className="w-10 h-10 text-zinc-600 ml-1" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Sora 创意工坊</h3>
                  <p className="text-zinc-500 leading-relaxed">
                    选择上方 <strong>视频</strong> 或 <strong>图片</strong> 标签页，<br/>输入提示词开始您的 AI 创作之旅。
                  </p>
               </div>
             )}
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;
