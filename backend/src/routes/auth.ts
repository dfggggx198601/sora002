import { Router } from 'express';
import { register, login, getProfile, buyQuota } from '../controllers/authController';
import authMiddleware from '../middleware/auth';

const router = Router();

// 公开路由
router.post('/register', register);
router.post('/login', login);

// 受保护路由
router.get('/profile', authMiddleware, getProfile);
router.post('/buy-quota', authMiddleware, buyQuota);

export default router;
