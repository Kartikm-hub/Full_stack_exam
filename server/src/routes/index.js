/**
 * The `/api` namespace.
 *
 * This is the only place future product endpoints get mounted.
 */

import { Router } from "express";
import { createAuthRouter } from "./auth.js";

export function createApiRouter() {
  const router = Router();

  /**
   * Namespace index.
   */
  router.get("/", (_req, res) => {
    res.status(200).json({
      name: "focus-mode-api",
      version: "0.1.0",
      status: "scaffold",
      routes: ["/v1/auth"],
      message: "Focus Mode API",
    });
  });

  // Prompt 005 — Authentication
  router.use("/v1/auth", createAuthRouter());

  // Future:
  // router.use("/v1/devices", createDeviceRouter());
  // router.use("/v1/sessions", createSessionRouter());

  return router;
}