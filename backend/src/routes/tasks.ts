import { Router } from 'express';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  clearTasks,
  syncTasks,
  getQuota,
} from '../controllers/taskController';
import authMiddleware from '../middleware/auth';

const router = Router();

// 所有路由都需要认证
router.use(authMiddleware);

router.get('/', getTasks);
router.post('/', createTask);
router.delete('/', clearTasks);
router.put('/:taskId', updateTask);
router.delete('/:taskId', deleteTask);
router.post('/sync', syncTasks);
router.get('/quota', getQuota);

export default router;
