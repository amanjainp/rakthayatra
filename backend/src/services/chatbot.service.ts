import { PrismaClient } from '@prisma/client';
import logger from '../config/logger';

const prisma = new PrismaClient();

export interface ChatbotQuery {
  message: string;
  language?: 'en' | 'kn';
  page?: string;
  user?: {
    userId: string;
    role: string;
    email: string;
  };
}

export interface ChatbotResponse {
  reply: string;
  language: 'en' | 'kn';
  suggestedActions: { label: string; action: 'NAVIGATE' | 'QUERY'; payload: string }[];
  context: {
    role: string;
    page: string;
  };
  authorizedData?: any;
}

export class ChatbotService {
  async processMessage(query: ChatbotQuery): Promise<ChatbotResponse> {
    const lang = query.language === 'kn' ? 'kn' : 'en';
    const role = query.user?.role || 'GUEST';
    const page = query.page || '/';
    const text = query.message.toLowerCase().trim();

    logger.info(`[CHATBOT] Processing query from role=${role}, lang=${lang}, page=${page}`);

    // Check if the query is asking for authorized live database data
    if (query.user && this.isAuthorizedDataQuery(text)) {
      return this.handleAuthorizedLookup(query.user, text, lang, page);
    }

    // Role-specific assistance handlers
    if (this.isEligibilityQuery(text)) {
      return this.getEligibilityAnswer(lang, role, page);
    }

    if (this.isCompatibilityQuery(text)) {
      return this.getCompatibilityAnswer(text, lang, role, page);
    }

    if (this.isEmergencyOrHelplineQuery(text)) {
      return this.getEmergencyAnswer(lang, role, page);
    }

    if (this.isNavigationQuery(text)) {
      return this.getNavigationAnswer(text, lang, role, page);
    }

    if (this.isCampsQuery(text)) {
      return this.getCampsAnswer(lang, role, page);
    }

    if (this.isInventoryQuery(text)) {
      return this.getInventoryAnswer(lang, role, page);
    }

    // Default intelligent conversational fallback
    return this.getDefaultHelp(lang, role, page);
  }

  private isAuthorizedDataQuery(text: string): boolean {
    return (
      text.includes('my request') ||
      text.includes('my status') ||
      text.includes('my donation') ||
      text.includes('my appointment') ||
      text.includes('my eligibility') ||
      text.includes('expiring') ||
      text.includes('low stock') ||
      text.includes('pending verification') ||
      text.includes('status of request') ||
      text.includes('ನನ್ನ ವಿನಂತಿ') ||
      text.includes('ನನ್ನ ದಾನ')
    );
  }

  private isEligibilityQuery(text: string): boolean {
    return (
      text.includes('eligible') ||
      text.includes('eligibility') ||
      text.includes('can i donate') ||
      text.includes('who can donate') ||
      text.includes('weight') ||
      text.includes('age') ||
      text.includes('interval') ||
      text.includes('ಅರ್ಹತೆ') ||
      text.includes('ದಾನ ಮಾಡಬಹುದೇ')
    );
  }

  private isCompatibilityQuery(text: string): boolean {
    return (
      text.includes('compatible') ||
      text.includes('compatibility') ||
      text.includes('universal') ||
      text.includes('give blood to') ||
      text.includes('receive blood from') ||
      text.includes('o negative') ||
      text.includes('o-') ||
      text.includes('ab+') ||
      text.includes('ಹೊಂದಾಣಿಕೆ')
    );
  }

  private isEmergencyOrHelplineQuery(text: string): boolean {
    return (
      text.includes('emergency') ||
      text.includes('urgent') ||
      text.includes('help line') ||
      text.includes('helpline') ||
      text.includes('contact') ||
      text.includes('phone') ||
      text.includes('ತುರ್ತು') ||
      text.includes('ಸಹಾಯವಾಣಿ')
    );
  }

  private isNavigationQuery(text: string): boolean {
    return (
      text.includes('navigate') ||
      text.includes('where is') ||
      text.includes('go to') ||
      text.includes('take me to') ||
      text.includes('map') ||
      text.includes('how to request') ||
      text.includes('ಹೋಗಿ')
    );
  }

  private isCampsQuery(text: string): boolean {
    return (
      text.includes('camp') ||
      text.includes('drive') ||
      text.includes('blood drive') ||
      text.includes('ಶಿಬಿರ')
    );
  }

