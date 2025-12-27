// User Quota Management Service
import { TaskType } from '../types';

interface QuotaConfig {
  dailyVideoLimit: number;
  dailyImageLimit: number;
  dailyChatLimit: number;
  maxConcurrentTasks: number;
}

interface UsageStats {
  videoCount: number;
  imageCount: number;
  chatCount: number;
  lastReset: number;
}

const DEFAULT_QUOTA: QuotaConfig = {
  dailyVideoLimit: 10,
  dailyImageLimit: 50,
  dailyChatLimit: 50,
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
        const parsed = JSON.parse(stored);
        // Ensure chatCount exists for legacy data
        if (parsed.chatCount === undefined) parsed.chatCount = 0;
        return parsed;
      }
    } catch (e) {
      console.error('Failed to load usage stats:', e);
    }

    return {
      videoCount: 0,
      imageCount: 0,
      chatCount: 0,
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
        chatCount: 0,
        lastReset: now,
      };
      this.saveUsage();
    }
  }

  canGenerate(type: TaskType): boolean {
    this.checkAndResetDaily();

    if (type === 'VIDEO') {
      return this.usage.videoCount < this.quota.dailyVideoLimit;
    } else if (type === 'IMAGE') {
      return this.usage.imageCount < this.quota.dailyImageLimit;
    } else if (type === 'CHAT') {
      return this.usage.chatCount < this.quota.dailyChatLimit;
    }
    return false;
  }

  incrementUsage(type: TaskType) {
    if (type === 'VIDEO') {
      this.usage.videoCount++;
    } else if (type === 'IMAGE') {
      this.usage.imageCount++;
    } else if (type === 'CHAT') {
      this.usage.chatCount++;
    }
    this.saveUsage();
  }

  getRemainingQuota(type: TaskType): number {
    this.checkAndResetDaily();

    if (type === 'VIDEO') {
      return Math.max(0, this.quota.dailyVideoLimit - this.usage.videoCount);
    } else if (type === 'IMAGE') {
      return Math.max(0, this.quota.dailyImageLimit - this.usage.imageCount);
    } else if (type === 'CHAT') {
      return Math.max(0, this.quota.dailyChatLimit - this.usage.chatCount);
    }
    return 0;
  }

  getUsageStats(): any { // Returning any to match implicit QuotaStats roughly or defined interface
    this.checkAndResetDaily();
    return {
      ...this.usage,
      dailyVideoLimit: this.quota.dailyVideoLimit,
      dailyImageLimit: this.quota.dailyImageLimit,
      dailyChatLimit: this.quota.dailyChatLimit,
      videoLimit: this.quota.dailyVideoLimit, // Legacy alias
      imageLimit: this.quota.dailyImageLimit, // Legacy alias
    };
  }

  getMaxConcurrentTasks(): number {
    return this.quota.maxConcurrentTasks;
  }

  // 管理员/后端同步功能：设置配额
  setQuota(newQuota: Partial<QuotaConfig>) {
    this.quota = { ...this.quota, ...newQuota };
  }

  // 同步后端使用量 (重要：覆盖本地使用量)
  syncUsage(stats: { videoCount: number; imageCount: number; chatCount: number; lastReset?: Date | number }) {
    this.usage.videoCount = stats.videoCount;
    this.usage.imageCount = stats.imageCount;
    this.usage.chatCount = stats.chatCount || 0;
    if (stats.lastReset) {
      this.usage.lastReset = typeof stats.lastReset === 'number' ? stats.lastReset : new Date(stats.lastReset).getTime();
    }
    this.saveUsage();
  }

  // 重置今日配额（仅用于测试）
  resetDailyQuota() {
    this.usage = {
      videoCount: 0,
      imageCount: 0,
      chatCount: 0,
      lastReset: Date.now(),
    };
    this.saveUsage();
  }
}

export const quotaService = new QuotaService();
