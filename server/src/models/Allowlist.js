import mongoose from "mongoose";

const allowlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    protectedApps: {
      type: [String],
      default: ["browser", "agent", "system"],
    },

    userApps: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const Allowlist = mongoose.model("Allowlist", allowlistSchema);

export default Allowlist;