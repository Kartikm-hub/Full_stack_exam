import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must contain at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
})

export function loadConfig(source = process.env) {
  const result = schema.safeParse(source)
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    throw new Error(`Invalid server configuration: ${details}`)
  }
  return result.data
}