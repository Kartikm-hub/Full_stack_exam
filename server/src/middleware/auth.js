import jwt from 'jsonwebtoken'

import { User } from '../models/User.js'

export function requireAuth(jwtSecret, UserModel = User) {
  return async function authenticate(request, response, next) {
    const authorization = request.get('authorization') || ''
    const [scheme, token] = authorization.split(' ')
    if (scheme !== 'Bearer' || !token) {
      return response.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Sign in to continue.' } })
    }

    try {
      const payload = jwt.verify(token, jwtSecret)
      const user = await UserModel.findById(payload.sub)
      if (!user || !user.isActive) {
        return response.status(401).json({ success: false, error: { code: 'INVALID_SESSION', message: 'Your session is no longer valid.' } })
      }
      request.user = user
      return next()
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        return response.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Your session has expired. Sign in again.' } })
      }
      return next(error)
    }
  }
}

export function requireAdmin(request, response, next) {
  if (request.user?.role !== 'ADMIN') {
    return response.status(403).json({ success: false, error: { code: 'ADMIN_REQUIRED', message: 'Administrator access is required.' } })
  }
  return next()
}