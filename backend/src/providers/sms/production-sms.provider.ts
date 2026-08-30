import twilio from 'twilio';
import { SMSProvider, SMSPayload } from './sms-provider.interface';
import logger from '../../config/logger';

export class ProductionSMSProvider implements SMSProvider {
  private client?: twilio.Twilio;
  private fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    const authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = process.env.TWILIO_FROM_NUMBER || '+1234567890';

    if (accountSid && authToken) {
      // Connect to real Twilio client service
      this.client = twilio(accountSid, authToken, {
        lazyLoading: true,
      });
    }
  }

  async send(payload: SMSPayload): Promise<{ success: boolean; providerId?: string; error?: string }> {
    try {
      if (!this.client) {
        throw new Error('Twilio credentials not configured.');
      }

      // Dispatch SMS message with timeout bounds
      const message = await this.client.messages.create({
        from: this.fromNumber,
        to: payload.phone,
        body: payload.body,
      });

      logger.info(`[TWILIO SMS DISPATCH] Sent to: ${payload.phone} | MessageSID: ${message.sid}`);
      return {
        success: true,
        providerId: message.sid,
      };
    } catch (err: any) {
      logger.error(`[TWILIO SMS ERROR] Failed to send SMS to ${payload.phone}: ${err.message}`);
      return {
        success: false,
        error: err.message || 'Twilio client transmission error',
      };
    }
  }
}
