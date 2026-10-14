import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { chatbotService } from '../services/chatbot.service';
import logger from '../config/logger';

export class ChatbotController {
  async handleMessage(req: Request, res: Response) {
    try {
      const { message, language, page } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Message is required and must be a string.',
          },
        });
      }

      // Check for optional JWT authentication
      let authenticatedUser: { userId: string; role: string; email: string } | undefined = undefined;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const secret = process.env.JWT_SECRET || 'fallback-secret-for-dev';
          const decoded: any = jwt.verify(token, secret);
          if (decoded && decoded.userId) {
            authenticatedUser = {
              userId: decoded.userId,
              role: decoded.role || 'DONOR',
              email: decoded.email || '',
            };
          }
        } catch {
          // Token invalid or expired - proceed as unauthenticated guest
        }
      }

      const result = await chatbotService.processMessage({
        message,
        language: language === 'kn' ? 'kn' : 'en',
        page: page || '/',
        user: authenticatedUser,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error(`Chatbot controller error: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while generating chatbot response.',
        },
      });
    }
  }
}

export const chatbotController = new ChatbotController();
