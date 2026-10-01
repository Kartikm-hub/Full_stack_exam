import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      required: true,
      index: true,
    },

    startedAt: {
      type: Date,
      required: true,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    plannedMinutes: {
      type: Number,
      required: true,
      min: 1,
    },

    actualMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED", "CANCELLED"],
      default: "ACTIVE",
    },

    source: {
      type: String,
      enum: ["MANUAL", "SCHEDULE"],
      default: "MANUAL",
    },
  },
  {
    timestamps: true,
  }
);

sessionSchema.index({
  userId: 1,
  deviceId: 1,
});

const Session = mongoose.model("Session", sessionSchema);

export default Session;