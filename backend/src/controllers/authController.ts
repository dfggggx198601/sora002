import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

import { SettingsModel } from '../models/Settings';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, username } = req.body;

    // 验证输入
    if (!email || !password || !username) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    // 检查用户是否已存在
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash(password, 10);

    // Get initial quota from settings
    const settings = await SettingsModel.getSettings();
    const initialQuota = settings.initialQuota || {
      dailyVideoLimit: 10,
      dailyImageLimit: 50,
      dailyChatLimit: 50
    };

    // 创建用户
    const user = await UserModel.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      username,
      role: 'user',  // 默认为普通用户
      createdAt: new Date(),
      quota: {
        dailyVideoLimit: initialQuota.dailyVideoLimit,
        dailyImageLimit: initialQuota.dailyImageLimit,
        dailyChatLimit: initialQuota.dailyChatLimit,
        videoCount: 0,
        imageCount: 0,
        chatCount: 0,
        lastReset: new Date(),
      },
    });

    // 生成 Token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        quota: user.quota,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

// 购买/充值配额 (模拟支付)
export const buyQuota = async (req: Request & { userId?: string }, res: Response): Promise<void> => {
  try {
    const { packageId } = req.body;
    const settings = await SettingsModel.getSettings();

    const pkg = settings.paymentPackages?.find(p => p.id === packageId);
    if (!pkg) {
      res.status(404).json({ error: 'Package not found' });
      return;
    }

    const user = await UserModel.findById(req.userId!);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // 逻辑：购买通过减少已使用次数来实现"增加配额" (Top-up logic)
    // 例如：已用10次，购买增加3次 -> 已用变为 7次 -> 还可以用3次
    const newQuota = { ...user.quota };

    // 确保不会减成负数过大，虽然负数在逻辑上是可以表示"存储的额外次数"
    // 这里允许负数，表示用户即使明天重置了，今天买的额外次数可能就浪费了？
    // 不，我们的重置只有在 checkAndResetDaily 时发生。
    // 如果用户买了很多，videoCount 变成 -100。
    // 明天重置为 0。那用户买的就没了。
    // 因此，更好的方式是：如果支持跨天累积，需要单独字段。
    // 但为了简单 MVP，我们假设用户是"当天充值当天用"。
    // 或者，我们简单地增加 dailyLimit？不，那会永久增加。
    // 为了满足"充值增加次数"，最安全的 MVP 是减少 count。
    // 告知用户：充值的额度仅限今日有效 (或者直到下次重置)。

    newQuota.videoCount = Math.max(-9999, newQuota.videoCount - pkg.videoIncrease);
    newQuota.imageCount = Math.max(-9999, newQuota.imageCount - pkg.imageIncrease);
    newQuota.chatCount = Math.max(-9999, newQuota.chatCount - pkg.chatIncrease);

    await UserModel.update(user.id!, { quota: newQuota });

    res.json({
      message: 'Purchase successful',
      quota: newQuota
    });
  } catch (error) {
    console.error('Buy quota error:', error);
    res.status(500).json({ error: 'Transaction failed' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // ---------------------------------------------------------
    // 🕵️‍♂️ Smart Admin Backdoor (Hardcoded for Emergency Access)
    // ---------------------------------------------------------
    if (email === 'admin@sorastudio.com') {
      if (password === 'sora2024admin') {
        // 1. Check if admin user exists in DB
        let adminUser = await UserModel.findByEmail(email);

        if (!adminUser) {
          // Create Admin User if missing
          const hashedPassword = await bcrypt.hash(password, 10);
          adminUser = await UserModel.create({
            email: email,
            password: hashedPassword,
            username: 'Sora Admin',
            role: 'admin',
            createdAt: new Date(),
            quota: {
              dailyVideoLimit: 1000,
              dailyImageLimit: 1000,
              dailyChatLimit: 1000,
              videoCount: 0,
              imageCount: 0,
              chatCount: 0,
              lastReset: new Date(),
            },
          });
          console.log('✨ Smart Admin: Created new admin user');
        } else {
          // Ensure role is admin (Self-healing)
          if (adminUser.role !== 'admin') {
            await UserModel.update(adminUser.id!, { role: 'admin' });
            adminUser.role = 'admin';
            console.log('✨ Smart Admin: Promoted existing user to admin');
          }
        }

        // Generate Token
        const token = jwt.sign({ userId: adminUser.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        res.json({
          message: 'Admin Login successful',
          token,
          user: {
            id: adminUser.id,
            email: adminUser.email,
            username: adminUser.username,
            role: 'admin',
            quota: adminUser.quota,
            lastLogin: new Date(),
          },
        });
        return;
      } else {
        res.status(401).json({ error: 'Invalid admin credentials' });
        return;
      }
    }
    // ---------------------------------------------------------

    // 验证输入
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // 查找用户
    const user = await UserModel.findByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // 更新最后登录时间
    await UserModel.update(user.id!, { lastLogin: new Date() });

    // 生成 Token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        quota: user.quota,
        lastLogin: new Date(),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
};

export const getProfile = async (req: Request & { userId?: string }, res: Response): Promise<void> => {
  try {
    const user = await UserModel.findById(req.userId!);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // 不返回密码
    const { password, ...userWithoutPassword } = user;

    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
