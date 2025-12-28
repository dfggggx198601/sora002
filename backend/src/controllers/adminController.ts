import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserModel } from '../models/User';
import { TaskModel } from '../models/Task';
import { SettingsModel } from '../models/Settings';
import { getDB } from '../config/database';

export class AdminController {

  // 获取仪表盘统计信息
  static async getStats(req: Request, res: Response) {
    try {
      const db = getDB();
      // 1. 用户总数
      const usersSnapshot = await db.collection('users').count().get();
      const totalUsers = usersSnapshot.data().count;

      // 2. 任务总数
      const tasksSnapshot = await db.collection('tasks').count().get();
      const totalTasks = tasksSnapshot.data().count;

      // 3. 24小时生成量
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recentTasksSnapshot = await db.collection('tasks')
        .where('createdAt', '>', oneDayAgo)
        .count()
        .get();
      const generatedLast24h = recentTasksSnapshot.data().count;

      // 4. 获取最近 7 天的生成趋势 (模拟数据)
      const weeklyTrend = [
        { date: 'Mon', count: 0 },
        { date: 'Tue', count: 0 },
        { date: 'Wed', count: 0 },
        { date: 'Thu', count: 0 },
        { date: 'Fri', count: 0 },
        { date: 'Sat', count: 0 },
        { date: 'Sun', count: 0 },
      ];

      res.status(200).json({
        totalUsers,
        totalTasks,
        generatedLast24h,
        weeklyTrend
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  }

  // 获取用户列表 (带分页)
  static async getUsers(req: Request, res: Response) {
    try {
      const db = getDB();
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      const snapshot = await db.collection('users')
        .orderBy('createdAt', 'desc')
        .offset(offset)
        .limit(limit)
        .get();

      const users = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        const q = data.quota || {};

        // 安全地处理 lastReset，防止因类型不匹配导致崩溃
        let lastReset = new Date();
        if (q.lastReset) {
          // 检查是否为 Firestore Timestamp (有 toDate 方法)
          if (typeof q.lastReset.toDate === 'function') {
            lastReset = q.lastReset.toDate();
          } else if (typeof q.lastReset === 'string') {
            // 如果被错误地存为了字符串，尝试解析
            lastReset = new Date(q.lastReset);
          } else if (q.lastReset instanceof Date) {
            lastReset = q.lastReset;
          }
        }

        return {
          id: doc.id,
          ...data,
          status: data.status || 'active',
          quota: {
            dailyVideoLimit: q.dailyVideoLimit || 10,
            dailyImageLimit: q.dailyImageLimit || 50,
            dailyChatLimit: q.dailyChatLimit || 50,
            videoCount: q.videoCount || 0,
            imageCount: q.imageCount || 0,
            chatCount: q.chatCount || 0,
            lastReset: lastReset,
          }
        };
      });

      // Get total count for pagination
      const countSnapshot = await db.collection('users').count().get();
      const total = countSnapshot.data().count;

      res.status(200).json({
        users,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  // 更新用户信息
  static async updateUser(req: Request, res: Response) {
    try {
      const db = getDB();
      const { userId } = req.params;
      const updates = req.body;

      const filteredUpdates: any = {};

      // 1. 处理 Status 和 Role
      if (updates.role) filteredUpdates.role = updates.role;
      if (updates.status) filteredUpdates.status = updates.status;

      // 2. 特殊处理 Quota (使用点符号更新以避免覆盖整个对象，并过滤掉错误的 lastReset)
      if (updates.quota && typeof updates.quota === 'object') {
        const q = updates.quota;
        if (q.dailyVideoLimit !== undefined) filteredUpdates['quota.dailyVideoLimit'] = Number(q.dailyVideoLimit);
        if (q.dailyImageLimit !== undefined) filteredUpdates['quota.dailyImageLimit'] = Number(q.dailyImageLimit);
        if (q.dailyChatLimit !== undefined) filteredUpdates['quota.dailyChatLimit'] = Number(q.dailyChatLimit);

        // 如果管理员确实想重置计数，也允许更新
        if (q.videoCount !== undefined) filteredUpdates['quota.videoCount'] = Number(q.videoCount);
        if (q.imageCount !== undefined) filteredUpdates['quota.imageCount'] = Number(q.imageCount);
        if (q.chatCount !== undefined) filteredUpdates['quota.chatCount'] = Number(q.chatCount);

        // 注意：我们故意忽略 quota.lastReset，防止前端传来的字符串覆盖数据库中的 Timestamp
      }

      if (Object.keys(filteredUpdates).length === 0) {
        return res.status(400).json({ error: 'No valid updates provided' });
      }

      await db.collection('users').doc(userId).update(filteredUpdates);

      res.status(200).json({ message: 'User updated successfully' });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }

  // 重置用户密码
  static async resetPassword(req: Request, res: Response) {
    try {
      const db = getDB();
      const { userId } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await db.collection('users').doc(userId).update({
        password: hashedPassword
      });

      res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  }

  // 获取任务列表 (管理端)
  static async getTasks(req: Request, res: Response) {
    try {
      const db = getDB();
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const snapshot = await db.collection('tasks')
        .orderBy('createdAt', 'desc')
        .offset(offset)
        .limit(limit)
        .get();

      const tasks = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));

      const countSnapshot = await db.collection('tasks').count().get();
      const total = countSnapshot.data().count;

      res.status(200).json({
        tasks,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error('Get tasks error:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  }

  // 删除任务
  static async deleteTask(req: Request, res: Response) {
    try {
      const db = getDB();
      const { taskId } = req.params;
      await db.collection('tasks').doc(taskId).delete();
      res.status(200).json({ message: 'Task deleted' });
    } catch (error) {
      console.error('Delete task error:', error);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  }

  // 获取系统设置
  static async getSettings(req: Request, res: Response) {
    try {
      // 禁用缓存
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const settings = await SettingsModel.getSettings();

      // Sanitization:
      // Typically we hide sensitive keys (payment keys, etc.) from public endpoint.
      // But user REQUESTED to load keys into frontend for v0.2 style direct calls.
      // We will expose the *first* available Google Key if AI is enabled, to be used by frontend.
      // Payment keys (epayKey) should still be hidden.

      const publicSettings = {
        ...settings,
        paymentConfig: {
          ...settings.paymentConfig,
          epayKey: undefined, // Hide secret
          epayPid: undefined // Hide pid if sensitive (often public-ish but safer to hide)
        },
        aiConfig: {
          enabled: settings.aiConfig?.enabled,
          // EXPOSE KEY for Frontend v0.2 Style (Direct Call)
          // Only expose if enabled.
          apiKey: (settings.aiConfig?.enabled && settings.aiConfig?.googleKeys?.length > 0)
            ? settings.aiConfig.googleKeys[0]
            : undefined,
          baseUrl: settings.aiConfig?.baseUrl
        }
      };

      res.status(200).json(publicSettings);
    } catch (error) {
      console.error('Get settings error:', error);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  }

  // 更新系统设置
  static async updateSettings(req: Request, res: Response) {
    try {
      const updates = req.body;
      console.log('Received settings update:', JSON.stringify(updates, null, 2));

      // 显式提取字段以确保数据纯净 (Sanitization)
      const cleanSettings: any = {};

      if (updates.announcement) {
        cleanSettings.announcement = {
          message: updates.announcement.message || '',
          enabled: !!updates.announcement.enabled,
          type: updates.announcement.type || 'info'
        };
      }

      if (updates.maintenanceMode !== undefined) {
        cleanSettings.maintenanceMode = !!updates.maintenanceMode;
      }

      if (updates.initialQuota) {
        cleanSettings.initialQuota = {
          dailyVideoLimit: Number(updates.initialQuota.dailyVideoLimit) || 0,
          dailyImageLimit: Number(updates.initialQuota.dailyImageLimit) || 0,
          dailyChatLimit: Number(updates.initialQuota.dailyChatLimit) || 0
        };
      }

      if (updates.paymentPackages && Array.isArray(updates.paymentPackages)) {
        cleanSettings.paymentPackages = updates.paymentPackages.map((pkg: any) => ({
          id: pkg.id || Date.now().toString(),
          name: pkg.name || 'Defult Package',
          price: Number(pkg.price) || 0,
          videoIncrease: Number(pkg.videoIncrease) || 0,
          imageIncrease: Number(pkg.imageIncrease) || 0,
          chatIncrease: Number(pkg.chatIncrease) || 0
        }));
      }

      if (updates.paymentConfig) {
        cleanSettings.paymentConfig = {
          enabled: !!updates.paymentConfig.enabled,
          provider: updates.paymentConfig.provider || 'manual',
          manualQrCodeUrl: updates.paymentConfig.manualQrCodeUrl || '',
          epayApiUrl: updates.paymentConfig.epayApiUrl || '',
          epayPid: updates.paymentConfig.epayPid || '',
          epayKey: updates.paymentConfig.epayKey || ''
        };
      }

      if (updates.aiConfig) {
        cleanSettings.aiConfig = {
          enabled: !!updates.aiConfig.enabled,
          googleKeys: Array.isArray(updates.aiConfig.googleKeys) ? updates.aiConfig.googleKeys.filter((k: any) => typeof k === 'string' && k.trim() !== '') : []
        };
      }

      await SettingsModel.updateSettings(cleanSettings);
      res.status(200).json({ message: 'Settings updated' });
    } catch (error) {
      console.error('Update settings error:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
  // 获取订单列表
  static async getOrders(req: Request, res: Response) {
    try {
      const { OrderModel } = await import('../models/Order');
      const orders = await OrderModel.getPendingOrders();

      // Enrich with user email
      const enrichedOrders = await Promise.all(orders.map(async (order) => {
        const user = await UserModel.findById(order.userId);
        return {
          ...order,
          userEmail: user?.email || 'Unknown User'
        };
      }));

      res.status(200).json(enrichedOrders);
    } catch (error) {
      console.error('Get orders error:', error);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  }

  // 审核订单 (同意/拒绝)
  static async verifyOrder(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const { action } = req.body; // 'approve' | 'reject'

      const { OrderModel } = await import('../models/Order');
      const order = await OrderModel.findById(orderId);

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (order.status !== 'pending') {
        return res.status(400).json({ error: 'Order is not pending' });
      }

      if (action === 'reject') {
        await OrderModel.updateStatus(orderId, 'cancelled');
        return res.status(200).json({ message: 'Order rejected' });
      }

      if (action === 'approve') {
        // 1. Update Order Status
        await OrderModel.updateStatus(orderId, 'paid');

        // 2. Add Quota to User
        const user = await UserModel.findById(order.userId);
        if (user) {
          const pkg = order.packageSnapshot;
          const newQuota = { ...user.quota };

          // Must ensure count doesn't go below reasonable logic, but essentially we subtract 'count' to add 'allowance'
          newQuota.videoCount = Math.max(-9999, newQuota.videoCount - pkg.videoIncrease);
          newQuota.imageCount = Math.max(-9999, newQuota.imageCount - pkg.imageIncrease);
          newQuota.chatCount = Math.max(-9999, newQuota.chatCount - pkg.chatIncrease);

          await UserModel.update(user.id!, { quota: newQuota });
        }

        return res.status(200).json({ message: 'Order approved and quota added' });
      }

      return res.status(400).json({ error: 'Invalid action' });
    } catch (error) {
      console.error('Verify order error:', error);
      res.status(500).json({ error: 'Failed to verify order' });
    }
  }
}