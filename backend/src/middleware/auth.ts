import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';

export interface AuthRequest extends Request {
  userId?: string;
}

const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ error: 'Access denied. No token provided.' });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decoded = jwt.verify(token, jwtSecret) as { userId: string };

    req.userId = decoded.userId;

    // Check if user is banned
    const user = await UserModel.findById(decoded.userId);
    if (user && user.status === 'banned') {
      res.status(403).json({ error: 'Account suspended' });
      return;
    }

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const adminMiddleware = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // 1. 先验证 Token (通常 authMiddleware 应该已经运行过了，但为了安全起见或独立使用)
    if (!req.userId) {
      // 如果没有 flaged userId，说明还没经过 authMiddleware 或者 authMiddleware 失败
      // 在路由中通常写法是 router.get('/path', authMiddleware, adminMiddleware, ...)
      // 所以这里假设 req.userId 已经存在
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // 2. 检查用户角色
    const user = await UserModel.findById(req.userId);
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Access denied. Admin role required.' });
      return;
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ error: 'Server error during authorization' });
  }
};

export default authMiddleware;
