import mongoose from "mongoose";

const presetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    apps: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model("Preset", presetSchema);