  private isInventoryQuery(text: string): boolean {
    return (
      text.includes('stock') ||
      text.includes('inventory') ||
      text.includes('units') ||
      text.includes('available blood') ||
      text.includes('ದಾಸ್ತಾನು')
    );
  }

  private async handleAuthorizedLookup(
    user: { userId: string; role: string; email: string },
    _text: string,
    lang: 'en' | 'kn',
    page: string
  ): Promise<ChatbotResponse> {
    const { userId, role } = user;

    try {
      if (role === 'DONOR') {
        const donor = await prisma.donorProfile.findUnique({
          where: { userId },
          include: { donations: true, eligibility: true },
        });

        if (!donor) {
          return {
            reply: lang === 'kn'
              ? 'ಕ್ಷಮಿಸಿ, ನಿಮ್ಮ ರಕ್ತದಾನಿ ಪ್ರೊಫೈಲ್ ಪೂರ್ಣಗೊಂಡಿಲ್ಲ. ದಯವಿಟ್ಟು ಪ್ರೊಫೈಲ್ ಅಪ್‌ಡೇಟ್ ಮಾಡಿ.'
              : 'Your donor profile is not completed yet. Please update your profile.',
            language: lang,
            suggestedActions: [{ label: 'Complete Profile', action: 'NAVIGATE', payload: '/profile' }],
            context: { role, page },
          };
        }

        const totalCompleted = donor.donations.filter((d) => d.status === 'COMPLETED').length;
        const lastDate = donor.lastDonationDate
          ? new Date(donor.lastDonationDate).toLocaleDateString()
          : 'None recorded';

        const isEligible = donor.eligibility?.isEligible ?? true;

        const reply = lang === 'kn'
          ? `**ನಿಮ್ಮ ರಕ್ತದಾನ ಸಾರಾಂಶ:**\n- ಒಟ್ಟು ದಾನಗಳು: **${totalCompleted} ಬ್ಯಾಗ್‌ಗಳು**\n- ಕೊನೆಯ ದಾನ: **${lastDate}**\n- ಅರ್ಹತಾ ಸ್ಥಿತಿ: **${isEligible ? 'ಅರ್ಹರು (Eligible)' : 'ವಿಳಂಬಿತ (Deferred)'}**\n- ಲಭ್ಯತೆ ಸ್ಥಿತಿ: **${donor.isAvailable ? 'ಲಭ್ಯವಿದ್ದಾರೆ (Active)' : 'ವಿರಾಮದಲ್ಲಿದ್ದಾರೆ'}**`
          : `**Your Donor Summary:**\n- Total Donations Completed: **${totalCompleted} bag(s)**\n- Last Donation Date: **${lastDate}**\n- Medical Screening Status: **${isEligible ? 'Eligible to Donate' : 'Temporarily Deferred'}**\n- Current Availability: **${donor.isAvailable ? 'Available' : 'Paused'}**`;

        return {
          reply,
          language: lang,
          suggestedActions: [
            { label: 'Book Appointment', action: 'NAVIGATE', payload: '/donations' },
            { label: 'Medical Questionnaire', action: 'NAVIGATE', payload: '/eligibility' },
            { label: 'View Nearby Camps', action: 'NAVIGATE', payload: '/camps' },
          ],
          context: { role, page },
          authorizedData: { totalCompleted, lastDate, isEligible, isAvailable: donor.isAvailable },
        };
      }

      if (role === 'PATIENT' || role === 'HOSPITAL') {
        const requests = await prisma.bloodRequest.findMany({
          where: { requesterId: userId },
          orderBy: { createdAt: 'desc' },
          take: 3,
        });

        if (requests.length === 0) {
          return {
            reply: lang === 'kn'
              ? 'ನಿಮ್ಮ ಖಾತೆಯಲ್ಲಿ ಸಕ್ರಿಯ ರಕ್ತದ ವಿನಂತಿಗಳು ಕಂಡುಬಂದಿಲ್ಲ. ನೀವು ಹೊಸ ವಿನಂತಿಯನ್ನು ರಚಿಸಬಹುದು.'
              : 'You have no active blood requests registered. You can submit an emergency request anytime.',
            language: lang,
            suggestedActions: [{ label: 'Submit Blood Request', action: 'NAVIGATE', payload: '/requests' }],
            context: { role, page },
          };
        }

        const latest = requests[0];
        const reply = lang === 'kn'
          ? `**ಇತ್ತೀಚಿನ ವಿನಂತಿ ಸ್ಥಿತಿ:**\n- ರಕ್ತದ ಗುಂಪು: **${latest.bloodGroup.replace('_', ' ')}**\n- ಅಗತ್ಯ ಯೂನಿಟ್‌ಗಳು: **${latest.unitsRequired}**\n- ಸ್ಥಿತಿ: **${latest.status}**\n- ತುರ್ತು ಹಂತ: **${latest.urgency}**\n- ದಿನಾಂಕ: ${new Date(latest.createdAt).toLocaleDateString()}`
          : `**Latest Blood Request Tracking:**\n- Blood Group: **${latest.bloodGroup.replace('_', ' ')}**\n- Units Required: **${latest.unitsRequired}**\n- Current Status: **${latest.status}**\n- Urgency: **${latest.urgency}**\n- Registered: ${new Date(latest.createdAt).toLocaleDateString()}`;

        return {
          reply,
          language: lang,
          suggestedActions: [
            { label: 'Track All Requests', action: 'NAVIGATE', payload: '/requests' },
            { label: 'Emergency Map', action: 'NAVIGATE', payload: '/emergency-map' },
          ],
          context: { role, page },
          authorizedData: { latestRequest: latest, totalRequests: requests.length },
        };
      }

      if (role === 'BLOOD_BANK') {
        const bank = await prisma.bloodBankProfile.findUnique({
          where: { userId },
          include: { inventory: true },
        });

        if (!bank) {
          return {
            reply: lang === 'kn'
              ? 'ರಕ್ತ ಬ್ಯಾಂಕ್ ಪ್ರೊಫೈಲ್ ಪತ್ತೆಯಾಗಿಲ್ಲ.'
              : 'Blood Bank profile not located.',
            language: lang,
            suggestedActions: [{ label: 'Profile', action: 'NAVIGATE', payload: '/profile' }],
            context: { role, page },
          };
        }

        const now = new Date();
        const availableBatches = bank.inventory.filter((i) => i.status === 'AVAILABLE' && new Date(i.expiryDate) > now);
        const totalUnits = availableBatches.reduce((acc, curr) => acc + curr.unitsCount, 0);

        // Batches expiring within 7 days
        const sevenDays = new Date(Date.now() + 7 * 86400 * 1000);
        const expiringSoon = availableBatches.filter((i) => new Date(i.expiryDate) <= sevenDays);

        const reply = lang === 'kn'
          ? `**ರಕ್ತ ಬ್ಯಾಂಕ್ ದಾಸ್ತಾನು ಸಾರಾಂಶ:**\n- ಒಟ್ಟು ಲಭ್ಯ ಯೂನಿಟ್‌ಗಳು: **${totalUnits} ಬ್ಯಾಗ್‌ಗಳು**\n- ಸಕ್ರಿಯ ಬ್ಯಾಚ್‌ಗಳು: **${availableBatches.length}**\n- 7 ದಿನಗಳಲ್ಲಿ ಅವಧಿ ಮುಗಿಯುವ ಯೂನಿಟ್‌ಗಳು: **${expiringSoon.length} ಬ್ಯಾಚ್‌ಗಳು**`
          : `**Blood Bank Stock Status:**\n- Total Available Units: **${totalUnits} units**\n- Active Inventory Batches: **${availableBatches.length}**\n- Batches Expiring in ≤ 7 Days: **${expiringSoon.length}** (FEFO Review Recommended)`;

        return {
          reply,
          language: lang,
          suggestedActions: [
            { label: 'Inventory Stock', action: 'NAVIGATE', payload: '/inventory' },
            { label: 'Incoming Requests', action: 'NAVIGATE', payload: '/requests' },
          ],
          context: { role, page },
          authorizedData: { totalUnits, expiringSoonCount: expiringSoon.length },
        };
      }

      if (role === 'ADMIN') {
        const pendingHospitals = await prisma.hospitalProfile.count({ where: { isVerified: false } });
        const pendingBanks = await prisma.bloodBankProfile.count({ where: { isVerified: false } });
        const activeRequests = await prisma.bloodRequest.count({ where: { status: 'PENDING' } });

        const reply = lang === 'kn'
          ? `**ಆಡಳಿತ ಮಂಡಳಿ (Admin) ಸ್ಥಿತಿ:**\n- ಪರಿಶೀಲನೆ ಬಾಕಿ ಇರುವ ಆಸ್ಪತ್ರೆಗಳು: **${pendingHospitals}**\n- ಪರಿಶೀಲನೆ ಬಾಕಿ ಇರುವ ರಕ್ತ ಬ್ಯಾಂಕ್‌ಗಳು: **${pendingBanks}**\n- ಮುಕ್ತ ವಿನಂತಿಗಳು (Pending Requests): **${activeRequests}**`
          : `**System Administration Overview:**\n- Hospitals Pending Verification: **${pendingHospitals}**\n- Blood Banks Pending Verification: **${pendingBanks}**\n- Open Pending Requests: **${activeRequests}**`;

        return {
          reply,
          language: lang,
          suggestedActions: [
            { label: 'Facility Approvals', action: 'NAVIGATE', payload: '/admin/management' },
            { label: 'System Dashboard', action: 'NAVIGATE', payload: '/admin/dashboard' },
          ],
          context: { role, page },
          authorizedData: { pendingHospitals, pendingBanks, activeRequests },
        };
      }
    } catch (err: any) {
      logger.error(`Authorized lookup error: ${err.message}`);
    }

    return this.getDefaultHelp(lang, role, page);
  }

