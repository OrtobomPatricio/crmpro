import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerWhatsAppWebhookRoutes } from "../whatsapp/webhook";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getDb } from "../db";
import { sql, eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { initReminderScheduler } from "../reminderScheduler";
import { startCampaignWorker } from "../services/campaign-worker";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  app.disable("x-powered-by");

  // If running behind Nginx/Cloudflare/Hostinger proxy, trust X-Forwarded-* headers
  app.set("trust proxy", 1);

  // Basic security headers (without extra deps)
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    // HSTS only when behind HTTPS
    if (_req.secure || String(_req.headers["x-forwarded-proto"] ?? "").toLowerCase().includes("https")) {
      res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    }
    next();
  });

  // Request id
  app.use((req, res, next) => {
    const id = `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
    (req as any).requestId = id;
    res.setHeader("X-Request-Id", id);
    next();
  });

  // Simple in-memory rate limit (good enough for single-node deployments)
  const RATE_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? "60000");
  const RATE_MAX = Number(process.env.RATE_LIMIT_MAX ?? "600");
  const buckets = new Map<string, { count: number; resetAt: number }>();

  app.use((req, res, next) => {
    if (req.path.startsWith("/api/whatsapp")) return next();

    const key = (req.ip ?? req.socket.remoteAddress ?? "unknown").toString();
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > RATE_MAX) {
      return res.status(429).json({ error: "rate_limit" });
    }

    next();
  });

  setInterval(() => {
    const now = Date.now();
    Array.from(buckets.entries()).forEach(([k, v]) => {
      if (now > v.resetAt) buckets.delete(k);
    });
  }, 30_000).unref?.();


  const server = createServer(app);

  // Basic health check for load balancers / uptime monitors
  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

  // Readiness: check DB connectivity
  app.get("/readyz", async (_req, res) => {
    try {
      const db = await getDb();
      if (db) {
        await db.execute(sql`SELECT 1`);
        return res.status(200).json({ ok: true, db: true });
      }
      return res.status(503).json({ ok: false, db: false });
    } catch (_err) {
      return res.status(503).json({ ok: false, db: false });
    }
  });

  // --- DEBUG ROUTE (TEMPORARY) ---
  app.get("/api/public-debug", async (req, res) => {
    try {
      const db = await getDb();
      let dbStatus = "unknown";
      if (!db) {
        dbStatus = "failed: db_null";
      } else {
        try {
          await db.execute(sql`SELECT 1`);
          dbStatus = "connected";
        } catch (e) {
          dbStatus = `failed: ${String(e)}`;
        }
      }

      const cookies = req.headers.cookie || "none";

      // Attempt manual verify
      let sessionStatus = "no_cookie";
      let decoded = null;
      if (req.headers.cookie) {
        try {
          const { sdk } = await import("./sdk");
          const { getUserByOpenId } = await import("../db");
          const parsed = (req.headers.cookie.split(';').find(c => c.trim().startsWith('app_session_id=')) || "").split('=')[1];
          if (parsed) {
            decoded = await sdk.verifySession(parsed);
            if (decoded) {
              const userInDb = await getUserByOpenId(decoded.openId);
              sessionStatus = userInDb ? "valid_and_persisted" : "valid_token_but_user_missing_in_db";
            } else {
              sessionStatus = "invalid_signature";
            }
          } else {
            sessionStatus = "cookie_found_but_token_missing";
          }
        } catch (e) {
          sessionStatus = `error_verifying: ${String(e)}`;
        }
      }

      // VITAL: Compare with the actual SDK function used by TRPC
      let sdkAuthResult = "not_attempted";
      try {
        const { sdk } = await import("./sdk");
        const user = await sdk.authenticateRequest(req);
        sdkAuthResult = user ? "success_user_found" : "failed_null_user";
      } catch (e: any) {
        sdkAuthResult = `failed_error: ${e.message || String(e)}`;
      }

      let autoFix = "none";
      if (sdkAuthResult.includes("User is disabled") && decoded && decoded.openId === "admin-user") {
        try {
          const db = await getDb();
          if (db) {
            await db.update(users).set({ isActive: true }).where(eq(users.openId, decoded.openId));
            autoFix = "success_reactivated_admin";
            // Re-check to confirm
            sdkAuthResult = "success_user_recovered (refresh page)";
          }
        } catch (e) {
          autoFix = `failed: ${String(e)}`;
        }
      }

      res.json({
        timestamp: new Date().toISOString(),
        headers: {
          host: req.headers.host,
          x_forwarded_proto: req.headers["x-forwarded-proto"],
          cookie_length: cookies.length,
          cookie_raw: cookies.substring(0, 50) + "...", // truncate for safety log but visible enough
        },
        env: {
          appId: process.env.VITE_APP_ID || "fallback",
          // Show first 4 chars of secret to verify consistency without leaking
          cookieSecretPrefix: (process.env.JWT_SECRET || "fallback").substring(0, 4) + "****",
          oauthServer: process.env.OAUTH_SERVER_URL || "fallback",
          ownerOpenId: process.env.OWNER_OPEN_ID || "fallback",
        },
        db: dbStatus,
        session: {
          status: sessionStatus,
          decoded_openid: decoded?.openId || null,
          sdk_direct_check: sdkAuthResult,
          auto_fix: autoFix
        }
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
  // -------------------------------

  // Configure body parser with larger size limit for file uploads
  // Also keep raw body for WhatsApp webhook signature verification
  app.use(
    express.json({
      limit: "50mb",
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // WhatsApp Cloud API webhook
  registerWhatsAppWebhookRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");

  // In production (VPS / reverse-proxy setups), you typically want a fixed port.
  // Auto-fallback is convenient locally, but can break Nginx/Hostinger configs.
  const port =
    process.env.NODE_ENV === "production"
      ? preferredPort
      : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}`);

    // Initialize automated reminder scheduler
    initReminderScheduler();
    startCampaignWorker();
  });
}

startServer().catch(console.error);
