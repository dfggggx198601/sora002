import React, { useState, useRef, useEffect } from 'react';
import {
  GenerationConfig, GenerationTask, GenerationStatus, AppSettings, UserProfile, QuotaStats, AppAnnouncement, SystemSettings, PaymentPackage
} from './types';
import { useIsMobile } from './hooks/useIsMobile';

// ... (existing imports, no change needed usually, but I need to make sure I don't break them)

import { DEFAULT_CUSTOM_CONFIG } from './constants';
import { generateWithCustomApi } from './services/customService';
import { generateImageWithGoogle } from './services/googleService';
import { generateWithVeo } from './services/veoService';
import { dbService } from './services/dbService';
import { queueService } from './services/queueService';
import { quotaService } from './services/quotaService';
import { apiService } from './services/apiService';
import AuthModal from './components/AuthModal';
import { SparklesIcon, UploadIcon, VideoIcon, HistoryIcon, PlayIcon, SettingsIcon, ImageIcon, TrashIcon, ChatIcon, PlusIcon } from './components/Icons';
import ChatInterface from './components/ChatInterface';

import { AdminLayout } from './components/AdminLayout';
import { AdminDashboard } from './components/AdminDashboard';
import { UserManagement } from './components/UserManagement';
import { ContentAudit } from './components/ContentAudit';
import { AdminSettings } from './components/AdminSettings';
import { AdminOrders } from './components/AdminOrders';


// 添加 Admin Tab 类型
type AdminTab = 'dashboard' | 'users' | 'content' | 'orders' | 'settings';

