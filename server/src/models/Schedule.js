import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    days: {
      type: [Number],
      required: true,
      validate: {
        validator: (days) =>
          days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6),
        message: "Days must contain values from 0 to 6",
      },
    },

    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },

    durationMin: {
      type: Number,
      required: true,
      min: 1,
    },

    enabled: {
      type: Boolean,
      default: true,
    },

    lastRunAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Schedule", scheduleSchema);