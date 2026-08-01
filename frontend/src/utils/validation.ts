import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long.')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character.');

export const loginSchema = z.object({
  email: z.string().email('Invalid email address format.'),
  password: z.string().min(1, 'Password is required.'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address format.'),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be exactly 6 digits.'),
});

// Dynamic registration validation based on selected user role
export const registerSchema = z
  .object({
    email: z.string().email('Invalid email address format.'),
    password: passwordSchema,
    role: z.enum(['ADMIN', 'DONOR', 'PATIENT', 'HOSPITAL', 'BLOOD_BANK']),
    fullName: z.string().min(2, 'Full Name must be at least 2 characters long.'),
    phone: z.string().min(10, 'Phone number must be at least 10 digits long.'),
    
    // Donor Details
    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'Not Specified']).optional(),
    dob: z.string().optional(),
    bloodGroup: z.string().optional(),
    latitude: z.string().or(z.number()).optional(),
    longitude: z.string().or(z.number()).optional(),
    address: z.string().optional(),
    consentGiven: z.boolean().optional(),

    // Hospital / Blood Bank Details
    name: z.string().optional(),
    licenseNumber: z.string().optional(),
    city: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.role === 'DONOR') {
        return !!data.dob && !!data.bloodGroup && data.consentGiven === true;
      }
      return true;
    },
    {
      message: 'Donors must provide date of birth, blood group, and DPDP consent.',
      path: ['consentGiven'],
    }
  )
  .refine(
    (data) => {
      if (data.role === 'HOSPITAL' || data.role === 'BLOOD_BANK') {
        return !!data.name && !!data.licenseNumber;
      }
      return true;
    },
    {
      message: 'License number and name are required for hospitals and blood banks.',
      path: ['licenseNumber'],
    }
  );
