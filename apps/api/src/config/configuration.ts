import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  DATABASE_URL: z.string().min(1).optional(),

  REDIS_URL: z.string().min(1),

  LLM_PROVIDER: z.enum(['gemma', 'anthropic', 'openai']).default('gemma'),
  GOOGLE_AI_API_KEY: z.string().min(1).optional(),
  GEMMA_MODEL: z.string().default('gemma-4-12b-it'),
  GEMINI_EMBEDDING_MODEL: z.string().default('text-embedding-004'),

  INSIGHT_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.6),
  INSIGHT_MIN_SUPPORTING_ENTRIES: z.coerce.number().int().min(1).default(3),
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(): AppConfig {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.errors
      .map((e) => `  - ${e.path.join('.') || '<root>'}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${message}`);
  }
  return parsed.data;
}