  private getEligibilityAnswer(lang: 'en' | 'kn', role: string, page: string): ChatbotResponse {
    if (lang === 'kn') {
      return {
        reply: `**ರಕ್ತದಾನದ ಸಾಮಾನ್ಯ ಅರ್ಹತಾ ಮಾನದಂಡಗಳು:**\n1. **ವಯಸ್ಸು:** 18 ರಿಂದ 65 ವರ್ಷಗಳ ನಡುವೆ.\n2. **ತೂಕ:** ಕನಿಷ್ಠ 45 ಕೆಜಿ.\n3. **ಹಿಮೋಗ್ಲೋಬಿನ್:** ಕನಿಷ್ಠ 12.5 ಗ್ರಾಂ/ಡೆಸಿಲೀಟರ್.\n4. **ದಾನದ ಮಧ್ಯಂತರ:** ಪುರುಷರಿಗೆ 90 ದಿನಗಳು, ಮಹಿಳೆಯರಿಗೆ 120 ದಿನಗಳು.\n5. **ಆರೋಗ್ಯ:** ಜ್ವರ, ಸೋಂಕು ಅಥವಾ ಇತ್ತೀಚಿನ ಪ್ರಮುಖ ಶಸ್ತ್ರಚಿಕಿತ್ಸೆ ಇರಬಾರದು.\n\n*ಸೂಚನೆ: ಅಂತಿಮ ಅರ್ಹತೆಯನ್ನು ನುರಿತ ವೈದ್ಯಕೀಯ ಸಿಬ್ಬಂದಿ ದಾನದ ಮೊದಲು ನಿರ್ಧರಿಸುತ್ತಾರೆ.*`,
        language: 'kn',
        suggestedActions: [
          { label: 'ಅರ್ಹತಾ ಪರೀಕ್ಷೆ ಭರ್ತಿ ಮಾಡಿ', action: 'NAVIGATE', payload: '/eligibility' },
          { label: 'ನೋಂದಣಿ ಮಾಡಿ', action: 'NAVIGATE', payload: '/register' },
        ],
        context: { role, page },
      };
    }

    return {
      reply: `**Core Blood Donation Eligibility Guidelines:**\n1. **Age:** 18 to 65 years.\n2. **Weight:** At least 45 kg (100 lbs).\n3. **Hemoglobin:** Minimum 12.5 g/dL.\n4. **Donation Interval:** Every 90 days for men, 120 days for women.\n5. **Health:** Free from acute infections, cold, flu, or recent major surgery.\n6. **Preparation:** Hydrate well with water and eat a healthy low-fat meal 2 hours prior.\n\n*Note: Final clinical eligibility is confirmed by medical staff at the facility.*`,
      language: 'en',
      suggestedActions: [
        { label: 'Take Medical Eligibility Check', action: 'NAVIGATE', payload: '/eligibility' },
        { label: 'Register as Donor', action: 'NAVIGATE', payload: '/register' },
      ],
      context: { role, page },
    };
  }

