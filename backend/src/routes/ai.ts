import express from 'express';
import { AiController } from '../controllers/aiController';
import authMiddleware from '../middleware/auth';

const router = express.Router();

router.post('/image', authMiddleware, AiController.generateImage);
router.post('/video', authMiddleware, AiController.generateVideo);
router.get('/proxy', AiController.proxyMedia); // Public access for video tags
router.post('/chat', authMiddleware, AiController.chat);

export default router;
