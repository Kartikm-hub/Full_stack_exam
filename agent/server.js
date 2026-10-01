const WebSocket = require("ws");
const { z } = require("zod");
const dotenv = require("dotenv");
const pairingManager = require("./pairing");
const stateManager = require("./state");

dotenv.config();

const PORT = parseInt(process.env.PORT || "8765", 10);
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

let wss = null;
const clients = new Set();

// Zod Schemas for incoming WebSocket messages
const HelloSchema = z.object({
  type: z.literal("hello")
});

const PairSchema = z.object({
  type: z.literal("pair"),
  code: z.string().optional(),
  payload: z.object({ code: z.string().optional() }).optional()
}).transform((data) => ({
  type: "pair",
  code: (data.code || data.payload?.code || "").trim()
})).refine((data) => data.code.length > 0, {
  message: "Pairing code must be provided"
});

const GetStateSchema = z.object({
  type: z.literal("getState"),
  deviceKey: z.string().optional(),
  payload: z.object({ deviceKey: z.string().optional() }).optional()
}).transform((data) => ({
  type: "getState",
  deviceKey: data.deviceKey || data.payload?.deviceKey
}));

const EnterFocusSchema = z.object({
  type: z.literal("enterFocus"),
  deviceKey: z.string().optional(),
  duration: z.number().optional(),
  durationMs: z.number().optional(), // Optional fast test duration for automated testing
  strict: z.boolean().optional(),
  allowList: z.array(z.string()).optional(),
  payload: z.object({
    deviceKey: z.string().optional(),
    duration: z.number().optional(),
    durationMs: z.number().optional(),
    strict: z.boolean().optional(),
    allowList: z.array(z.string()).optional()
  }).optional()
}).transform((data) => ({
  type: "enterFocus",
  deviceKey: data.deviceKey || data.payload?.deviceKey,
  duration: data.duration ?? data.payload?.duration,
  durationMs: data.durationMs ?? data.payload?.durationMs,
  strict: data.strict ?? data.payload?.strict ?? false,
  allowList: data.allowList || data.payload?.allowList
}));

const ExitFocusSchema = z.object({
  type: z.literal("exitFocus"),
  deviceKey: z.string().optional(),
  payload: z.object({ deviceKey: z.string().optional() }).optional()
}).transform((data) => ({
  type: "exitFocus",
  deviceKey: data.deviceKey || data.payload?.deviceKey
}));

const BaseSchema = z.object({
  type: z.string({ required_error: "Message type is required" })
});

function verifyClient(info, callback) {
  const origin = info.req.headers.origin;

  if (ALLOWED_ORIGINS.length > 0) {
    if (ALLOWED_ORIGINS.includes("*")) {
      return callback(true);
    }
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      return callback(false, 403, "Unauthorized Origin");
    }
  }
  callback(true);
}

function sendJson(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(obj));
    } catch (err) {
      // Ignore send error on broken socket
    }
  }
}

function sendError(ws, message, code = "ERROR", details = undefined) {
  sendJson(ws, {
    type: "error",
    message,
    code,
    ...(details ? { details } : {})
  });
}

function broadcastState() {
  const fullState = stateManager.getFullState();
  const stateMessage = {
    type: "state",
    ...fullState,
    payload: fullState
  };

  for (const client of clients) {
    sendJson(client, stateMessage);
  }
}

function isClientAuthenticated(ws, providedKey) {
  if (ws.authenticated) return true;
  if (providedKey && pairingManager.validateDeviceKey(providedKey)) {
    ws.authenticated = true;
    return true;
  }
  return false;
}

