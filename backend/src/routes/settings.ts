import { Router } from 'express';
import { AdminController } from '../controllers/adminController';

const router = Router();

// Public settings endpoint (Announcements, Payment Packages, etc.)
// No auth middleware needed as announcements might be public
// 获取公开配置 (脱敏)
router.get('/', AdminController.getPublicSettings);

export default router;
