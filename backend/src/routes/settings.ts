import { Router } from 'express';
import { AdminController } from '../controllers/adminController';

const router = Router();

// Public settings endpoint (Announcements, Payment Packages, etc.)
// No auth middleware needed as announcements might be public
router.get('/', AdminController.getSettings);

export default router;
