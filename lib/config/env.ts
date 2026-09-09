import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required — see .env.example"),
  DIRECT_URL: z.string().min(1).optional(),

  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
  AUTH_URL: z.url().default("http://localhost:3000"),

  STORAGE_ADAPTER: z.enum(["local", "supabase"]).default("local"),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_S3_ACCESS_KEY_ID: z.string().optional(),
  SUPABASE_S3_SECRET_ACCESS_KEY: z.string().optional(),
  SUPABASE_S3_REGION: z.string().default("us-east-1"),
  SUPABASE_STORAGE_BUCKET: z.string().default("product-media"),
  MAX_UPLOAD_FILE_SIZE_MB: z.coerce.number().int().positive().default(50),
  // Vercel Blob — only used for the desktop-app installer upload, which is
  // far past Supabase's free-tier 50 MB single-object limit. Auto-injected
  // by Vercel when a Blob store is connected to the project; set manually
  // for local dev (Vercel dashboard → Storage → Blob → .env.local tab).
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  PAYMENT_ADAPTER: z.enum(["stub", "razorpay"]).default("stub"),
  DISABLE_PAYMENT_GATEWAY: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  NOTIFIER_ADAPTER: z.enum(["console", "email-sms"]).default("console"),
  SENTRY_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  FAST2SMS_API_KEY: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  APP_DEFAULT_TIMEZONE: z.string().default("Asia/Kolkata"),
  APP_DEFAULT_CURRENCY: z.string().length(3).default("INR"),
  APP_DEFAULT_LOCALE: z.string().default("en-IN"),

  STALE_BLOCK_DEFAULT_DAYS: z.coerce.number().int().positive().default(7),
  STALE_HELD_BILL_HOURS: z.coerce.number().int().positive().default(24),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  cached = parsed.data;
  return cached;
}
