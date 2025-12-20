import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';

export interface AdminRequest extends Request {
  userId?: string;
  userRole?: 'user' | 'admin';
}

const adminMiddleware = async (req: AdminRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      res.status(401).json({ error: 'Access denied. No token provided.' });
      return;
    }
    
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decoded = jwt.verify(token, jwtSecret) as { userId: string };
    
    // 验证用户是否存在且为管理员
    const user = await UserModel.findById(decoded.userId);
    if (!user) {
      res.status(401).json({ error: 'Invalid token: user not found' });
      return;
    }
    
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      return;
    }
    
    req.userId = decoded.userId;
    req.userRole = user.role;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export default adminMiddleware;