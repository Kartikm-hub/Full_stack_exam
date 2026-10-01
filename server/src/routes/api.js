import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'

import { User } from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
})
const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
})
const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  defaultDurationMin: z.union([z.literal(25), z.literal(50), z.literal(60), z.literal(90), z.literal(120)]).optional(),
}).refine((values) => Object.keys(values).length > 0, 'Provide at least one profile field.')
const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
})
const allowlistSchema = z.object({
  userApps: z.array(z.string().trim().min(1).max(100)).max(100),
})

const protectedApps = ['browser', 'agent', 'system']

function sendError(response, status, code, message, details) {
  return response.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) } })
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    defaultDurationMin: user.defaultDurationMin,
    createdAt: user.createdAt,
  }
}

function issueToken(user, config) {
  return jwt.sign({ sub: user.id }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN })
}

function validate(schema, request, response) {
  const result = schema.safeParse(request.body)
  if (!result.success) {
    sendError(response, 400, 'VALIDATION_ERROR', 'Check the submitted fields.', result.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })))
    return null
  }
  return result.data
}

export function createApiRouter(config, UserModel = User) {
  const router = Router()
  const authenticate = requireAuth(config.JWT_SECRET, UserModel)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.AUTH_RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts. Try again shortly.' } },
  })

  router.get('/health', (request, response) => response.json({
    success: true,
    data: { status: 'ok', database: request.app.locals.databaseReady ? 'connected' : 'disconnected' },
  }))

  router.post('/auth/register', authLimiter, async (request, response, next) => {
    const values = validate(registerSchema, request, response)
    if (!values) return
    try {
      const email = values.email.toLowerCase()
      if (await UserModel.exists({ email })) return sendError(response, 409, 'EMAIL_IN_USE', 'An account with this email already exists.')
      const passwordHash = await bcrypt.hash(values.password, 12)
      const user = await UserModel.create({ name: values.name, email, passwordHash })
      return response.status(201).json({ success: true, data: { user: publicUser(user), accessToken: issueToken(user, config) } })
    } catch (error) {
      if (error?.code === 11000) return sendError(response, 409, 'EMAIL_IN_USE', 'An account with this email already exists.')
      return next(error)
    }
  })

  router.post('/auth/login', authLimiter, async (request, response, next) => {
    const values = validate(loginSchema, request, response)
    if (!values) return
    try {
      const user = await UserModel.findOne({ email: values.email.toLowerCase() }).select('+passwordHash')
      const valid = user && await bcrypt.compare(values.password, user.passwordHash)
      if (!valid) return sendError(response, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
      if (!user.isActive) return sendError(response, 403, 'ACCOUNT_DISABLED', 'This account has been disabled.')
      return response.json({ success: true, data: { user: publicUser(user), accessToken: issueToken(user, config) } })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/auth/logout', authenticate, (request, response) => response.json({ success: true, data: null, message: 'Signed out.' }))
  router.get('/auth/me', authenticate, (request, response) => response.json({ success: true, data: { user: publicUser(request.user) } }))

  router.patch('/auth/me', authenticate, async (request, response, next) => {
    const values = validate(profileSchema, request, response)
    if (!values) return
    try {
      Object.assign(request.user, values)
      await request.user.save()
      return response.json({ success: true, data: { user: publicUser(request.user) } })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/auth/change-password', authenticate, async (request, response, next) => {
    const values = validate(passwordSchema, request, response)
    if (!values) return
    try {
      const user = await UserModel.findById(request.user.id).select('+passwordHash')
      if (!user) return sendError(response, 404, 'USER_NOT_FOUND', 'Account not found.')
      if (!await bcrypt.compare(values.currentPassword, user.passwordHash)) {
        return sendError(response, 400, 'CURRENT_PASSWORD_INCORRECT', 'Current password is incorrect.')
      }
      user.passwordHash = await bcrypt.hash(values.newPassword, 12)
      await user.save()
      return response.json({ success: true, data: null, message: 'Password changed.' })
    } catch (error) {
      return next(error)
    }
  })

  router.get('/allowlist', authenticate, (request, response) => response.json({
    success: true,
    data: { protectedApps, userApps: request.user.userApps, effectiveApps: [...protectedApps, ...request.user.userApps] },
  }))

  router.put('/allowlist', authenticate, async (request, response, next) => {
    const values = validate(allowlistSchema, request, response)
    if (!values) return
    try {
      const seen = new Set()
      const userApps = values.userApps.filter((name) => {
        const normalized = name.toLowerCase()
        if (protectedApps.includes(normalized) || seen.has(normalized)) return false
        seen.add(normalized)
        return true
      })
      request.user.userApps = userApps
      await request.user.save()
      return response.json({ success: true, data: { protectedApps, userApps, effectiveApps: [...protectedApps, ...userApps] } })
    } catch (error) {
      return next(error)
    }
  })

  return router
}