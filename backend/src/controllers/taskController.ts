import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { TaskModel } from '../models/Task';
import { UserModel } from '../models/User';
import { StorageService } from '../utils/storage';

// 获取用户所有任务
export const getTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tasks = await TaskModel.findByUserId(req.userId!);

    res.json({ tasks });
  } catch (error: any) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// 创建新任务
export const createTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, prompt, model, imagePreviewUrl } = (req as any).body;

    if (!type || !prompt || !model) {
      res.status(400).json({ error: 'Type, prompt, and model are required' });
      return;
    }

    // 检查配额
    const user = await UserModel.findById(req.userId!);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // 检查是否需要重置配额
    const now = new Date();
    const dayInMs = 24 * 60 * 60 * 1000;
    if (now.getTime() - user.quota.lastReset.getTime() > dayInMs) {
      await UserModel.update(user.id!, {
        quota: {
          ...user.quota,
          videoCount: 0,
          imageCount: 0,
          lastReset: now,
        },
      });
      user.quota.videoCount = 0;
      user.quota.imageCount = 0;
      user.quota.lastReset = now;
    }

    // 验证配额
    if (type === 'VIDEO' && user.quota.videoCount >= user.quota.dailyVideoLimit) {
      res.status(429).json({
        error: 'Daily video quota exceeded',
        remaining: 0,
        limit: user.quota.dailyVideoLimit
      });
      return;
    }

    if (type === 'IMAGE' && user.quota.imageCount >= user.quota.dailyImageLimit) {
      res.status(429).json({
        error: 'Daily image quota exceeded',
        remaining: 0,
        limit: user.quota.dailyImageLimit
      });
      return;
    }

    // 创建任务
    const task = await TaskModel.create({
      userId: req.userId!,
      type,
      prompt,
      modelName: model,
      imagePreviewUrl,
      status: 'GENERATING',
      createdAt: new Date(),
    });

    // 更新配额
    const newQuota = { ...user.quota };
    if (type === 'VIDEO') {
      newQuota.videoCount++;
    } else {
      newQuota.imageCount++;
    }
    await UserModel.update(user.id!, { quota: newQuota });

    res.status(201).json({ task, quota: newQuota });
  } catch (error: any) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// 更新任务状态
export const updateTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { taskId } = (req as any).params;
    const { status, videoUrl, imageUrl, error } = (req as any).body;

    const task = await TaskModel.findById(taskId);

    if (!task || task.userId !== req.userId) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const updates: any = {};
    if (status) updates.status = status;
    if (videoUrl) updates.videoUrl = videoUrl;

    if (imageUrl) {
      // 检查图片大小，Firestore 限制 1MB
      if (imageUrl.length > 1000000) {
        console.warn(`Task ${taskId} image too large, refusing to sync to Firestore`);
        // 我们可以选择不更新 imageUrl，或者只存一个占位符
        updates.error = "(图片超过 1MB，无法同步到云端)";
      } else {
        updates.imageUrl = imageUrl;
      }
    }

    if (error) updates.error = error;

    if (status === 'COMPLETED' || status === 'FAILED') {
      updates.completedAt = new Date();
    }

    await TaskModel.update(taskId, updates);

    const updatedTask = await TaskModel.findById(taskId);
    res.json({ task: updatedTask });

    // --- 后台处理：持久化到 Cloud Storage (if needed) ---
    // 异步执行，不阻塞返回结果
    if (status === 'COMPLETED' || (videoUrl && !videoUrl.includes('storage.googleapis.com')) || (imageUrl && !imageUrl.includes('storage.googleapis.com'))) {
      (async () => {
        try {
          const updates: any = {};
          let needsUpdate = false;

          // 处理图片 (可能是 base64)
          if (imageUrl && !imageUrl.includes('storage.googleapis.com')) {
            console.log(`[TaskController] Migrating image for task ${taskId} to Cloud Storage`);
            if (imageUrl.startsWith('data:')) {
              updates.imageUrl = await StorageService.uploadFromBase64(imageUrl);
              needsUpdate = true;
            } else if (imageUrl.startsWith('http')) {
              updates.imageUrl = await StorageService.uploadFromUrl(imageUrl, 'images');
              needsUpdate = true;
            }
          }

          // 处理视频 (通常是 URL)
          if (videoUrl && !videoUrl.includes('storage.googleapis.com') && videoUrl.startsWith('http')) {
            console.log(`[TaskController] Migrating video for task ${taskId} to Cloud Storage`);
            updates.videoUrl = await StorageService.uploadFromUrl(videoUrl, 'videos');
            needsUpdate = true;
          }

          if (needsUpdate) {
            await TaskModel.update(taskId, updates);
            console.log(`[TaskController] Task ${taskId} successfully migrated to Cloud Storage`);
          }
        } catch (storageError) {
          console.error(`[TaskController] Background storage migration failed for task ${taskId}:`, storageError);
        }
      })();
    }
  } catch (error: any) {
    console.error('Update task error:', error);
    // 返回更具体的错误信息
    const status = error.code === 3 ? 400 : 500; // Firestore 3 = INVALID_ARGUMENT
    res.status(status).json({
      error: error.message || 'Server error',
      details: error.code === 3 ? 'Document size too large or invalid data' : undefined
    });
  }
};

// 删除单个任务
export const deleteTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { taskId } = (req as any).params;

    const task = await TaskModel.findById(taskId);

    if (!task || task.userId !== req.userId) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    await TaskModel.delete(taskId);

    res.json({ message: 'Task deleted successfully' });
  } catch (error: any) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// 清空用户所有任务
export const clearTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await TaskModel.clearAllByUserId(req.userId!);
    res.json({ message: 'All tasks cleared successfully' });
  } catch (error: any) {
    console.error('Clear tasks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// 批量同步任务
export const syncTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tasks: clientTasks, lastSyncTime } = (req as any).body;

    // 获取服务器上在 lastSyncTime 之后更新的任务
    const since = lastSyncTime ? new Date(lastSyncTime) : new Date(0);
    const serverTasks = await TaskModel.findByUserIdSince(req.userId!, since);

    // 合并策略：服务器优先
    res.json({
      tasks: serverTasks,
      syncTime: new Date(),
    });
  } catch (error: any) {
    console.error('Sync tasks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// 获取配额信息
export const getQuota = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await UserModel.findById(req.userId!);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ quota: user.quota });
  } catch (error: any) {
    console.error('Get quota error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
