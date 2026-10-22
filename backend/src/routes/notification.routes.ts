import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', (req, res) => notificationController.getMyNotifications(req, res));
router.post('/:id/read', (req, res) => notificationController.markAsRead(req, res));
router.post('/read-all', (req, res) => notificationController.markAllAsRead(req, res));

export default router;
