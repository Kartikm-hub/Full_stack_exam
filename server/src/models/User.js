import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
  isActive: { type: Boolean, default: true },
  defaultDurationMin: { type: Number, enum: [25, 50, 60, 90, 120], default: 25 },
  userApps: { type: [String], default: [] },
}, { timestamps: true, versionKey: false })

export const User = mongoose.models.User || mongoose.model('User', userSchema)