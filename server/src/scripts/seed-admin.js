import mongoose from "mongoose";
import { loadConfig } from "../config/index.js";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import { hashPassword } from "../lib/auth.js";

async function seedAdmin() {
  const config = loadConfig();

  const name = process.env.ADMIN_NAME;
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      "ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD are required"
    );
  }

  await connectDB(config.mongodbUri);

  const existingAdmin = await User.findOne({ email });

  if (existingAdmin) {
    if (existingAdmin.role !== "ADMIN") {
      existingAdmin.role = "ADMIN";
      await existingAdmin.save();
      process.stdout.write(`User promoted to admin: ${email}\n`);
    } else {
      process.stdout.write(`Admin already exists: ${email}\n`);
    }

    return;
  }

  const passwordHash = await hashPassword(password);

  await User.create({
    name,
    email,
    passwordHash,
    role: "ADMIN",
  });

  process.stdout.write(`Admin created: ${email}\n`);
}

try {
  await seedAdmin();
} catch (error) {
  process.stderr.write(`Admin seed failed: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}