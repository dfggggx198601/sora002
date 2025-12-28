import { Router } from 'express';
import authMiddleware, { adminMiddleware } from '../middleware/auth';
import { AdminController } from '../controllers/adminController';

const router = Router();

// 所有管理路由都需要管理员权限
router.use(authMiddleware);
router.use(adminMiddleware);

// 统计信息
router.get('/stats', AdminController.getStats);

// 用户管理
router.get('/users', AdminController.getUsers);
router.put('/users/:userId', AdminController.updateUser);
router.put('/users/:userId/password', AdminController.resetPassword);

// 内容管理
router.get('/tasks', AdminController.getTasks);
router.delete('/tasks/:taskId', AdminController.deleteTask);

// 订单管理
router.get('/orders', AdminController.getOrders);
router.put('/orders/:orderId/verify', AdminController.verifyOrder);

// 系统设置
router.get('/settings', AdminController.getSettings);
router.put('/settings', AdminController.updateSettings);

export default router;