async function handleMessage(ws, rawData) {
  let parsedJson;
  try {
    parsedJson = JSON.parse(rawData.toString());
  } catch (err) {
    return sendError(ws, "Malformed JSON format", "INVALID_JSON");
  }

  const baseResult = BaseSchema.safeParse(parsedJson);
  if (!baseResult.success) {
    return sendError(ws, "Invalid message structure: missing type field", "INVALID_FORMAT");
  }

  const { type } = baseResult.data;

  switch (type) {
    case "hello": {
      const result = HelloSchema.safeParse(parsedJson);
      if (!result.success) {
        return sendError(ws, "Invalid hello message format", "VALIDATION_ERROR");
      }
      sendJson(ws, {
        type: "hello",
        paired: pairingManager.isPaired(),
        status: stateManager.getStatus()
      });
      break;
    }

    case "pair": {
      const result = PairSchema.safeParse(parsedJson);
      if (!result.success) {
        return sendError(ws, "Invalid pair payload", "VALIDATION_ERROR", result.error.errors);
      }

      const { code } = result.data;
      const pairResult = pairingManager.attemptPairing(code);

      if (pairResult.success) {
        ws.authenticated = true;
        sendJson(ws, {
          type: "paired",
          deviceKey: pairResult.deviceKey,
          status: stateManager.getStatus(),
          payload: {
            deviceKey: pairResult.deviceKey
          }
        });
        broadcastState();
      } else {
        sendError(ws, pairResult.error, pairResult.code || "PAIRING_FAILED");
      }
      break;
    }

    case "getState": {
      const result = GetStateSchema.safeParse(parsedJson);
      if (!result.success) {
        return sendError(ws, "Invalid getState payload", "VALIDATION_ERROR");
      }

      if (!isClientAuthenticated(ws, result.data.deviceKey)) {
        return sendError(ws, "Unauthorized: Invalid or missing deviceKey", "UNAUTHORIZED");
      }

      const fullState = stateManager.getFullState();
      sendJson(ws, {
        type: "state",
        ...fullState,
        payload: fullState
      });
      break;
    }

    case "enterFocus": {
      const result = EnterFocusSchema.safeParse(parsedJson);
      if (!result.success) {
        return sendError(ws, "Invalid enterFocus payload", "VALIDATION_ERROR");
      }

      if (!isClientAuthenticated(ws, result.data.deviceKey)) {
        return sendError(ws, "Unauthorized: Invalid or missing deviceKey", "UNAUTHORIZED");
      }

      if (stateManager.getStatus() === "FOCUSING") {
        return sendError(ws, "Focus session already active", "SESSION_ACTIVE");
      }

      const { duration, durationMs, allowList, strict } = result.data;
      let fullState;
      try {
        fullState = await stateManager.startFocus({ duration, durationMs, allowList, strict });
      } catch (err) {
        return sendError(ws, err.message || "Failed to enter focus", err.code || "FOCUS_ERROR");
      }

      sendJson(ws, {
        type: "focusStarted",
        duration: fullState.focusSession.duration,
        endsAt: fullState.endsAt,
        status: "FOCUSING",
        allowList: fullState.allowList,
        hiddenApps: fullState.hiddenApps
      });

      broadcastState();
      break;
    }

    case "exitFocus": {
      const result = ExitFocusSchema.safeParse(parsedJson);
      if (!result.success) {
        return sendError(ws, "Invalid exitFocus payload", "VALIDATION_ERROR");
      }

      if (!isClientAuthenticated(ws, result.data.deviceKey)) {
        return sendError(ws, "Unauthorized: Invalid or missing deviceKey", "UNAUTHORIZED");
      }

      await stateManager.endFocus();

      sendJson(ws, {
        type: "focusEnded",
        status: "IDLE"
      });

      broadcastState();
      break;
    }

    default: {
      sendError(ws, `Unknown message type: ${type}`, "UNKNOWN_TYPE");
      break;
    }
  }
}

function startServer(port = PORT) {
  if (wss) return wss;

  wss = new WebSocket.Server({
    host: "127.0.0.1",
    port,
    verifyClient
  });

  // Broadcast generic state updates to all connected clients (skip when timer expiry handled by onFocusEnded)
  stateManager.onStateChange((_state, expired) => {
    if (!expired) broadcastState();
  });

  // When the internal focus timer expires, send focusEnded then state to all clients
  stateManager.onFocusEnded(() => {
    const focusEndedMsg = JSON.stringify({ type: "focusEnded", status: "IDLE" });
    const fullState = stateManager.getFullState();
    const stateMsg = JSON.stringify({ type: "state", ...fullState, payload: fullState });
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        try { client.send(focusEndedMsg); } catch (e) {}
        try { client.send(stateMsg); } catch (e) {}
      }
    }
  });

  wss.on("connection", (ws, req) => {
    clients.add(ws);

    ws.on("message", (message) => {
      handleMessage(ws, message);
    });

    ws.on("error", () => {
      clients.delete(ws);
    });

    ws.on("close", () => {
      clients.delete(ws);
    });

    sendJson(ws, {
      type: "hello",
      paired: pairingManager.isPaired(),
      status: stateManager.getStatus()
    });
  });

  wss.on("error", (err) => {
    // Keep the agent alive, but make a port/configuration failure diagnosable.
    console.error("[Focus Mode] Local WebSocket server error:", err.code || err.message);
  });

  return wss;
}

function stopServer() {
  if (wss) {
    for (const client of clients) {
      try {
        client.close();
      } catch (err) {
        // Ignore close error
      }
    }
    clients.clear();
    try {
      wss.close();
    } catch (err) {
      // Ignore close error
    }
    wss = null;
  }
}

module.exports = {
  startServer,
  stopServer,
  PORT
};
