import { Router } from 'express';
import adminMiddleware from '../middleware/admin';
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getAllTasks,
  getSystemStats,
} from '../controllers/adminController';

const router = Router();

// 所有路由都需要管理员权限
router.use(adminMiddleware);

// 用户管理
router.get('/users', getAllUsers);
router.get('/users/:userId', getUserById);
router.put('/users/:userId', updateUser);
router.delete('/users/:userId', deleteUser);

// 任务管理
router.get('/tasks', getAllTasks);

// 系统统计
router.get('/stats', getSystemStats);

export default router;