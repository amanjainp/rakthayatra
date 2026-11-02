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
    role: z.enum(['ADMIN', 'DONOR', 'HOSPITAL', 'BLOOD_BANK']),
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

// Hospital-to-Hospital Blood Redistribution Validation Schemas
export const bloodGroupEnumSchema = z.enum([
  'A_POS',
  'A_NEG',
  'B_POS',
  'B_NEG',
  'AB_POS',
  'AB_NEG',
  'O_POS',
  'O_NEG',
]);

export const bloodComponentEnumSchema = z.enum([
  'WHOLE_BLOOD',
  'PACKED_RBC',
  'PLASMA',
  'PLATELETS',
  'CRYOPRECIPITATE',
]);

export const redistributionUrgencySchema = z.enum(['ROUTINE', 'URGENT', 'CRITICAL']);

export const createRedistributionRequestSchema = z
  .object({
    bloodGroup: bloodGroupEnumSchema,
    componentType: bloodComponentEnumSchema.default('WHOLE_BLOOD'),
    unitsRequested: z.number().int().min(1, 'At least 1 unit is required').max(100),
    urgency: redistributionUrgencySchema,
    requiredBy: z.string().refine((val) => {
      const dt = new Date(val);
      return !isNaN(dt.getTime()) && dt.getTime() > Date.now();
    }, 'Required-by date/time must be in the future'),
    minRemainingShelfLifeDays: z.number().int().min(1).max(365).default(2),
    clinicalReason: z.string().min(5, 'Clinical justification must be at least 5 characters'),
    specialHandlingNotes: z.string().optional(),
  });

export const dispatchTransferSchema = z.object({
  coldChainVerified: z.literal(true, {
    message: 'Cold-chain verification is mandatory before dispatch',
  }),
  temperatureCelsius: z.number().min(-80).max(30),
  transportContainerId: z.string().min(2).optional(),
  courierName: z.string().min(2).optional(),
});

export const receiveTransferReconciliationSchema = z
  .object({
    unitsReceivedGood: z.number().int().min(0),
    unitsDamaged: z.number().int().min(0).default(0),
    unitsExpiredInTransit: z.number().int().min(0).default(0),
    coldChainIntact: z.boolean(),
    receivingTempCelsius: z.number().min(-80).max(40).optional(),
    discrepancyReason: z.string().optional(),
  })
  .refine(
    (data) => data.unitsReceivedGood + data.unitsDamaged + data.unitsExpiredInTransit > 0,
    {
      message: 'Total reconciled units must be greater than zero',
      path: ['unitsReceivedGood'],
    }
  );
