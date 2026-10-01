import connectDB from "./config/db.js";
import { pathToFileURL } from "node:url";
import { createApp, createDefaultLogger } from "./app.js";
import { loadConfig } from "./config/index.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * Start the HTTP server.
 *
 * MongoDB is connected in main() before this function is called.
 * Keeping startServer synchronous makes it easier to test without
 * requiring a live MongoDB connection.
 */
export function startServer({ config = loadConfig() } = {}) {
  const logger = createDefaultLogger(config);
  const app = createApp({ config, logger });

  const server = app.listen(config.port, () => {
    logger.info(
      {
        environment: config.nodeEnv,
        port: config.port,
        mongodb: config.hasMongodbUri
          ? "configured"
          : "not_configured",
        database: "mongodb",
      },
      "Server started"
    );
  });

  server.on("error", (error) => {
    logger.error(
      {
        error: error.message,
      },
      "HTTP server error"
    );
  });

  let isClosing = false;

  const close = async () => {
    if (isClosing) {
      return;
    }

    isClosing = true;

    logger.info("Starting graceful shutdown");

    const forceShutdownTimer = setTimeout(() => {
      logger.error("Graceful shutdown timed out");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    forceShutdownTimer.unref();

    await new Promise((resolve) => {
      server.close((error) => {
        if (error) {
          logger.error(
            {
              error: error.message,
            },
            "Error while closing HTTP server"
          );
        }

        resolve();
      });

      // Available in newer Node.js versions.
      server.closeAllConnections?.();
    });

    clearTimeout(forceShutdownTimer);

    logger.info("HTTP server closed");
  };

  return {
    app,
    server,
    config,
    close,
  };
}

async function main() {
  let config;

  // Load and validate environment configuration.
  try {
    config = loadConfig();
  } catch (error) {
    process.stderr.write(
      `\nConfiguration error: ${error.message}\n\n`
    );
    process.exit(1);
  }

  // Connect to MongoDB using the validated configuration.
  try {
    await connectDB(config.mongodbUri);
  } catch (error) {
    process.stderr.write(
      `\nMongoDB connection failed: ${error.message}\n\n`
    );
    process.exit(1);
  }

  // Start the HTTP server.
  let close;

  try {
    ({ close } = startServer({ config }));
  } catch (error) {
    process.stderr.write(
      `\nServer startup failed: ${error.message}\n\n`
    );
    process.exit(1);
  }

  const shutdown = async (signal) => {
    process.stdout.write(
      `\nReceived ${signal}. Shutting down...\n`
    );

    try {
      await close();
      process.exit(0);
    } catch (error) {
      process.stderr.write(
        `Shutdown failed: ${error.message}\n`
      );
      process.exit(1);
    }
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  process.on("unhandledRejection", (reason) => {
    process.stderr.write(
      `Unhandled promise rejection: ${
        reason instanceof Error
          ? reason.message
          : String(reason)
      }\n`
    );
  });

  process.on("uncaughtException", (error) => {
    process.stderr.write(
      `Uncaught exception: ${error.message}\n`
    );

    void shutdown("uncaughtException");
  });
}

const isMainModule =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  void main();
}