/**
 * The `/api` namespace.
 *
 * This is the only place future product endpoints get mounted. Prompts 005–007
 * add routers here; nothing else in the app needs to change.
 *
 * Deliberately empty apart from a namespace index. No fake auth, device,
 * session or pairing endpoints: those belong to their own prompts, and a
 * placeholder that answers 200 would be worse than a 404 because it would let
 * the dashboard believe the backend works.
 *
 * `/health` is intentionally NOT mounted here. It lives at the root because it
 * is an infrastructure probe rather than a product API (see `routes/health.js`).
 */

import { Router } from 'express'

export function createApiRouter() {
  const router = Router()

  /**
   * Namespace index. Reports what exists today rather than pretending the API
   * is built. `routes` is empty on purpose.
   */
  router.get('/', (_req, res) => {
    res.status(200).json({
      name: 'focus-mode-api',
      version: '0.1.0',
      status: 'scaffold',
      routes: [],
      message:
        'Product endpoints are not implemented yet. See PROMPTS.md for the build order.',
    })
  })

  // Future mounts, one per prompt:
  //   router.use('/auth',     createAuthRouter())       // Prompt 005
  //   router.use('/devices',  createDeviceRouter())     // Prompt 006
  //   router.use('/sessions', createSessionRouter())    // Prompt 007

  return router
}