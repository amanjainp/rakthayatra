import { SMSProvider, SMSPayload } from './sms-provider.interface';
import logger from '../../config/logger';

export class DevelopmentSMSProvider implements SMSProvider {
  async send(payload: SMSPayload): Promise<{ success: boolean; providerId?: string }> {
    logger.info(`[MOCK SMS DISPATCH] Phone: ${payload.phone} | Body: ${payload.body} | EventID: ${payload.eventId || 'None'}`);
    return {
      success: true,
      providerId: `mock-sms-${Math.random().toString(36).substring(7)}`,
    };
  }
}