  private getCompatibilityAnswer(_text: string, lang: 'en' | 'kn', role: string, page: string): ChatbotResponse {
    if (lang === 'kn') {
      return {
        reply: `**ರಕ್ತದ ಹೊಂದಾಣಿಕೆ ಮಾಹಿತಿ:**\n- **O ನೆಗೆಟಿವ್ (O-):** ಸಾರ್ವತ್ರಿಕ ಕೆಂಪು ರಕ್ತಕಣ ದಾನಿ (Universal Red Cell Donor). ಯಾವುದೇ ರೋಗಿಗೆ ನೀಡಬಹುದು.\n- **AB ಪಾಸಿಟಿವ್ (AB+):** ಸಾರ್ವತ್ರಿಕ ಸ್ವೀಕರ್ತ (Universal Recipient). ಯಾವುದೇ ಗುಂಪಿನಿಂದ ಪಡೆಯಬಹುದು.\n- **ಪ್ಲಾಸ್ಮಾ ಸಾರ್ವತ್ರಿಕ ದಾನಿ:** AB ಗುಂಪು.\n\nನಿಮ್ಮ ರಕ್ತದ ಗುಂಪಿಗೆ ಸೂಕ್ತ ಹೊಂದಾಣಿಕೆ ಹುಡುಕಲು 'Find Blood' ಬಳಸಿ.`,
        language: 'kn',
        suggestedActions: [
          { label: 'ರಕ್ತ ಹುಡುಕಿ', action: 'NAVIGATE', payload: '/#find-blood' },
          { label: 'ತುರ್ತು ನಕ್ಷೆ', action: 'NAVIGATE', payload: '/emergency-map' },
        ],
        context: { role, page },
      };
    }

    return {
      reply: `**Blood Compatibility Summary:**\n- **O Negative (O-):** Universal Red Blood Cell Donor — can be transfused to any blood group in emergencies.\n- **AB Positive (AB+):** Universal Red Blood Cell Recipient — can safely receive red blood cells of any group.\n- **AB Negative / Positive:** Universal Plasma Donors.\n- **Rh Compatibility:** Rh-negative individuals should receive Rh-negative blood; Rh-positive can receive positive or negative.`,
      language: 'en',
      suggestedActions: [
        { label: 'Search Blood Stock', action: 'NAVIGATE', payload: '/#find-blood' },
        { label: 'Emergency Map', action: 'NAVIGATE', payload: '/emergency-map' },
      ],
      context: { role, page },
    };
  }

