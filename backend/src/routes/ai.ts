import express from 'express';
import { AiController } from '../controllers/aiController';
import authMiddleware from '../middleware/auth';

const router = express.Router();

router.post('/image', authMiddleware, AiController.generateImage);
router.post('/chat', authMiddleware, AiController.chat);

export default router;
