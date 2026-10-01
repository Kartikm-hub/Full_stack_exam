import { Router } from "express";
import { z } from "zod";
import User from "../models/User.js";
import {
  hashPassword,
  comparePassword,
  createAccessToken,
} from "../lib/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../lib/http-error.js";

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128),
});

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    defaultDurationMin: user.defaultDurationMin,
    isActive: user.isActive,
  };
}

// POST /api/v1/auth/register
router.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const email = data.email.toLowerCase();

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return next(
        new ApiError(
          409,
          "CONFLICT",
          "An account with this email already exists"
        )
      );
    }

    const passwordHash = await hashPassword(data.password);

    const user = await User.create({
      name: data.name,
      email,
      passwordHash,
    });

    const token = createAccessToken(user);

    return res.status(201).json({
      user: publicUser(user),
      token,
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/v1/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const email = data.email.toLowerCase();

    const user = await User.findOne({ email });

    if (!user) {
      return next(
        new ApiError(
          401,
          "UNAUTHORIZED",
          "Invalid email or password"
        )
      );
    }

    if (!user.isActive) {
      return next(
        new ApiError(
          403,
          "FORBIDDEN",
          "Account is inactive"
        )
      );
    }

    const passwordMatches = await comparePassword(
      data.password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return next(
        new ApiError(
          401,
          "UNAUTHORIZED",
          "Invalid email or password"
        )
      );
    }

    const token = createAccessToken(user);

    return res.status(200).json({
      user: publicUser(user),
      token,
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/v1/auth/logout
router.post("/logout", requireAuth(), (_req, res) => {
  return res.status(200).json({
    message: "Logged out successfully",
  });
});

// GET /api/v1/auth/me
router.get("/me", requireAuth(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");

    if (!user) {
      return next(
        new ApiError(
          401,
          "UNAUTHORIZED",
          "User no longer exists"
        )
      );
    }

    if (!user.isActive) {
      return next(
        new ApiError(
          403,
          "FORBIDDEN",
          "Account is inactive"
        )
      );
    }

    return res.status(200).json({
      user: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
});

export function createAuthRouter() {
  return router;
}