  private getEmergencyAnswer(lang: 'en' | 'kn', role: string, page: string): ChatbotResponse {
    if (lang === 'kn') {
      return {
        reply: `🚨 **ತುರ್ತು ಸಹಾಯವಾಣಿ ವಿವರಗಳು:**\n- **ರಾಷ್ಟ್ರೀಯ ಆಂಬ್ಯುಲೆನ್ಸ್:** **108**\n- **ರಾಜ್ಯ ರಕ್ತ ಬ್ಯಾಂಕ್ ಸಹಾಯವಾಣಿ:** **104**\n- **ಲೈಫ್‌ಲಿಂಕ್ ತುರ್ತು ಕೋಆರ್ಡಿನೇಷನ್:** ಸಿಸ್ಟಮ್‌ನಲ್ಲಿ 'Emergency' ವಿನಂತಿಯನ್ನು ಸಲ್ಲಿಸಿ.\n\nತಕ್ಷಣ ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆ ಅಥವಾ ಬ್ಲಡ್ ಬ್ಯಾಂಕ್ ಸಂಪರ್ಕಿಸಿ.`,
        language: 'kn',
        suggestedActions: [
          { label: 'ತುರ್ತು ವಿನಂತಿ ರಚಿಸಿ', action: 'NAVIGATE', payload: '/requests' },
          { label: 'ಹತ್ತಿರದ ರಕ್ತ ಬ್ಯಾಂಕ್‌ಗಳು', action: 'NAVIGATE', payload: '/emergency-map' },
        ],
        context: { role, page },
      };
    }

    return {
      reply: `🚨 **Emergency Helplines & Rapid Escalation:**\n- **National Ambulance:** **108**\n- **National Blood Helpline:** **104**\n- **LifeLink Emergency Dispatch:** Create an **EMERGENCY** blood request to automatically alert nearby participating blood banks and active matching donors within a 25 km radius.`,
      language: 'en',
      suggestedActions: [
        { label: 'File Emergency Request', action: 'NAVIGATE', payload: '/requests' },
        { label: 'Locate Nearest Blood Bank', action: 'NAVIGATE', payload: '/emergency-map' },
      ],
      context: { role, page },
    };
  }

