import { Response } from 'express';
import { AdminRequest } from '../middleware/admin';
import { UserModel } from '../models/User';
import { TaskModel } from '../models/Task';

// 获取所有用户（分页）
export const getAllUsers = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    
    // 这里我们需要实现分页查询
    // 由于 Firestore 不直接支持分页，我们模拟实现
    const db = require('../config/database').getDB();
    const snapshot = await db.collection('users')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset(offset)
      .get();
    
    const users = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email,
        username: data.username,
        role: data.role,
        createdAt: data.createdAt.toDate(),
        lastLogin: data.lastLogin?.toDate(),
        quota: data.quota,
      };
    });
    
    res.json({ users, page, limit });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// 获取用户详情
export const getUserById = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    // 不返回密码
    const { password, ...userWithoutPassword } = user;
    
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// 更新用户信息（包括角色和配额）
export const updateUser = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    
    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    // 过滤不允许更新的字段
    const allowedUpdates = ['username', 'role', 'quota'];
    const filteredUpdates: any = {};
    
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });
    
    await UserModel.update(userId, filteredUpdates);
    
    const updatedUser = await UserModel.findById(userId);
    const { password, ...userWithoutPassword } = updatedUser!;
    
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// 删除用户
export const deleteUser = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    // 删除用户的所有任务
    const db = require('../config/database').getDB();
    const tasksSnapshot = await db.collection('tasks')
      .where('userId', '==', userId)
      .get();
    
    const batch = db.batch();
    tasksSnapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    // 删除用户
    await UserModel.delete(userId);
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// 获取所有任务（分页）
export const getAllTasks = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    
    // 获取所有任务
    const db = require('../config/database').getDB();
    const snapshot = await db.collection('tasks')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset(offset)
      .get();
    
    const tasks = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        type: data.type,
        status: data.status,
        prompt: data.prompt,
        modelName: data.modelName,
        createdAt: data.createdAt.toDate(),
        completedAt: data.completedAt?.toDate(),
        videoUrl: data.videoUrl,
        imageUrl: data.imageUrl,
        imagePreviewUrl: data.imagePreviewUrl,
        error: data.error,
      };
    });
    
    res.json({ tasks, page, limit });
  } catch (error) {
    console.error('Get all tasks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// 获取系统统计信息
export const getSystemStats = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const db = require('../config/database').getDB();
    
    // 获取用户总数
    const usersSnapshot = await db.collection('users').get();
    const totalUsers = usersSnapshot.size;
    
    // 获取任务总数
    const tasksSnapshot = await db.collection('tasks').get();
    const totalTasks = tasksSnapshot.size;
    
    // 获取今日任务数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTasksSnapshot = await db.collection('tasks')
      .where('createdAt', '>=', today)
      .get();
    const todayTasks = todayTasksSnapshot.size;
    
    // 获取活跃用户数（最近7天登录）
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const activeUsersSnapshot = await db.collection('users')
      .where('lastLogin', '>=', weekAgo)
      .get();
    const activeUsers = activeUsersSnapshot.size;
    
    res.json({
      stats: {
        totalUsers,
        totalTasks,
        todayTasks,
        activeUsers,
      }
    });
  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};