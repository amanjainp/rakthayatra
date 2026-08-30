import nodemailer from 'nodemailer';
import { EmailProvider, EmailPayload } from './email-provider.interface';
import logger from '../../config/logger';

export class ProductionEmailProvider implements EmailProvider {
  private transporter: nodemailer.Transporter;
  private fromAddress: string;

  constructor() {
    const host = process.env.SMTP_HOST || 'localhost';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';
    this.fromAddress = process.env.SMTP_FROM || 'no-reply@lifelink.org';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // Use SSL for 465, TLS/starttls for other ports
      auth: user && pass ? { user, pass } : undefined,
      connectionTimeout: 5000, // 5 seconds connection timeout
      socketTimeout: 5000,
    });
  }

  async send(payload: EmailPayload): Promise<{ success: boolean; providerId?: string; error?: string }> {
    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: payload.to,
        subject: payload.subject,
        text: payload.body,
        html: `<p>${payload.body.replace(/\n/g, '<br>')}</p>`,
      });

      logger.info(`[SMTP EMAIL DISPATCH] Sent to: ${payload.to} | MessageID: ${info.messageId}`);
      return {
        success: true,
        providerId: info.messageId,
      };
    } catch (err: any) {
      logger.error(`[SMTP EMAIL ERROR] Failed to send email to ${payload.to}: ${err.message}`);
      return {
        success: false,
        error: err.message || 'SMTP transmission error',
      };
    }
  }
}