  private getNavigationAnswer(text: string, lang: 'en' | 'kn', role: string, page: string): ChatbotResponse {
    if (text.includes('map') || text.includes('nearby')) {
      return {
        reply: lang === 'kn'
          ? 'ಹತ್ತಿರದ ರಕ್ತ ಬ್ಯಾಂಕ್‌ಗಳು ಮತ್ತು ಆಸ್ಪತ್ರೆಗಳನ್ನು ನೋಡಲು ಎಮರ್ಜೆನ್ಸಿ ಮ್ಯಾಪ್‌ಗೆ ಭೇಟಿ ನೀಡಿ.'
          : 'Opening the Emergency Map where you can view nearby facilities and donors with radial search.',
        language: lang,
        suggestedActions: [{ label: 'Open Emergency Map', action: 'NAVIGATE', payload: '/emergency-map' }],
        context: { role, page },
      };
    }

    if (text.includes('request')) {
      return {
        reply: lang === 'kn'
          ? 'ಹೊಸ ರಕ್ತದ ವಿನಂತಿಯನ್ನು ಸಲ್ಲಿಸಲು ವಿನಂತಿಗಳ ಪುಟಕ್ಕೆ ಹೋಗಿ.'
          : 'You can submit and track emergency blood requests on the Blood Requests Ledger.',
        language: lang,
        suggestedActions: [{ label: 'Open Blood Requests', action: 'NAVIGATE', payload: '/requests' }],
        context: { role, page },
      };
    }

    if (text.includes('inventory') || text.includes('stock')) {
      return {
        reply: lang === 'kn'
          ? 'ಲಭ್ಯವಿರುವ ರಕ್ತದ ದಾಸ್ತಾನು ವೀಕ್ಷಿಸಲು ಇನ್ವೆಂಟರಿ ಪುಟವನ್ನು ತೆರೆಯಿರಿ.'
          : 'Navigating to Blood Inventory stock management.',
        language: lang,
        suggestedActions: [{ label: 'Go to Inventory', action: 'NAVIGATE', payload: '/inventory' }],
        context: { role, page },
      };
    }

    return this.getDefaultHelp(lang, role, page);
  }

  private getCampsAnswer(lang: 'en' | 'kn', role: string, page: string): ChatbotResponse {
    if (lang === 'kn') {
      return {
        reply: `**ರಕ್ತದಾನ ಶಿಬಿರಗಳು (Donation Camps):**\nಲೈಫ್‌ಲಿಂಕ್‌ನಲ್ಲಿ ನೀವು ಮುಂಬರುವ ಸರ್ಕಾರಿ ಮತ್ತು ಅಧಿಕೃತ ಸಂಘಟನೆಗಳ ರಕ್ತದಾನ ಶಿಬಿರಗಳನ್ನು ಪರಿಶೀಲಿಸಬಹುದು, ದಾನಿಯಾಗಿ ನೋಂದಾಯಿಸಿಕೊಳ್ಳಬಹುದು ಅಥವಾ ಸ್ವಯಂಸೇವಕರಾಗಿ ಸೇರಬಹುದು.`,
        language: 'kn',
        suggestedActions: [
          { label: 'ಶಿಬಿರಗಳನ್ನು ನೋಡಿ', action: 'NAVIGATE', payload: '/camps' },
        ],
        context: { role, page },
      };
    }

    return {
      reply: `**Blood Donation Drives & Camps:**\nLifeLink coordinates with verified blood banks, Red Cross, and medical colleges to organize community blood drives. You can view upcoming dates, venues, organizers, and register directly online.`,
      language: 'en',
      suggestedActions: [
        { label: 'Browse Donation Camps', action: 'NAVIGATE', payload: '/camps' },
      ],
      context: { role, page },
    };
  }

