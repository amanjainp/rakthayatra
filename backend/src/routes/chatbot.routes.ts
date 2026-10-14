import { Router } from 'express';
import { chatbotController } from '../controllers/chatbot.controller';

const router = Router();

router.post('/message', (req, res) => chatbotController.handleMessage(req, res));

export default router;
