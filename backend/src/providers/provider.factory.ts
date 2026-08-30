import { EmailProvider } from './email/email-provider.interface';
import { DevelopmentEmailProvider } from './email/development-email.provider';
import { ProductionEmailProvider } from './email/production-email.provider';
import { SMSProvider } from './sms/sms-provider.interface';
import { DevelopmentSMSProvider } from './sms/development-sms.provider';
import { ProductionSMSProvider } from './sms/production-sms.provider';
import { env } from '../config/env';

class ProviderFactory {
  private emailProvider: EmailProvider;
  private smsProvider: SMSProvider;

  constructor() {
    const isProductionOrStaging = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';

    if (isProductionOrStaging) {
      // In production/staging, map active providers
      this.emailProvider = new ProductionEmailProvider();
      this.smsProvider = new ProductionSMSProvider();
    } else {
      // Otherwise fallback safely to mocks/dev simulation
      this.emailProvider = new DevelopmentEmailProvider();
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
