import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { TaskModel } from '../models/Task';
import { UserModel } from '../models/User';

// 获取用户所有任务
export const getTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tasks = await TaskModel.findByUserId(req.userId!);
    
    res.json({ tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// 创建新任务
export const createTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, prompt, model, imagePreviewUrl } = req.body;
    
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
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// 更新任务状态
export const updateTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    const { status, videoUrl, imageUrl, error } = req.body;
    
    const task = await TaskModel.findById(taskId);
    
    if (!task || task.userId !== req.userId) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    const updates: any = {};
    if (status) updates.status = status;
    if (videoUrl) updates.videoUrl = videoUrl;
    if (imageUrl) updates.imageUrl = imageUrl;
    if (error) updates.error = error;
    
    if (status === 'COMPLETED' || status === 'FAILED') {
      updates.completedAt = new Date();
    }
    
    await TaskModel.update(taskId, updates);
    
    const updatedTask = await TaskModel.findById(taskId);
    res.json({ task: updatedTask });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// 删除任务
export const deleteTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    
    const task = await TaskModel.findById(taskId);
    
    if (!task || task.userId !== req.userId) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    await TaskModel.delete(taskId);
    
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// 批量同步任务
export const syncTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tasks: clientTasks, lastSyncTime } = req.body;
    
    // 获取服务器上在 lastSyncTime 之后更新的任务
    const since = lastSyncTime ? new Date(lastSyncTime) : new Date(0);
    const serverTasks = await TaskModel.findByUserIdSince(req.userId!, since);
    
    // 合并策略：服务器优先
    res.json({
      tasks: serverTasks,
      syncTime: new Date(),
    });
  } catch (error) {
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
  } catch (error) {
    console.error('Get quota error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
