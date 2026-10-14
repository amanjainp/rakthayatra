import { chatbotService } from '../src/services/chatbot.service';

describe('ChatbotService Unit Tests', () => {
  it('should answer eligibility query in English', async () => {
    const res = await chatbotService.processMessage({
      message: 'Am I eligible to donate blood?',
      language: 'en',
    });

    expect(res.reply).toContain('Eligibility');
    expect(res.suggestedActions.length).toBeGreaterThan(0);
    expect(res.language).toBe('en');
  });

  it('should answer eligibility query in Kannada', async () => {
    const res = await chatbotService.processMessage({
      message: 'ನಾನು ರಕ್ತದಾನ ಮಾಡಬಹುದೇ?',
      language: 'kn',
    });

    expect(res.reply).toContain('ಅರ್ಹತಾ ಮಾನದಂಡಗಳು');
    expect(res.language).toBe('kn');
  });

  it('should provide emergency helplines for urgent query', async () => {
    const res = await chatbotService.processMessage({
      message: 'I have an urgent emergency need for blood',
      language: 'en',
    });

    expect(res.reply).toContain('108');
    expect(res.reply).toContain('104');
  });

  it('should answer compatibility query correctly', async () => {
    const res = await chatbotService.processMessage({
      message: 'Which blood group is universal donor?',
      language: 'en',
    });

    expect(res.reply).toContain('O Negative');
    expect(res.reply).toContain('Universal');
  });

  it('should answer donation camp inquiry', async () => {
    const res = await chatbotService.processMessage({
      message: 'Where are the blood donation camps?',
      language: 'en',
    });

    expect(res.reply).toContain('Camp');
    expect(res.suggestedActions.some((a) => a.payload === '/camps')).toBe(true);
  });
});
