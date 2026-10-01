import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import Device from "../models/Device.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../lib/http-error.js";

const router = Router();

const pairSchema = z.object({
  name: z.string().trim().min(1).max(100),
  os: z.enum(["WINDOWS", "MACOS"]),
});

function createPairingCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashPairingCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function publicDevice(device) {
  return {
    id: device._id.toString(),
    name: device.name,
    os: device.os,
    pairedAt: device.pairedAt,
    lastSeenAt: device.lastSeenAt,
    status: device.status,
  };
}

router.post("/pair", requireAuth(), async (req, res, next) => {
  try {
    const data = pairSchema.parse(req.body);

    const pairingCode = createPairingCode();
    const pairTokenHash = hashPairingCode(pairingCode);

    const device = await Device.create({
      ownerId: req.user.id,
      name: data.name,
      os: data.os,
      pairTokenHash,
      status: "DISCONNECTED",
    });

    return res.status(201).json({
      device: publicDevice(device),
      pairingCode,
      expiresInSeconds: 300,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/", requireAuth(), async (req, res, next) => {
  try {
    const devices = await Device.find({
      ownerId: req.user.id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      devices: devices.map(publicDevice),
    });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:deviceId", requireAuth(), async (req, res, next) => {
  try {
    const device = await Device.findOneAndDelete({
      _id: req.params.deviceId,
      ownerId: req.user.id,
    });

    if (!device) {
      return next(new ApiError(404, "NOT_FOUND", "Device not found"));
    }

    return res.status(200).json({
      message: "Device removed successfully",
    });
  } catch (error) {
    return next(error);
  }
});

export function createDeviceRouter() {
  return router;
}