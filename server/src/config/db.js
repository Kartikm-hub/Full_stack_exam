import mongoose from "mongoose";

const connectDB = async (mongodbUri, logger) => {
  if (!mongodbUri) {
    throw new Error("MONGODB_URI is not configured");
  }

  try {
    await mongoose.connect(mongodbUri);
    logger?.info?.("MongoDB connected");
  } catch (error) {
    logger?.error?.("MongoDB connection failed", {
      error: error.message,
    });
    throw error;
  }
};

export default connectDB;