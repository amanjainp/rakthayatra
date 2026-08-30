import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environmental parameters
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required.'),
  DATABASE_URL_REPLICA: z.string().optional(),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters long.'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  ALLOWED_ORIGINS: z.string().default('*'),
  ENCRYPTION_KEYS: z.string().default('dev-key-must-be-32-characters-long-!'),
  // Infrastructure placeholders (optional during scaffolding phase)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
  REDIS_URL: z.string().optional(),
  RABBITMQ_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Startup validation failed. Invalid environment configuration:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

// Staging & Production strict validation check to disable mock fallbacks
const data = parsed.data;
if (data.NODE_ENV === 'production' || data.NODE_ENV === 'staging') {
  const missing: string[] = [];
  if (!data.AWS_ACCESS_KEY_ID) missing.push('AWS_ACCESS_KEY_ID');
  if (!data.AWS_SECRET_ACCESS_KEY) missing.push('AWS_SECRET_ACCESS_KEY');
  if (!data.AWS_REGION) missing.push('AWS_REGION');
  if (!data.AWS_S3_BUCKET) missing.push('AWS_S3_BUCKET');
  if (!data.GOOGLE_MAPS_API_KEY) missing.push('GOOGLE_MAPS_API_KEY');
  if (!data.FIREBASE_PROJECT_ID) missing.push('FIREBASE_PROJECT_ID');
  if (!data.FIREBASE_CLIENT_EMAIL) missing.push('FIREBASE_CLIENT_EMAIL');
  if (!data.FIREBASE_PRIVATE_KEY) missing.push('FIREBASE_PRIVATE_KEY');
  if (!data.REDIS_URL) missing.push('REDIS_URL');
  if (!data.RABBITMQ_URL) missing.push('RABBITMQ_URL');
  if (data.ENCRYPTION_KEYS === 'dev-key-must-be-32-characters-long-!') {
    missing.push('ENCRYPTION_KEYS (cannot use default dev key in production/staging)');
  }

  if (missing.length > 0) {
    console.error(`❌ Startup validation failed. In ${data.NODE_ENV} mode, the following parameters are strictly required and cannot use local mocks:`);
    console.error(missing.map((key) => ` - ${key}`).join('\n'));
    process.exit(1);
  }
}

export const env = data;
