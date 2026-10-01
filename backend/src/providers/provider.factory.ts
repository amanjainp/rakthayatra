import { EmailProvider } from './email/email-provider.interface';
import { DevelopmentEmailProvider } from './email/development-email.provider';
import { ProductionEmailProvider } from './email/production-email.provider';
import { SMSProvider } from './sms/sms-provider.interface';
import { DevelopmentSMSProvider } from './sms/development-sms.provider';
import { ProductionSMSProvider } from './sms/production-sms.provider';

class ProviderFactory {
  private emailProvider: EmailProvider;
  private smsProvider: SMSProvider;

  constructor() {
    const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
    const hasTwilio = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);

    if (hasSmtp) {
      this.emailProvider = new ProductionEmailProvider();
    } else {
      this.emailProvider = new DevelopmentEmailProvider();
    }

    if (hasTwilio) {
      this.smsProvider = new ProductionSMSProvider();
    } else {
      this.smsProvider = new DevelopmentSMSProvider();
    }
  }

  getEmailProvider(): EmailProvider {
    return this.emailProvider;
  }

  getSMSProvider(): SMSProvider {
    return this.smsProvider;
  }
}

export const providerFactory = new ProviderFactory();
