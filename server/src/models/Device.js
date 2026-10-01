import mongoose from "mongoose";

const deviceSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    os: {
      type: String,
      enum: ["WINDOWS", "MACOS"],
      required: true,
    },

    pairedAt: {
      type: Date,
      default: null,
    },

    lastSeenAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["CONNECTED", "DISCONNECTED", "FOCUSING"],
      default: "DISCONNECTED",
    },

    pairTokenHash: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Device", deviceSchema);