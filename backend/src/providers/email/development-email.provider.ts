import { EmailProvider, EmailPayload } from './email-provider.interface';
import logger from '../../config/logger';

export class DevelopmentEmailProvider implements EmailProvider {
  async send(payload: EmailPayload): Promise<{ success: boolean; providerId?: string }> {
    logger.info(`[MOCK EMAIL DISPATCH] To: ${payload.to} | Subject: ${payload.subject} | Body: ${payload.body} | EventID: ${payload.eventId || 'None'}`);
    return {
      success: true,
      providerId: `mock-email-${Math.random().toString(36).substring(7)}`,
    };
  }
}
