
export enum GenerationStatus {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING', // 正在生成
  COMPLETED = 'COMPLETED',   // 完成
  FAILED = 'FAILED'          // 失败
}

export type TaskType = 'VIDEO' | 'IMAGE';

export interface GenerationTask {
  id: string;
  type: TaskType; // 任务类型：视频 或 图片
  status: GenerationStatus;
  prompt: string;
  model: string;
  createdAt: number;
  completedAt?: number; // 完成或失败的时间戳
  videoUrl?: string; // 完成后才有 (视频任务)
  imageUrl?: string; // 完成后才有 (图片任务)
  error?: string;    // 失败后才有
  imagePreviewUrl?: string; // 如果是图生视频，保存图片的预览链接
}

export interface GenerationConfig {
  prompt: string;
  image?: File;
  model: string;
  aspectRatio?: string;
}

export interface CustomApiConfig {
  baseUrl: string;
  apiKey: string;
  endpointPath: string;
}

export interface AppSettings extends CustomApiConfig {
  googleApiKey?: string;
}
export interface QuotaStats {
  videoCount: number;
  videoLimit: number;
  imageCount: number;
  imageLimit: number;
  dailyVideoLimit: number;
  dailyImageLimit: number;
  lastReset: string | number | Date;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
  quota: QuotaStats;
}