  private getInventoryAnswer(lang: 'en' | 'kn', role: string, page: string): ChatbotResponse {
    if (lang === 'kn') {
      return {
        reply: `**ರಕ್ತದ ದಾಸ್ತಾನು ಲಭ್ಯತೆ:**\nನಮ್ಮ ಪ್ಲಾಟ್‌ಫಾರ್ಮ್ ರಿಯಲ್-ಟೈಮ್‌ನಲ್ಲಿ ಪರಿಶೀಲಿಸಲಾದ ರಕ್ತ ಬ್ಯಾಂಕ್‌ಗಳ ಸ್ಟಾಕ್ ಅನ್ನು ತೋರಿಸುತ್ತದೆ. ನೀವು ಹೋಮ್‌ಪೇಜ್‌ನಲ್ಲಿ 'Find Blood' ಮೂಲಕ ಅಥವಾ ಇನ್ವೆಂಟರಿ ಪೋರ್ಟಲ್ ಮೂಲಕ ಶೋಧಿಸಬಹುದು.`,
        language: 'kn',
        suggestedActions: [
          { label: 'ಲೈವ್ ಸ್ಟಾಕ್ ಶೋಧಿಸಿ', action: 'NAVIGATE', payload: '/#find-blood' },
        ],
        context: { role, page },
      };
    }

    return {
      reply: `**Live Blood Inventory Tracking:**\nLifeLink syncs verified blood units across certified storage facilities with under-30-second latency. Public visitors can verify availability on the homepage, while hospitals and blood banks manage reservations in real time.`,
      language: 'en',
      suggestedActions: [
        { label: 'Find Blood Online', action: 'NAVIGATE', payload: '/#find-blood' },
        { label: 'Open Inventory', action: 'NAVIGATE', payload: '/inventory' },
      ],
      context: { role, page },
    };
  }

  private getDefaultHelp(lang: 'en' | 'kn', role: string, page: string): ChatbotResponse {
    if (lang === 'kn') {
      return {
        reply: `ನಮಸ್ಕಾರ! ನಾನು **LifeLink (Rakthayatra)** ಎಐ ಸಹಾಯಕ. ನೀವು ರಕ್ತ ಹುಡುಕಲು, ದಾನಿಯಾಗಿ ನೋಂದಾಯಿಸಿಕೊಳ್ಳಲು, ಅರ್ಹತೆ ತಿಳಿಯಲು ಅಥವಾ ತುರ್ತು ಸಹಾಯ ಪಡೆಯಲು ನಾನು ಸಹಾಯ ಮಾಡಬಲ್ಲೆ. ನೀವು ಏನು ತಿಳಿಯಲು ಬಯಸುತ್ತೀರಿ?`,
        language: 'kn',
        suggestedActions: [
          { label: 'ರಕ್ತ ಹುಡುಕಿ', action: 'NAVIGATE', payload: '/#find-blood' },
          { label: 'ಅರ್ಹತಾ ನಿಯಮಗಳು', action: 'QUERY', payload: 'Who can donate blood?' },
          { label: 'ತುರ್ತು ಸಹಾಯವಾಣಿ', action: 'QUERY', payload: 'Emergency helplines' },
          { label: 'ರಕ್ತದಾನ ಶಿಬಿರಗಳು', action: 'NAVIGATE', payload: '/camps' },
        ],
        context: { role, page },
      };
    }

    return {
      reply: `Hello! I am your **LifeLink (Rakthayatra) AI Assistant**. I can help you search compatible blood stock, understand donation eligibility, locate emergency blood banks, book appointments, or check your live request statuses.\n\nHow can I help you today?`,
      language: 'en',
      suggestedActions: [
        { label: 'Find Blood', action: 'NAVIGATE', payload: '/#find-blood' },
        { label: 'Donation Eligibility', action: 'QUERY', payload: 'Who is eligible to donate blood?' },
        { label: 'Emergency Helplines', action: 'QUERY', payload: 'Emergency helpline numbers' },
        { label: 'Donation Camps', action: 'NAVIGATE', payload: '/camps' },
      ],
      context: { role, page },
    };
  }
}

export const chatbotService = new ChatbotService();
