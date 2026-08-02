import { loginSchema } from '../src/utils/validation';

describe('Frontend Coverage Booster Tests', () => {
  describe('validation.ts utilities', () => {
    it('should validate zod configurations successfully', () => {
      const valid = loginSchema.safeParse({ email: 'aman@donor.org', password: 'Password@123' });
      expect(valid.success).toBe(true);

      const invalid = loginSchema.safeParse({ email: 'invalid', password: '' });
      expect(invalid.success).toBe(false);
    });
  });
});
