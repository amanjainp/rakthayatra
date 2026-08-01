import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  otpSchema,
  registerSchema,
} from '../src/utils/validation';

describe('Validation Schemas Unit Tests', () => {
  describe('loginSchema', () => {
    it('should validate correct login inputs successfully', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('should fail validation on invalid email structure', () => {
      const result = loginSchema.safeParse({
        email: 'invalid-email',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('should fail validation on missing password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('forgotPasswordSchema', () => {
    it('should validate email format', () => {
      const successResult = forgotPasswordSchema.safeParse({ email: 'donor@link.org' });
      const failResult = forgotPasswordSchema.safeParse({ email: 'donor' });
      expect(successResult.success).toBe(true);
      expect(failResult.success).toBe(false);
    });
  });

  describe('resetPasswordSchema', () => {
    it('should require strong passwords and confirm equality', () => {
      // Passwords match and satisfy requirements (min 8 chars, mixed case, number, special char)
      const valid = resetPasswordSchema.safeParse({
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });
      expect(valid.success).toBe(true);

      // Passwords match but weak (missing special char)
      const weak = resetPasswordSchema.safeParse({
        password: 'Password123',
        confirmPassword: 'Password123',
      });
      expect(weak.success).toBe(false);

      // Passwords mismatch
      const mismatch = resetPasswordSchema.safeParse({
        password: 'Password123!',
        confirmPassword: 'Different123!',
      });
      expect(mismatch.success).toBe(false);
    });
  });

  describe('otpSchema', () => {
    it('should enforce exactly 6-character length strings', () => {
      const valid = otpSchema.safeParse({ otp: '123456' });
      const invalidShort = otpSchema.safeParse({ otp: '12345' });
      const invalidLong = otpSchema.safeParse({ otp: '1234567' });

      expect(valid.success).toBe(true);
      expect(invalidShort.success).toBe(false);
      expect(invalidLong.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('should enforce donor parameters including DPDP consent', () => {
      const validDonor = registerSchema.safeParse({
        email: 'donor@link.org',
        password: 'Password123!',
        role: 'DONOR',
        fullName: 'John Doe',
        phone: '9876543210',
        dob: '1995-10-10',
        bloodGroup: 'O_POS',
        consentGiven: true,
      });
      expect(validDonor.success).toBe(true);

      const invalidConsent = registerSchema.safeParse({
        email: 'donor@link.org',
        password: 'Password123!',
        role: 'DONOR',
        fullName: 'John Doe',
        phone: '9876543210',
        dob: '1995-10-10',
        bloodGroup: 'O_POS',
        consentGiven: false, // Refused
      });
      expect(invalidConsent.success).toBe(false);
    });

    it('should require registration parameters for hospitals', () => {
      const validHospital = registerSchema.safeParse({
        email: 'hosp@link.org',
        password: 'Password123!',
        role: 'HOSPITAL',
        fullName: 'Hospital Admin',
        phone: '9876543210',
        name: 'City Care Hospital',
        licenseNumber: 'HOSP-1234-IN',
      });
      expect(validHospital.success).toBe(true);

      const missingLicense = registerSchema.safeParse({
        email: 'hosp@link.org',
        password: 'Password123!',
        role: 'HOSPITAL',
        fullName: 'Hospital Admin',
        phone: '9876543210',
        name: 'City Care Hospital',
        licenseNumber: '', // Missing
      });
      expect(missingLicense.success).toBe(false);
    });
  });
});
