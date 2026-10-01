import { Router } from "express";
import { createAuthRouter } from "./auth.js";
import { createDeviceRouter } from "./devices.js";

export function createApiRouter() {
  const router = Router();

  router.get("/", (_req, res) => {
    res.status(200).json({
      name: "focus-mode-api",
      version: "0.1.0",
      status: "scaffold",
      routes: ["/v1/auth", "/v1/devices"],
      message: "Focus Mode API",
    });
  });

  router.use("/v1/auth", createAuthRouter());
  router.use("/v1/devices", createDeviceRouter());

  return router;
}