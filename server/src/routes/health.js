/**
 * `GET /health` — liveness and configuration summary.
 *
 * The only implemented endpoint in Prompt 004. It is deliberately outside the
 * `/api` namespace because it is an infrastructure probe, not a product API:
 * load balancers, uptime checks and the deploy pipeline call it.
 *
 * Honesty rules (SPEC.md §7):
 *  - it reports the REAL configured environment, not a hard-coded string
 *  - it NEVER claims MongoDB is connected. The database is not implemented yet,
 *    so the field reads "not_configured" regardless of whether MONGODB_URI is
 *    set. Saying "connected" here would be a lie that hides a real outage.
 *  - it exposes no configuration values, only their shape
 */

import { Router } from 'express'

/**
 * @param {object} options
 * @param {import('../config/index.js').ServerConfig} options.config
 * @param {number} [options.startedAt] epoch ms, injected by the app so restarts
 *   are visible to a monitor
 */
export function createHealthRouter({ config, startedAt = Date.now() }) {
  const router = Router()

  router.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: config.serviceName,
      environment: config.nodeEnv,
      timestamp: new Date().toISOString(),
      version: config.serviceVersion,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      database: 'not_configured',
      // Feature flags make it obvious, to any caller, that this is a scaffold.
      features: {
        api: 'not_implemented',
        auth: 'not_implemented',
        sessions: 'not_implemented',
        websocket: 'not_implemented',
      },
    })
  })

  return router
}