const App = () => {
  // --- State ---
  // 配置状态
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [googleBaseUrl, setGoogleBaseUrl] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>(localStorage.getItem('google_api_key') || '');
  const [showConfig, setShowConfig] = useState(false);
  const [systemAiConfig, setSystemAiConfig] = useState<any>(null); // Store full AI config from system
  const [activeTab, setActiveTab] = useState<'video' | 'image' | 'chat'>('video');

  // Mobile Support
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<'create' | 'history' | 'profile'>('create');

  // 认证状态
  const [isAuthenticated, setIsAuthenticated] = useState(apiService.isAuthenticated());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [announcement, setAnnouncement] = useState<AppAnnouncement | null>(null);

  // 视频生成 - 输入区域状态
  const [prompt, setPrompt] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('sora2-landscape-10s');

  // 视频生成 - 辅助AI生图状态 (作为参考图)
  const [isRefImageMode, setIsRefImageMode] = useState(false);
  const [refImagePrompt, setRefImagePrompt] = useState('');
  const [isGeneratingRefImage, setIsGeneratingRefImage] = useState(false);

  // 独立图片生成 - 输入区域状态
  const [standaloneImagePrompt, setStandaloneImagePrompt] = useState('');
  // 新增：图片生成模型选择
  // 新增：图片生成模型选择
  const [selectedImageModel, setSelectedImageModel] = useState<string>('gemini-3-pro-image-preview');

  // 任务管理状态
  const [tasks, setTasks] = useState<GenerationTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [queueLength, setQueueLength] = useState(0);
  const [quotaStats, setQuotaStats] = useState<QuotaStats>(quotaService.getUsageStats());

  // Admin State
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');

  // Payment State
  const [showBuyQuotaModal, setShowBuyQuotaModal] = useState(false);
  const [paymentPackages, setPaymentPackages] = useState<PaymentPackage[]>([]);
  const [paymentConfig, setPaymentConfig] = useState<any>(null); // Use any or proper type
  const [selectedPackage, setSelectedPackage] = useState<PaymentPackage | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化 BroadcastChannel 用于跨标签页同步
  const taskChannel = React.useMemo(() => new BroadcastChannel('sora-tasks-sync'), []);

  // Fetch Settings
  const fetchSettings = async () => {
    try {
      // Use getSystemSettings which accesses the public endpoint
      const settings = await apiService.getSystemSettings();

      // Add ApiKey logic
      const { aiConfig } = settings;
      setSystemAiConfig(aiConfig); // Save to state

      if (aiConfig && aiConfig.apiKey) {
        setApiKey(prev => {
          // If user has local key, prefer it? Or system key?
          // User asked: "User refreshes -> automatically load this key".
          // This implies system key overrides or fills empty.
          if (!prev) return aiConfig.apiKey || '';
          return prev;
        });

        // Also handling baseUrl
        if (aiConfig.baseUrl && aiConfig.baseUrl !== googleBaseUrl) {
          setGoogleBaseUrl(aiConfig.baseUrl);
        }
      }

      // Original Logic
      if (settings?.announcement?.enabled) {
        setAnnouncement(settings.announcement);
      }
      if (settings?.paymentPackages) {
        setPaymentPackages(settings.paymentPackages);
      }
      if (settings?.paymentConfig) {
        setPaymentConfig(settings.paymentConfig);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const handleConfirmPayment = async (provider: 'manual' | 'epay' = 'manual') => {
    if (!selectedPackage || !userProfile) return;

    try {
      setIsProcessingPayment(true);

      if (provider === 'manual') {
        // Simulate waiting slightly less because user supposedly already paid
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const result = await apiService.buyQuota(selectedPackage.id, provider);

      if (provider === 'manual') {
        // Manual: Show success message that order is pending
        alert(`订单已提交！请等待管理员审核。订单号: ${result.orderId}`);
        setShowBuyQuotaModal(false);
        // Don't update quota immediately as it's pending
      } else {
        // Epay: Redirect or show URL
        if (result.paymentUrl) {
          window.location.href = result.paymentUrl;
        } else {
          // If just testing or mock
          alert('订单已创建 (易支付接口暂未完全对接跳转)');
          setShowBuyQuotaModal(false);
        }
      }

    } catch (error: any) {
      alert(error.message || '支付失败，请重试');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // 初始化：从 IndexedDB 加载历史任务
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const loadedTasks = await dbService.loadTasks();
        setTasks(loadedTasks);
      } catch (error: any) {
        console.error('Failed to load tasks from IndexedDB:', error);
      }
    };
    loadTasks();

    // 检查用户认证状态并同步任务
    checkUserProfile();

    // 监听其他标签页的消息
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'TASKS_UPDATED') {
        loadTasks(); // 重新加载任务列表
      }
    };
    taskChannel.addEventListener('message', handleMessage);

    return () => {
      taskChannel.removeEventListener('message', handleMessage);
      // taskChannel.close(); // Don't close here as it's memoized and shared
    };
  }, [taskChannel]);

  // 监听任务变化，自动保存到 IndexedDB
  useEffect(() => {
    if (tasks.length > 0) {
      dbService.saveTasks(tasks).catch((error: any) => {
        console.error('Failed to save tasks to IndexedDB:', error);
      });
    }
  }, [tasks]);

  // 设置队列处理器
  useEffect(() => {
    queueService.setProcessor(async (task, config) => {
      await runGenerationInBackground(task.id, config);
    });
    queueService.setMaxConcurrent(quotaService.getMaxConcurrentTasks());
  }, []);

  // 定期更新队列状态
  useEffect(() => {
    const interval = setInterval(() => {
      setQueueLength(queueService.getQueueLength());
      setQuotaStats(quotaService.getUsageStats());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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

    const savedKey = localStorage.getItem('google_api_key');
    if (savedKey) {
      setApiKey(savedKey);
      setIsGoogleConnected(true);
    } else if (import.meta.env.VITE_GOOGLE_API_KEY) {
      setIsGoogleConnected(true);
    }
    if (savedKey) {
      setApiKey(savedKey);
      setIsGoogleConnected(true);
    } else if (import.meta.env.VITE_GOOGLE_API_KEY) {
      setIsGoogleConnected(true);
    }

    // Check for Admin Route
    const path = window.location.pathname;
    if (path === '/admin') {
      if (apiService.isAuthenticated()) {
        // Wait for profile check to complete then redirect
      } else {
        setShowAuthModal(true);
      }
    }

    fetchSettings();
  }, []);

  // 自动轮询：当有任务处于 GENERATING 状态时，每3秒同步一次最新状态
  useEffect(() => {
    if (!isAuthenticated) return;

    const hasActiveTasks = tasks.some(t => t.status === GenerationStatus.GENERATING);
    if (!hasActiveTasks) return;

    const pollInterval = setInterval(async () => {
      try {
        const serverTasks = await apiService.getTasks();
        // 智能合并：只更新状态改变的任务，避免 UI 抖动
        setTasks(prev => {
          const newTasks = [...prev];
          let hasChanges = false;
          serverTasks.tasks.forEach(remoteTask => {
            const localIndex = newTasks.findIndex(t => t.id === (remoteTask.id || remoteTask._id));
            if (localIndex !== -1) {
              const localTask = newTasks[localIndex];
              // 如果状态发生了变化 (例如 Pending -> Completed/Failed)
              if (localTask.status !== remoteTask.status) {
                newTasks[localIndex] = { ...localTask, ...remoteTask };
                hasChanges = true;
              }
            }
          });
          return hasChanges ? newTasks : prev;
        });
      } catch (err) {
        console.error("Polling sync failed", err);
      }
    }, 3000); // 3秒刷新一次

    return () => clearInterval(pollInterval);
  }, [tasks, isAuthenticated]);

  // Update URL effect
  useEffect(() => {
    if (isAdminMode) {
      window.history.pushState({}, '', '/admin');
    } else {
      window.history.pushState({}, '', '/');
    }
  }, [isAdminMode]);

  // 检查用户资料并同步任务
  const checkUserProfile = async () => {
    if (apiService.isAuthenticated()) {
      try {
        // 获取用户信息
        const profile = await apiService.getProfile();
        setUserProfile(profile.user);
        setIsAuthenticated(true);

        // 同步配额到本地 QuotaService
        if (profile.user.quota) {
          quotaService.setQuota({
            dailyVideoLimit: profile.user.quota.dailyVideoLimit,
            dailyImageLimit: profile.user.quota.dailyImageLimit,
            dailyChatLimit: profile.user.quota.dailyChatLimit,
          });
          quotaService.syncUsage(profile.user.quota);
          // 立即更新 UI 状态
          setQuotaStats(quotaService.getUsageStats());
        }

        // 同步服务器任务到本地
        try {
          const serverTasks = await apiService.getTasks();
          setTasks(serverTasks.tasks);
          // 保存到本地 IndexedDB
          await dbService.saveTasks(serverTasks.tasks);
        } catch (syncError: any) {
          console.error('Failed to sync tasks from server:', syncError);
        }
      } catch (error: any) {
        console.error('Failed to get user profile:', error);
        apiService.clearToken();
      }
    }
  };

  useEffect(() => {
    if (userProfile?.role === 'admin' && window.location.pathname === '/admin') {
      setIsAdminMode(true);
    }
  }, [userProfile]);

  // Auth Handler
  const handleConnectGoogle = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success after dialog interaction to avoid race condition
      setIsGoogleConnected(true);
    } else {
      // AI Studio 环境未检测到，打开配置面板允许用户手动输入 Key
      setShowConfig(true);
    }
  };

  // 保存 Base URL
  const handleSaveBaseUrl = (url: string) => {
    setGoogleBaseUrl(url);
    localStorage.setItem('google_base_url', url);
  };

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('google_api_key', key);
    if (key.trim().length > 0) {
      setIsGoogleConnected(true);
    } else {
      // Only disconnect if window.aistudio is also not available
      if (!window.aistudio || !window.aistudio.hasSelectedApiKey) {
        setIsGoogleConnected(false);
      }
    }
  };

  // 获取当前正在查看的任务对象
  const activeTask = tasks.find((t: GenerationTask) => t.id === activeTaskId) || null;

  // --- Helper: Proxy URL Generator for Images ---
  const getProxiedUrl = (url: string | undefined): string | undefined => {
    if (!url) return undefined;
    // Base64 or already relative path -> use as is
    if (url.startsWith('data:') || url.startsWith('/')) return url;
    // Localhost -> use as is
    if (url.includes('localhost') || url.includes('127.0.0.1')) return url;

    // GCS or other external URL -> wrap in Proxy
    // Note: We use the existing /api/ai/proxy endpoint which supports 'url' param
    return `/api/ai/proxy?url=${encodeURIComponent(url)}`;
  };

  // --- Handlers ---

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
      setIsRefImageMode(false); // 切回上传模式
    }
  };

  const handleAuthSuccess = async () => {
    setIsAuthenticated(true);
    await checkUserProfile();

    // 登录成功后也同步一次任务
    try {
      const serverTasks = await apiService.getTasks();
      setTasks(serverTasks.tasks);
      // 保存到本地 IndexedDB
      await dbService.saveTasks(serverTasks.tasks);
    } catch (syncError: any) {
      console.error('Failed to sync tasks after login:', syncError);
    }
  };

  const handleLogout = async () => {
    // 1. Clear Backend Token
    apiService.clearToken();
    setIsAuthenticated(false);
    setUserProfile(null);

    // 2. Clear Local Tasks (Memory & Disk)
    setTasks([]);
    try {
      await dbService.clearAllTasks();
      console.log('Local task history cleared on logout');
    } catch (e) {
      console.error('Failed to clear local DB on logout', e);
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

    // Logic: Use API Key if available, else try Proxy if Logged In
    const hasClientKey = isGoogleConnected || (apiKey && apiKey.length > 0);
    const canUseProxy = isAuthenticated;

    if (!hasClientKey && !canUseProxy) {
      await handleConnectGoogle();
      return;
    }

    setIsGeneratingRefImage(true);
    try {
      let base64Url: string;

      if (hasClientKey) {
        // 使用前端直连 (Gemini 3 Pro Image)
        base64Url = await generateImageWithGoogle(
          refImagePrompt,
          'gemini-3-pro-image-preview',
          googleBaseUrl,
          apiKey
        );
      } else {
        // 使用后端代理
        const res = await apiService.generateAiImage(refImagePrompt, 'gemini-3-pro-image-preview');
        base64Url = res.imageUrl;
      }

      // 将 Base64 转换为 File 对象，以便兼容现有的上传逻辑
      const res = await fetch(base64Url);
      const blob = await res.blob();
      const file = new File([blob], "ai_ref_image.png", { type: "image/png" });

      setSelectedImage(file);
      setIsRefImageMode(false); // 生成成功后切回预览
      setRefImagePrompt(''); // 清空图片提示词
    } catch (error: any) {
      alert(`图片生成失败: ${error.message} `);
      if (error.message.includes("API Key") && hasClientKey) {
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

    const hasClientKey = isGoogleConnected || (apiKey && apiKey.length > 0);
    const canUseProxy = isAuthenticated;

    if (!hasClientKey && !canUseProxy) {
      await handleConnectGoogle();
      return;
    }

    // 检查配额
    if (!quotaService.canGenerate('IMAGE')) {
      alert(`今日图片生成配额已用尽！剩余: ${quotaService.getRemainingQuota('IMAGE')} / ${quotaStats.imageLimit}`);
      return;
    }

    // 确定使用的模型
    const finalModel = selectedImageModel;
    if (!finalModel) {
      alert("请指定模型名称");
      return;
    }

    // 1. 创建新任务
    let newTask: GenerationTask = {
      id: Date.now().toString(),
      type: 'IMAGE',
      status: GenerationStatus.GENERATING,
      prompt: standaloneImagePrompt,
      model: finalModel,
      createdAt: Date.now(),
    };

    // 如果已登录，先在后端创建任务以获取 ID 和扣除配额
    if (isAuthenticated) {
      try {
        const res = await apiService.createTask({
          type: 'IMAGE',
          prompt: standaloneImagePrompt,
          model: finalModel
        });
        // 使用服务器返回的任务 ID
        newTask.id = res.task.id || res.task._id;
        if (res.quota) setQuotaStats(res.quota);
      } catch (error: any) {
        alert(`创建任务失败: ${error.message}`);
        return;
      }
    } else {
      // Only if hasClientKey (Guest Mode with Key)
      quotaService.incrementUsage('IMAGE');
      setQuotaStats(quotaService.getUsageStats());
    }

    setTasks((prev: GenerationTask[]) => [newTask, ...prev]);
    setActiveTaskId(newTask.id);
    setStandaloneImagePrompt('');

    // 2. 执行生成
    try {
      let base64Url: string;

      if (isAuthenticated) {
        // Priority 1: Authenticated User -> Use Backend Proxy
        const res = await apiService.generateAiImage(newTask.prompt, finalModel, newTask.id);
        base64Url = res.imageUrl;

      } else if (hasClientKey) {
        // Priority 2: Guest with Key -> Use Client Side Direct Call
        base64Url = await generateImageWithGoogle(
          newTask.prompt,
          finalModel,
          googleBaseUrl,
          apiKey
        );
      } else {
        throw new Error("Impossible state: No Auth and No Key");
      }

      // 3. 处理图片预览 (Blob vs URL)
      let finalImageUrl = base64Url;

      // 只有当是 Base64 数据时，才转换为 Blob URL 以优化内存
      // 如果是 http 链接 (GCS)，直接使用
      if (base64Url.startsWith('data:')) {
        try {
          const res = await fetch(base64Url);
          const blob = await res.blob();
          finalImageUrl = URL.createObjectURL(blob);
        } catch (blobErr) {
          console.error("Blob conversion failed", blobErr);
          // If blob fails, fallback to original base64 (heavy but safe)
        }
      }

      // 更新本地状态
      setTasks((prev: GenerationTask[]) => prev.map((t: GenerationTask) =>
        t.id === newTask.id
          ? {
            ...t,
            status: GenerationStatus.COMPLETED,
            imageUrl: finalImageUrl,
            completedAt: Date.now()
          }
          : t
      ));

      // 如果已登录，不需要再 updateTask 了，因为后端 AiController 已经保存了 COMPLETED 状态
      // 但为了保险起见(防止后端保存失败?)，或者为了同步 imageUrl (如果是 Guest 模式转正?)
      // 其实对于已登录用户，后端早就保存好了。这里再保存一次虽冗余但无害，只要不报错。
      // 但如果这里报错，绝不能覆盖成 FAILED！

    } catch (err: any) {
      console.error('Image Generation Error:', err);
      const errorMsg = err.message || "图片生成失败";

      // 更新本地 UI 提示错误
      setTasks((prev: GenerationTask[]) => prev.map((t: GenerationTask) =>
        t.id === newTask.id
          ? {
            ...t,
            status: GenerationStatus.FAILED,
            error: errorMsg,
            completedAt: Date.now()
          }
          : t
      ));

      // 只有当还没有获得结果时 (即真正生成失败时)，才向后端报告 FAILED
      // 如果 err 是在 fetch(base64Url) 阶段抛出的，说明后端已经成功了，千万不要覆盖！
      // 我们可以检查 newTask 是否已经在 UI 上显示为成功? 不，这里是 catch 块.
      // 简单判断: 检查 err 是否是网络错误? 或者更直接:
      // 如果我们能确定 apiService.generateAiImage 抛出了错，才报 Failed。
      // 由于 await apiService... 在 try 的第一行，如果它挂了，会直接进 catch。
      // 如果它没挂，base64Url 就有值了。

      // *关键修复*: 如果我们也报 FAILED，会导致后端已完成的任务被改写。
      // 所以我们加一个判断：只有当生成API调用本身失败时。
      // 如何判断？看 `base64Url` 是否为空。
      // 但 base64Url 是 let 定义的，无法在 catch 中访问 (block scope)。
      // 需要重构作用域。

      if (isAuthenticated) {
        // 为了安全，我们只在极大概率是生成失败的情况下 updateTask
        // 如果错误信息包含 "fetch" 或 "blob", 可能是前端问题，不要报 Failed
        const isFrontendError = err.message.includes('fetch') || err.message.includes('blob');
        if (!isFrontendError) {
          await apiService.updateTask(newTask.id, {
            status: GenerationStatus.FAILED,
            error: errorMsg
          }).catch(e => console.error("Failed to report error", e));
        }
      }

      if (err.message && err.message.includes("API Key") && hasClientKey) {
        setIsGoogleConnected(false);
      }
    }
  };

  // 逻辑 C：生成视频任务
  const handleGenerateVideo = async () => {
    if (isSubmitting) return;
    if (!prompt && !selectedImage) {
      alert("请输入提示词或上传一张图片");
      return;
    }

    // 检查配额
    if (!quotaService.canGenerate('VIDEO')) {
      alert(`今日视频生成配额已用尽！剩余: ${quotaService.getRemainingQuota('VIDEO')} / ${quotaStats.videoLimit}`);
      return;
    }

    const newTaskImagePreview = selectedImage ? URL.createObjectURL(selectedImage) : undefined;

    // 1. 创建新任务对象
    let newTask: GenerationTask = {
      id: Date.now().toString(),
      type: 'VIDEO',
      status: GenerationStatus.GENERATING,
      prompt: prompt || (selectedImage ? `图生视频: ${selectedImage.name}` : '未命名任务'),
      model: selectedModel,
      createdAt: Date.now(),
      imagePreviewUrl: newTaskImagePreview
    };

    // 如果已登录，后端同步创建
    if (isAuthenticated) {
      try {
        const res = await apiService.createTask({
          type: 'VIDEO',
          prompt: newTask.prompt,
          model: selectedModel,
          // imagePreviewUrl: newTaskImagePreview // Blob URLs 无法同步，需要上传。暂时略过。
        });
        newTask.id = res.task.id || res.task._id;
        if (res.quota) setQuotaStats(res.quota);
      } catch (error: any) {
        alert(`创建任务失败: ${error.message}`);
        setIsSubmitting(false);
        return;
      }
    } else {
      quotaService.incrementUsage('VIDEO');
      setQuotaStats(quotaService.getUsageStats());
    }

    // 2. 更新状态：加入任务列表，并自动选中当前新任务
    setTasks((prev: GenerationTask[]) => [newTask, ...prev]);
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
    setIsSubmitting(false);

    // 5. 加入队列执行 (本地 + 异步)
    queueService.enqueue(newTask, apiGenConfig);
    setQueueLength(queueService.getQueueLength());
  };

  // 后台执行视频生成逻辑
  const runGenerationInBackground = async (taskId: string, config: GenerationConfig) => {
    try {
      let videoUrl: string;

      // 根据模型选择不同的服务
      if (isAuthenticated) {
        // Priority 1: Authenticated User -> Use Backend Proxy
        // Pass taskId to allow Backend to persist result (for backgrounding support)
        const res = await apiService.generateAiVideo(config.prompt, config.model, taskId);
        videoUrl = res.videoUrl;
      } else if (config.model === 'veo-3.1-fast-generate-preview') {
        // Priority 2: Guest with Key -> Use Client Side Direct Call (Veo)
        videoUrl = await generateWithVeo(config, apiKey);
      } else {
        // Fallback / Other models (Mock/Custom) - Guest Mode using Dynamic Config
        const effectiveConfig = {
          baseUrl: systemAiConfig?.soraBaseUrl || DEFAULT_CUSTOM_CONFIG.baseUrl,
          apiKey: systemAiConfig?.soraApiKey || DEFAULT_CUSTOM_CONFIG.apiKey,
          endpointPath: DEFAULT_CUSTOM_CONFIG.endpointPath
        };
        videoUrl = await generateWithCustomApi(config, effectiveConfig);
      }

      setTasks((prev: GenerationTask[]) => prev.map((t: GenerationTask) =>
        t.id === taskId
          ? {
            ...t,
            status: GenerationStatus.COMPLETED,
            videoUrl: videoUrl,
            completedAt: Date.now()
          }
          : t
      ));

      // 同步到后端
      if (apiService.isAuthenticated()) {
        await apiService.updateTask(taskId, {
          status: GenerationStatus.COMPLETED,
          videoUrl: videoUrl
        });
      }
    } catch (err: any) {
      console.error(err);

      // 特殊处理：如果浏览器因超时中断请求 (AbortError)，不要标记为失败。
      // 后端仍在运行，让 Auto-Sync 轮询去更新最终状态。
      // 新增：同时处理 504 Gateway Timeout (Nginx超时) 和 SyntaxError (HTML解析错误)
      const isTimeout = err.message && (err.message.includes('504') || err.message.includes('timeout'));
      const isSyntaxError = err.name === 'SyntaxError' || (err.message && err.message.includes('Unexpected token'));

      if (err.name === 'AbortError' || err.message?.includes('aborted') || isTimeout || isSyntaxError) {
        console.warn('[Auto-Recovery] Request timed out or invalid response (likely HTML). Switching to background polling mode.', err.message);
        return;
      }

      const errorMsg = err.message || "生成失败，未知错误";

      setTasks((prev: GenerationTask[]) => prev.map((t: GenerationTask) =>
        t.id === taskId
          ? {
            ...t,
            status: GenerationStatus.FAILED,
            error: errorMsg,
            completedAt: Date.now()
          }
          : t
      ));

      // 同步失败状态到后端
      if (apiService.isAuthenticated()) {
        await apiService.updateTask(taskId, {
          status: GenerationStatus.FAILED,
          error: errorMsg
        });
      }
    }
  };

  const formatDuration = (start: number, end?: number) => {
    if (!end) return '...';
    const seconds = ((end - start) / 1000).toFixed(1);
    return `${seconds}秒`;
  };

  // 清空所有任务
  const handleClearAllTasks = async () => {
    if (tasks.length === 0) return;
    if (!confirm(`确定要清空所有 ${tasks.length} 个任务吗？这个操作不可恢复！`)) return;

    try {
      // 1. 同步到后端
      if (isAuthenticated) {
        await apiService.clearTasks();
      }

      // 2. 本地记录清空
      await dbService.clearAllTasks();
      setTasks([]);
      setActiveTaskId(null);

      // 通知其他标签页
      taskChannel.postMessage({ type: 'TASKS_UPDATED' });
    } catch (error: any) {
      console.error('Failed to clear tasks:', error);
      alert('清空任务失败，请重试');
    }
  };

  // 删除单个任务
  // --- Chat Handlers ---
  // --- Chat Handlers ---
  const handleNewChat = async () => {
    // 检查配额
    if (!quotaService.canGenerate('CHAT')) {
      alert(`今日对话配额已用尽！剩余: ${quotaService.getRemainingQuota('CHAT')} / ${quotaStats.dailyChatLimit || 50}`);
      return;
    }

    let newTaskId = Date.now().toString();
    const newTask: GenerationTask = {
      id: newTaskId,
      type: 'CHAT',
      status: GenerationStatus.IDLE,
      prompt: 'New Chat',
      model: 'gemini-3-pro-preview',
      createdAt: Date.now(),
      messages: []
    };

    // 如果已登录，同步创建到后端
    if (isAuthenticated) {
      try {
        const res = await apiService.createTask({
          type: 'CHAT',
          prompt: 'New Chat',
          model: 'gemini-3-pro-preview'
        });
        // 使用服务器 ID
        newTaskId = res.task.id || res.task._id;
        newTask.id = newTaskId;
      } catch (err) {
        console.error('Failed to create chat task on server:', err);
        // Continue with local task? Yes.
      }
    }

    setTasks(prev => [newTask, ...prev]);
    setActiveTaskId(newTaskId);
    setActiveTab('chat');
  };

  const handleUpdateTask = async (updatedTask: GenerationTask) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));

    // 如果是聊天任务且已登录，同步消息到后端
    if (updatedTask.type === 'CHAT' && isAuthenticated) {
      try {
        await apiService.updateTask(updatedTask.id, {
          messages: updatedTask.messages,
          status: updatedTask.status
        });
      } catch (err) {
        console.error('Failed to sync chat messages to server:', err);
      }
    }
  };

  /* --- Chat Image Gen Helper --- */
  const handleGenerateImageForChat = async (prompt: string): Promise<string | null> => {
    // Reuse existing image generation logic with proxy support
    try {
      console.log(`[Chat Image Gen] Using model: ${selectedImageModel}`);

      const hasClientKey = isGoogleConnected || (apiKey && apiKey.length > 0);

      if (hasClientKey) {
        const url = await generateImageWithGoogle(prompt, selectedImageModel, googleBaseUrl, apiKey);
        return url;
      } else if (isAuthenticated) {
        // Proxy
        const res = await apiService.generateAiImage(prompt, selectedImageModel);
        return res.imageUrl;
      } else {
        alert('请先登录或配置 API Key');
        return null;
      }

    } catch (e) {
      console.error("Chat Image Gen Error", e);
      return null;
    }
  };

  const handleDeleteTask = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation(); // 阻止点击进入任务详情
    if (!confirm('确定要删除这个任务吗？')) return;

    try {
      // 1. 同步到后端
      if (isAuthenticated) {
        try {
          await apiService.deleteTask(taskId);
        } catch (apiError: any) {
          // 如果任务在后端不存在 (404)，我们应该视为已经删除成功，继续清理本地数据
          const errorMessage = apiError.message || '';
          if (errorMessage.includes('not found') || errorMessage.includes('404')) {
            console.warn('Backend task not found, proceeding with local deletion:', taskId);
          } else {
            // 其他错误则抛出，中断后续流程
            throw apiError;
          }
        }
      }

      // 2. 本地记录删除
      await dbService.deleteTask(taskId);
      setTasks((prev: GenerationTask[]) => prev.filter((t: GenerationTask) => t.id !== taskId));
      if (activeTaskId === taskId) {
        setActiveTaskId(null);
      }

      // 通知其他标签页
      taskChannel.postMessage({ type: 'TASKS_UPDATED' });
    } catch (error: any) {
      console.error('Failed to delete task:', error);
      alert(`删除任务失败: ${error.message || '请重试'}`);
    }
  };

  const videoModels = [
    { id: 'sora2-landscape-10s', name: '横屏 (16:9) - 10秒' },
    { id: 'sora2-landscape-15s', name: '横屏 (16:9) - 15秒' },
    { id: 'sora2-portrait-10s', name: '竖屏 (9:16) - 10秒' },
    { id: 'sora2-portrait-15s', name: '竖屏 (9:16) - 15秒' },
    { id: 'veo-3.1-fast-generate-preview', name: 'Google Veo 3.1 Fast (官方)' },
  ];

  const imageModels = [
    { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image (官方)' },
  ];

  if (isAdminMode) {
    return (
      <AdminLayout
        activeTab={adminTab}
        onTabChange={(tab: string) => setAdminTab(tab as any)}
        onExit={() => setIsAdminMode(false)}
      >
        // ... (in AdminLayout switch)
        {adminTab === 'dashboard' && <AdminDashboard />}
        {adminTab === 'users' && <UserManagement />}
        {adminTab === 'content' && <ContentAudit />}
        {adminTab === 'orders' && <AdminOrders />}
        {adminTab === 'settings' && <AdminSettings />}
      </AdminLayout>
    );
  }

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-black text-zinc-100 font-sans overflow-hidden select-none">

        {/* --- Mobile Header --- */}
        <header className="h-14 px-4 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-900/20">
              <SparklesIcon className="text-white w-4 h-4" />
            </div>
            <h1 className="font-bold text-base tracking-tight">Sora Studio</h1>
          </div>
          <div className="flex items-center gap-2">
            {!isGoogleConnected && (
              <button onClick={handleConnectGoogle} className="text-xs px-2 py-1 bg-zinc-800 rounded border border-zinc-700 text-zinc-400">
                连接 Key
              </button>
            )}
            {isAuthenticated ? (
              <div className="w-8 h-8 rounded-full bg-purple-900/50 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-200">
                {userProfile?.username?.[0] || 'U'}
              </div>
            ) : (
              <button onClick={() => setShowAuthModal(true)} className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-full">
                登录
              </button>
            )}
          </div>
        </header>

        {/* --- Mobile Content Area --- */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-black relative pb-20 scroll-smooth">

          {/* Tab: Create */}
          {mobileTab === 'create' && (
            <div className="p-4 space-y-6 pb-24">
              {/* Mode Switcher */}
              <div className="flex p-1 bg-zinc-900 rounded-xl border border-zinc-800">
                <button onClick={() => setActiveTab('video')} className={`flex-1 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all ${activeTab === 'video' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500'}`}>
                  <VideoIcon className="w-3.5 h-3.5" /> 视频
                </button>
                <button onClick={() => setActiveTab('image')} className={`flex-1 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all ${activeTab === 'image' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500'}`}>
                  <ImageIcon className="w-3.5 h-3.5" /> 图片
                </button>
                <button onClick={() => setActiveTab('chat')} className={`flex-1 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all ${activeTab === 'chat' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500'}`}>
                  <ChatIcon className="w-3.5 h-3.5" /> 对话
                </button>
              </div>

              {/* --- VIDEO CREATION FORM --- */}
              {activeTab === 'video' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">提示词 (Prompt)</label>
                    <textarea
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-sm min-h-[120px] focus:outline-none focus:border-purple-500 transition-colors placeholder-zinc-700"
                      placeholder="描述您想生成的视频..."
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                    />
                  </div>

                  {/* Image Selector UI for Mobile */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">参考图 (可选)</label>
                    {selectedImage ? (
                      <div className="relative rounded-xl overflow-hidden border border-purple-500/30">
                        <img src={URL.createObjectURL(selectedImage)} className="w-full h-32 object-cover" />
                        <button onClick={clearImage} className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full"><TrashIcon className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-3 border border-dashed border-zinc-700 hover:bg-zinc-900 rounded-xl text-xs text-zinc-400 flex flex-col items-center justify-center gap-1">
                          <UploadIcon className="w-4 h-4" /> 上传图片
                        </button>
                        <button onClick={() => setIsRefImageMode(!isRefImageMode)} className="flex-1 py-3 border border-dashed border-zinc-700 hover:bg-zinc-900 rounded-xl text-xs text-purple-400 flex flex-col items-center justify-center gap-1">
                          <SparklesIcon className="w-4 h-4" /> AI 生成
                        </button>
                      </div>
                    )}
                    {/* Hidden Input */}
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />

                    {/* AI Ref Gen Mobile UI */}
                    {isRefImageMode && !selectedImage && (
                      <div className="bg-zinc-900 rounded-xl p-3 space-y-2 border border-purple-500/20 mt-2">
                        <input
                          value={refImagePrompt} onChange={e => setRefImagePrompt(e.target.value)}
                          className="w-full bg-black border border-zinc-800 rounded px-2 py-2 text-xs" placeholder="图片描述..."
                        />
                        <button onClick={handleGenerateRefImage} disabled={isGeneratingRefImage} className="w-full py-2 bg-purple-600 rounded-lg text-xs font-bold text-white">
                          {isGeneratingRefImage ? '生成中...' : '生成参考图'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">模型</label>
                    <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white">
                      {videoModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>

                  <button onClick={handleGenerateVideo} className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl text-sm font-bold text-white shadow-lg shadow-purple-900/30 active:scale-[0.98] transition-all">
                    开始生成视频
                  </button>
                </div>
              )}

              {/* --- IMAGE CREATION FORM --- */}
              {activeTab === 'image' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">图片描述</label>
                    <textarea
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-sm min-h-[140px] focus:outline-none focus:border-pink-500 transition-colors placeholder-zinc-700"
                      placeholder="一只在雨中漫步的赛博朋克猫..."
                      value={standaloneImagePrompt}
                      onChange={e => setStandaloneImagePrompt(e.target.value)}
                    />
                  </div>
                  <button onClick={handleGenerateStandaloneImage} className="w-full py-3 bg-gradient-to-r from-pink-600 to-rose-600 rounded-xl text-sm font-bold text-white shadow-lg shadow-pink-900/30 active:scale-[0.98] transition-all">
                    开始生成图片
                  </button>
                </div>
              )}

              {/* --- CHAT FORM --- */}
              {activeTab === 'chat' && (
                <div className="flex flex-col items-center justify-center py-10 space-y-4">
                  <div className="p-4 bg-zinc-900/50 rounded-full">
                    <ChatIcon className="w-8 h-8 text-indigo-400" />
                  </div>
                  <p className="text-xs text-zinc-500">Gemini 1.5 Pro</p>
                  <button onClick={handleNewChat} className="px-6 py-2 bg-indigo-600 rounded-full text-sm font-bold shadow-lg shadow-indigo-900/20 active:scale-95 transition-all">
                    新建对话
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab: History (Tasks) */}
          {mobileTab === 'history' && (
            <div className="p-4 space-y-3 pb-24 min-h-screen">
              <h2 className="text-lg font-bold">创作历史</h2>
              {tasks.length === 0 ? (
                <div className="text-center py-20 text-zinc-600 text-sm">暂无记录</div>
              ) : (
                tasks.map(task => (
                  <div key={task.id}
                    onClick={() => { setActiveTaskId(task.id); /* Maybe open full view? */ }}
                    className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 flex gap-3 relative overflow-hidden"
                  >
                    {/* Thumbnail */}
                    <div className="w-20 h-20 bg-black rounded-lg flex-shrink-0 overflow-hidden border border-zinc-800">
                      {(task.status === GenerationStatus.COMPLETED) ? (
                        (task.type === 'VIDEO' && task.videoUrl) ? (
                          <video src={task.videoUrl} className="w-full h-full object-cover" muted loop playsInline />
                        ) : (
                          <img src={task.imageUrl || task.imagePreviewUrl} className="w-full h-full object-cover" />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                          {task.status === GenerationStatus.GENERATING ? <div className="w-4 h-4 border-2 border-purple-500 rounded-full animate-spin border-t-transparent" /> : <span className="text-xs text-red-500">!</span>}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${task.type === 'VIDEO' ? 'bg-purple-900/30 border-purple-700 text-purple-300' : 'bg-pink-900/30 border-pink-700 text-pink-300'}`}>{task.type}</span>
                        <span className="text-[10px] text-zinc-500">{new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">{task.prompt}</p>
                    </div>

                    {/* Full Screen View trigger (rudimentary) */}
                    {task.id === activeTaskId && task.status === GenerationStatus.COMPLETED && (
                      <div className="fixed inset-0 z-50 bg-black flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-4 bg-zinc-900/80 backdrop-blur">
                          <h3 className="font-bold text-sm">预览</h3>
                          <button onClick={(e) => { e.stopPropagation(); setActiveTaskId(null); }} className="text-zinc-500 p-2 text-xl">✕</button>
                        </div>
                        <div className="flex-1 flex items-center justify-center p-4 bg-black/50">
                          {task.type === 'VIDEO' ? (
                            <video src={task.videoUrl} controls autoPlay className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" />
                          ) : (
                            <img src={task.imageUrl} className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" />
                          )}
                        </div>
                        <div className="p-4 bg-zinc-900 space-y-2 safe-area-bottom">
                          <a href={task.type === 'VIDEO' ? task.videoUrl : task.imageUrl} download className="block w-full text-center py-3 bg-white text-black font-bold rounded-lg text-sm">下载文件</a>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab: Profile */}
          {mobileTab === 'profile' && (
            <div className="p-4 space-y-6 pb-24">
              {isAuthenticated ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center space-y-2">
                  <div className="w-16 h-16 bg-purple-600 rounded-full mx-auto flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-purple-900/50">
                    {userProfile?.username?.[0] || 'U'}
                  </div>
                  <h2 className="text-xl font-bold text-white">{userProfile?.username}</h2>
                  <p className="text-zinc-500 text-sm">{userProfile?.email}</p>
                  <button onClick={handleLogout} className="text-xs text-red-500 py-2">退出登录</button>
                </div>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-zinc-800 rounded-full mx-auto flex items-center justify-center">
                    <SettingsIcon className="w-8 h-8 text-zinc-600" />
                  </div>
                  <p className="text-zinc-400 text-sm">登录以保存您的作品并同步多端数据</p>
                  <button onClick={() => setShowAuthModal(true)} className="w-full py-3 bg-white text-black font-bold rounded-xl text-sm">
                    立即登录
                  </button>
                </div>
              )}

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-zinc-300">今日配额</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-black rounded-lg p-2 text-center border border-zinc-800">
                    <div className="text-xs text-zinc-500 mb-1">视频</div>
                    <div className="text-sm font-bold text-purple-400">{quotaStats.videoCount}/{quotaStats.videoLimit}</div>
                  </div>
                  <div className="bg-black rounded-lg p-2 text-center border border-zinc-800">
                    <div className="text-xs text-zinc-500 mb-1">图片</div>
                    <div className="text-sm font-bold text-pink-400">{quotaStats.imageCount}/{quotaStats.imageLimit}</div>
                  </div>
                  <div className="bg-black rounded-lg p-2 text-center border border-zinc-800">
                    <div className="text-xs text-zinc-500 mb-1">对话</div>
                    <div className="text-sm font-bold text-indigo-400">{quotaStats.chatCount}/{quotaStats.dailyChatLimit || 50}</div>
                  </div>
                </div>
                <button onClick={() => setShowBuyQuotaModal(true)} className="w-full py-2 bg-gradient-to-r from-amber-600/20 to-orange-600/20 text-amber-500 text-xs font-bold rounded-lg border border-amber-600/30 flex items-center justify-center gap-1">
                  <span>⚡️</span> 购买加油包
                </button>
              </div>

              <div className="space-y-2">
                <button onClick={() => setShowConfig(true)} className="w-full flex items-center justify-between p-4 bg-zinc-900 rounded-xl text-sm text-zinc-300">
                  <span>Google 设置 (API Key)</span>
                  <span className="text-zinc-500">Access &gt;</span>
                </button>
                <a href="https://github.com/dfggggx198601/sora002" target="_blank" className="w-full flex items-center justify-between p-4 bg-zinc-900 rounded-xl text-sm text-zinc-300">
                  <span>GitHub</span>
                  <span className="text-zinc-500">v0.22</span>
                </a>
              </div>

              <div className="text-center text-[10px] text-zinc-700 pt-6">
                Sora Studio Mobile v0.2.2
              </div>
            </div>
          )}

        </div>

        {/* --- Bottom Navigation --- */}
        <div className="fixed bottom-0 left-0 right-0 h-[80px] bg-black/90 backdrop-blur-xl border-t border-zinc-800 flex items-start justify-around pt-3 z-30 safe-area-bottom pb-4">
          <button onClick={() => setMobileTab('create')} className={`flex flex-col items-center gap-1 w-16 ${mobileTab === 'create' ? 'text-white' : 'text-zinc-600'}`}>
            <div className={`p-1.5 rounded-full transition-all ${mobileTab === 'create' ? 'bg-purple-600 shadow-lg shadow-purple-900/40' : ''}`}>
              <PlusIcon className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium">创作</span>
          </button>

          <button onClick={() => setMobileTab('history')} className={`flex flex-col items-center gap-1 w-16 ${mobileTab === 'history' ? 'text-white' : 'text-zinc-600'}`}>
            <HistoryIcon className={`w-5 h-5 transition-all ${mobileTab === 'history' ? 'scale-110' : ''}`} />
            <span className="text-[10px] font-medium">历史</span>
          </button>

          <button onClick={() => setMobileTab('profile')} className={`flex flex-col items-center gap-1 w-16 ${mobileTab === 'profile' ? 'text-white' : 'text-zinc-600'}`}>
            <SettingsIcon className={`w-5 h-5 transition-all ${mobileTab === 'profile' ? 'scale-110' : ''}`} />
            <span className="text-[10px] font-medium">我的</span>
          </button>
        </div>

        {/* --- Shared Modals (Auth, Quota, etc) --- */}
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} onAuthSuccess={handleAuthSuccess} />
        {showBuyQuotaModal && (
          <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4">
            <div className="bg-zinc-900 w-full max-w-sm rounded-2xl p-6 border border-zinc-800 relative">
              <button onClick={() => setShowBuyQuotaModal(false)} className="absolute top-4 right-4 text-zinc-500 text-xl">✕</button>
              <h3 className="text-lg font-bold text-white mb-4">购买加油包</h3>
              {/* Reusing existing logic but simplified visual */}
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {paymentPackages.map(pkg => (
                  <button key={pkg.id} onClick={() => setSelectedPackage(pkg)} className={`w-full p-3 rounded-lg border text-left flex justify-between ${selectedPackage?.id === pkg.id ? 'bg-purple-900/20 border-purple-500' : 'bg-black border-zinc-800'}`}>
                    <div>
                      <div className="text-sm font-bold text-white">{pkg.name}</div>
                      <div className="text-xs text-zinc-500">¥{pkg.price}</div>
                    </div>
                    {selectedPackage?.id === pkg.id && <span className="text-purple-500 text-xs">Selected</span>}
                  </button>
                ))}
              </div>
              {selectedPackage && (
                <button onClick={() => handleConfirmPayment('manual')} className="w-full mt-4 py-3 bg-white text-black font-bold rounded-xl text-sm">
                  {isProcessingPayment ? '处理中...' : `支付 ¥${selectedPackage.price}`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-black text-zinc-100 font-sans selection:bg-purple-500/30">

      {/* Global Announcement Banner */}
      {announcement && (
        <div className={`fixed top-0 left-0 right-0 z-[60] py-2 px-4 text-center text-sm font-medium animate-fade-in ${announcement.type === 'error' ? 'bg-red-500 text-white' :
          announcement.type === 'warning' ? 'bg-yellow-500 text-black' :
            'bg-blue-600 text-white'
          }`}>
          {announcement.message}
        </div>
      )}

      {/* Admin Entry Button */}
      {userProfile?.role === 'admin' && (
        <button
          onClick={() => setIsAdminMode(true)}
          className="fixed bottom-4 left-4 z-50 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-full shadow-lg font-medium transition-colors border border-white/10 flex items-center gap-2"
        >
          <SettingsIcon className="w-4 h-4" />
          Admin Panel
        </button>
      )}

      {/* Sidebar */}
      <aside className="w-full md:w-80 bg-zinc-950 border-r border-zinc-900 flex flex-col h-[35vh] md:h-screen z-20">
        <div className="p-5 border-b border-zinc-900 flex items-center gap-3 bg-zinc-950 sticky top-0 z-10">
          <div className="p-2 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg shadow-lg shadow-purple-900/20">
            <SparklesIcon className="text-white w-5 h-5" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">Sora 创意工坊</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {/* 配额和队列状态显示 */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 mb-3 space-y-2">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">今日配额</div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500">🎥 视频</span>
                <span className="text-xs font-medium text-purple-400">
                  {quotaStats.videoCount} / {quotaStats.videoLimit}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500">🖼️ 图片</span>
                <span className="text-xs font-medium text-pink-400">
                  {quotaStats.imageCount} / {quotaStats.imageLimit}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500">💬 对话</span>
                <span className="text-xs font-medium text-indigo-400">
                  {quotaStats.chatCount} / {quotaStats.dailyChatLimit || 50}
                </span>
              </div>

              <button
                onClick={() => setShowBuyQuotaModal(true)}
                className="w-full mt-2 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/30 hover:border-amber-500/50 rounded text-xs text-amber-500 hover:text-amber-400 transition-all flex items-center justify-center gap-1.5"
                title="购买配额加油包"
              >
                <span>💎</span> 购买配额加油包
              </button>

              {queueLength > 0 && (
                <div className="flex justify-between items-center pt-1.5 border-t border-zinc-800 mt-1.5">
                  <span className="text-xs text-zinc-500">🕒 队列中</span>
                  <span className="text-xs font-medium text-yellow-400">
                    {queueLength} 个任务
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider px-2 mb-2">
            <div className="flex items-center gap-2">
              <HistoryIcon className="w-4 h-4" />
              <span>创作历史</span>
            </div>
            {tasks.length > 0 && (
              <button
                onClick={handleClearAllTasks}
                className="text-[10px] text-red-500/70 hover:text-red-500 transition-colors"
              >
                清空
              </button>
            )}
          </div>

          {
            tasks.length === 0 ? (
              <div className="text-center py-10 px-4">
                <p className="text-zinc-600 text-sm">暂无任务</p>
                <p className="text-zinc-700 text-xs mt-1">开始生成视频或图片吧</p>
              </div>
            ) : (
              tasks.map((task: GenerationTask) => (
                <button
                  key={task.id}
                  onClick={() => setActiveTaskId(task.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all group relative overflow-hidden ${activeTask?.id === task.id
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
                    <div className="flex gap-2 items-center">
                      <span className="text-[10px] text-zinc-500">
                        {new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        onClick={(e: React.MouseEvent) => handleDeleteTask(e, task.id)}
                        className="p-1.5 rounded-lg text-zinc-600 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                        title="删除任务"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    {task.imagePreviewUrl && (
                      <img src={task.imagePreviewUrl} alt="ref" className="w-8 h-8 rounded object-cover border border-zinc-700 flex-shrink-0" />
                    )}
                    {task.type === 'IMAGE' && task.imageUrl && (
                      <img src={getProxiedUrl(task.imageUrl)} alt="res" className="w-8 h-8 rounded object-cover border border-zinc-700 flex-shrink-0" />
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
            )
          }
        </div >
      </aside >

      {/* Main Content */}
      < main className="flex-1 flex flex-col h-[65vh] md:h-screen overflow-hidden relative" >

        {/* Top Bar */}
        < header className="h-14 border-b border-zinc-900 flex items-center justify-between px-6 bg-black/80 backdrop-blur-md z-10 sticky top-0" >
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 text-sm font-medium">AI 创意控制台</span>
          </div>
          <div className="flex items-center gap-3">
            {/* 用户菜单 */}
            {isAuthenticated ? (
              <div className="relative group">
                <button className="text-xs px-3 py-1.5 rounded-full bg-purple-600/20 text-purple-400 border border-purple-600/30 hover:bg-purple-600/30 transition-colors flex items-center gap-2">
                  <span>👤</span>
                  {userProfile?.username || '用户'}
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-20">
                  <div className="p-3 border-b border-zinc-800">
                    <p className="text-sm font-medium text-white truncate">{userProfile?.username || '用户'}</p>
                    <p className="text-xs text-zinc-500 truncate">{userProfile?.email || ''}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                  >
                    退出登录
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="text-xs px-3 py-1.5 rounded-full bg-purple-600 text-white hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                登录/注册
              </button>
            )}
            <button
              onClick={!isGoogleConnected ? handleConnectGoogle : () => setShowConfig(!showConfig)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-2 ${isGoogleConnected
                ? 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20'
                : 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600'
                }`}
            >
              <SettingsIcon className="w-3 h-3" />
              {isGoogleConnected ? 'Google 已连接 (点击配置代理)' : '连接 Google 账号'}
            </button>
          </div>
        </header >

        {/* Workspace */}
        < div className="flex-1 flex flex-col md:flex-row overflow-hidden" >

          {/* Left Column: Input Area */}
          < div className="w-full md:w-1/2 lg:w-[40%] border-r border-zinc-900 flex flex-col bg-black" >

            {/* Tab Switcher */}
            < div className="flex border-b border-zinc-900" >
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
                className={`flex-1 py-3 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'image' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <ImageIcon className="w-4 h-4" />
                图片生成
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-3 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'chat' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <ChatIcon className="w-4 h-4" />
                对话
              </button>
            </div >

            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-xl mx-auto space-y-6">

                {/* Google Configuration (Hidden by default, showed if connected + clicked) */}
                {showConfig && (
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
                        默认为 Google 官方地址。如使用中转(OneAPI)，请填写代理地址。<br />
                        <span className="text-yellow-500/80">注意：部分中转站可能需要手动加上 /google 后缀</span>
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-zinc-400">Google API Key (可选)</label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => handleSaveApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full bg-black border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                      />
                      <p className="text-[10px] text-zinc-600">
                        如果您无法使用 AI Studio 自动授权 (如从外部浏览器访问)，请在此输入 API Key。
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
                          className={`relative group cursor-pointer border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all ${selectedImage ? 'border-purple-500/50 bg-purple-500/5' : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/30'
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

                    <button
                      onClick={handleGenerateVideo}
                      disabled={isSubmitting}
                      className={`w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all shadow-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-900/20 hover:shadow-purple-900/40 transform hover:-translate-y-0.5 active:translate-y-0 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <VideoIcon className="w-5 h-5" />
                      开始生成视频
                    </button>
                    <div className="text-center text-xs text-slate-600 py-2">
                      System v2026.01.02-Rev27 (Auto-Sync)
                    </div>
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
                      {(isGoogleConnected || isAuthenticated) ? '开始生成图片' : '请先登录或连接 Google 账号'}
                    </button>
                  </div>
                )}

                {/* ============ CHAT TAB CONTENT ============ */}
                {activeTab === 'chat' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div>
                      <h2 className="text-lg font-bold text-white mb-1">AI 助手</h2>
                      <p className="text-xs text-zinc-500">与 Gemini 1.5 Pro 对话，生成图片或分析内容。</p>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center py-12 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
                      <div className="w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full flex items-center justify-center mb-4">
                        <ChatIcon className="w-8 h-8 text-indigo-400" />
                      </div>
                      <h3 className="text-white font-medium mb-1">开始新对话</h3>
                      <p className="text-zinc-500 text-sm mb-6 text-center max-w-[200px]">
                        创建一个新的对话任务，支持多模态输入和生图。
                      </p>

                      <button
                        onClick={handleNewChat}
                        className="px-6 py-2.5 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-colors flex items-center gap-2"
                      >
                        <PlusIcon className="w-4 h-4" />
                        新建对话
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div >

          {/* Right Column: Preview Area */}
          < div className="w-full md:w-1/2 lg:w-[60%] bg-zinc-950 flex flex-col items-center justify-center p-6 relative border-l border-zinc-900/50" >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/40 to-zinc-950 -z-10"></div>

            {
              activeTask ? (
                activeTask.type === 'CHAT' ? (
                  <div className="w-full h-full p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <ChatInterface
                      task={activeTask}
                      apiKey={apiKey}
                      isAuthenticated={isAuthenticated}
                      onUpdateTask={handleUpdateTask}
                      onGenerateImage={handleGenerateImageForChat}
                    />
                  </div>
                ) : (
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
                          src={getProxiedUrl(activeTask.imageUrl)}
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
                )) : (
                // Empty State
                <div className="text-center space-y-4 max-w-sm">
                  <div className="w-24 h-24 bg-zinc-900/50 border border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
                    <SparklesIcon className="w-10 h-10 text-zinc-600 ml-1" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Sora 创意工坊</h3>
                  <p className="text-zinc-500 leading-relaxed">
                    选择上方 <strong>视频</strong> 或 <strong>图片</strong> 标签页，<br />输入提示词开始您的 AI 创作之旅。
                  </p>
                </div>
              )
            }
          </div >

        </div >
      </main >

      {/* 认证模态框 */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={() => {
          checkUserProfile();
          setShowAuthModal(false);
        }}
      />

      {/* 购买配额模态框 */}
      {showBuyQuotaModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowBuyQuotaModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              ✕
            </button>

            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <span className="text-2xl">💎</span> 购买配额加油包
            </h3>
            <p className="text-sm text-zinc-400 mb-6">购买后的额度将立即添加到您的账户，仅限当日有效。</p>

            <div className="space-y-3 mb-6">
              {paymentPackages.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 bg-black/20 rounded-lg">
                  暂无可用套餐，请联系管理员。
                </div>
              ) : (
                paymentPackages.map(pkg => (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPackage(pkg)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${selectedPackage?.id === pkg.id
                      ? 'bg-purple-600/20 border-purple-500 ring-1 ring-purple-500'
                      : 'bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800 hover:border-zinc-600'
                      }`}
                  >
                    <div className="text-left">
                      <div className="text-white font-bold text-base">{pkg.name}</div>
                      <div className="text-xs text-zinc-400 mt-1 flex gap-2">
                        {pkg.videoIncrease > 0 && <span className="bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded">视频 +{pkg.videoIncrease}</span>}
                        {pkg.imageIncrease > 0 && <span className="bg-pink-500/10 text-pink-400 px-1.5 py-0.5 rounded">图片 +{pkg.imageIncrease}</span>}
                        {pkg.chatIncrease > 0 && <span className="bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded">对话 +{pkg.chatIncrease}</span>}
                      </div>
                    </div>
                    <div className="text-xl font-bold text-white">
                      ¥ {pkg.price}
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Payment Content */}
            {selectedPackage && (
              <div className="bg-zinc-950 rounded-lg p-4 border border-zinc-800 text-center space-y-4 mb-4">
                {/* 1. Payment Method Detection */}
                {(!paymentConfig?.enabled || paymentConfig?.provider === 'manual') ? (
                  // Manual Mode
                  <>
                    <div className="text-sm text-zinc-400">请扫描下方二维码支付 <span className="text-white font-bold">¥{selectedPackage.price}</span></div>
                    <div className="w-48 h-48 bg-white mx-auto rounded-lg flex items-center justify-center overflow-hidden relative border-4 border-white">
                      {paymentConfig?.manualQrCodeUrl ? (
                        <img src={paymentConfig.manualQrCodeUrl} alt="Payment QR" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-black text-xs font-bold p-4 text-center">
                          管理员未配置收款码<br />请联系客服
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">支付时请备注您的邮箱，付款后点击下方按钮</p>

                    <button
                      disabled={isProcessingPayment}
                      onClick={() => handleConfirmPayment('manual')}
                      className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg"
                    >
                      {isProcessingPayment ? '正在提交订单...' : '我已支付，提交审核'}
                    </button>
                  </>
                ) : (
                  // Epay Mode (Auto)
                  <>
                    <div className="text-sm text-zinc-400">即将跳转至收银台，支付 <span className="text-white font-bold">¥{selectedPackage.price}</span></div>
                    <p className="text-xs text-zinc-500 mb-4">支付成功后自动到账，无需人工审核</p>

                    <button
                      disabled={isProcessingPayment}
                      onClick={() => handleConfirmPayment('epay')}
                      className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg"
                    >
                      {isProcessingPayment ? '正在创建...' : '立即支付 (Alipay/WeChat)'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      < AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div >
  );
};

export default App;
