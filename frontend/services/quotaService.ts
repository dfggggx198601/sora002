// User Quota Management Service
import { TaskType } from '../types';

interface QuotaConfig {
  dailyVideoLimit: number;
  dailyImageLimit: number;
  maxConcurrentTasks: number;
}

interface UsageStats {
  videoCount: number;
  imageCount: number;
  lastReset: number;
}

const DEFAULT_QUOTA: QuotaConfig = {
  dailyVideoLimit: 10,
  dailyImageLimit: 50,
  maxConcurrentTasks: 3,
};

class QuotaService {
  private quota: QuotaConfig;
  private usage: UsageStats;
  private readonly STORAGE_KEY = 'sora_quota_usage';

  constructor() {
    this.quota = { ...DEFAULT_QUOTA };
    this.usage = this.loadUsage();
    this.checkAndResetDaily();
  }

  private loadUsage(): UsageStats {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load usage stats:', e);
    }
    
    return {
      videoCount: 0,
      imageCount: 0,
      lastReset: Date.now(),
    };
  }

  private saveUsage() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.usage));
    } catch (e) {
      console.error('Failed to save usage stats:', e);
    }
  }

  private checkAndResetDaily() {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    if (now - this.usage.lastReset > dayInMs) {
      this.usage = {
        videoCount: 0,
        imageCount: 0,
        lastReset: now,
      };
      this.saveUsage();
    }
  }

  canGenerate(type: TaskType): boolean {
    this.checkAndResetDaily();
    
    if (type === 'VIDEO') {
      return this.usage.videoCount < this.quota.dailyVideoLimit;
    } else {
      return this.usage.imageCount < this.quota.dailyImageLimit;
    }
  }

  incrementUsage(type: TaskType) {
    if (type === 'VIDEO') {
      this.usage.videoCount++;
    } else {
      this.usage.imageCount++;
    }
    this.saveUsage();
  }

  getRemainingQuota(type: TaskType): number {
    this.checkAndResetDaily();
    
    if (type === 'VIDEO') {
      return Math.max(0, this.quota.dailyVideoLimit - this.usage.videoCount);
    } else {
      return Math.max(0, this.quota.dailyImageLimit - this.usage.imageCount);
    }
  }

  getUsageStats(): UsageStats & { videoLimit: number; imageLimit: number } {
    this.checkAndResetDaily();
    return {
      ...this.usage,
      videoLimit: this.quota.dailyVideoLimit,
      imageLimit: this.quota.dailyImageLimit,
    };
  }

  getMaxConcurrentTasks(): number {
    return this.quota.maxConcurrentTasks;
  }

  // 管理员功能：设置配额
  setQuota(newQuota: Partial<QuotaConfig>) {
    this.quota = { ...this.quota, ...newQuota };
  }

  // 重置今日配额（仅用于测试）
  resetDailyQuota() {
    this.usage = {
      videoCount: 0,
      imageCount: 0,
      lastReset: Date.now(),
    };
    this.saveUsage();
  }
}

export const quotaService = new QuotaService();
