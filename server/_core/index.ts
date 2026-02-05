import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import cors from "cors";
import helmet from "helmet";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerNativeOAuth } from "./native-oauth";
import { registerWhatsAppWebhookRoutes } from "../whatsapp/webhook";
import { registerMetaRoutes } from "../meta-routes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./serve-static";
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { appSettings } from "../../drizzle/schema";
import { initReminderScheduler } from "../reminderScheduler";
import { startCampaignWorker } from "../services/campaign-worker";
import { startLogCleanup } from "../services/cleanup-logs";
import { startAutoBackup } from "../services/auto-backup";
import { startSessionCleanup } from "../services/cleanup-sessions";
import { runMigrations } from "../scripts/migrate";
import { validateProductionSecrets } from "./validate-env";
import { assertDbConstraints } from "../services/assert-db";
import { assertEnv } from "./assert-env";

// Modular Imports
import { requireAuthMiddleware } from "./middleware/auth";
import { rateLimitMiddleware } from "./middleware/rate-limit";
import { uploadMiddleware, handleUpload, serveUpload } from "../controllers/upload.controller";

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
  // CRITICAL: Validate production secrets BEFORE starting server
  validateProductionSecrets();

  // CRITICAL: Ensure DB is hardened
  await assertDbConstraints();

  const app = express();

  // DEBUG LOGGER: Log all requests
  app.use((req, res, next) => {
    console.log(`🌍 [INCOMING] ${req.method} ${req.originalUrl || req.url} from ${req.ip} | UA: ${req.headers['user-agent']?.substring(0, 50)}...`);
    next();
  });

  app.disable("x-powered-by");

  // Rate Limiting (Modular)
  app.use(rateLimitMiddleware);

  // Trust Proxy Config
  if (process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", 1);
    console.log("✅ Trust proxy enabled");
  }

  // Security Headers (Helmet)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://maps.googleapis.com"],
        upgradeInsecureRequests: null,
        imgSrc: ["'self'", "data:", "blob:", "https://*.googleusercontent.com", "https://maps.gstatic.com", "https://*.whatsapp.net", "https://*.fbcdn.net", "https://*.cdninstagram.com", "https://*.wadata.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        connectSrc: ["'self'", "https://maps.googleapis.com"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: false, // Disable HSTS for HTTP-only VPS access context
    crossOriginOpenerPolicy: false,
    originAgentCluster: false,
  }));

  // CORS Config
  app.use(cors({
    origin: (origin, callback) => {
      if (process.env.NODE_ENV !== "production") return callback(null, true);
      if (!origin) return callback(null, true);

      const normalize = (url: string) => url ? url.replace(/\/$/, "") : "";
      const allowedOrigins = [
        process.env.CLIENT_URL,
        process.env.VITE_API_URL,
        process.env.VITE_OAUTH_PORTAL_URL,
      ].filter(Boolean).map(url => normalize(url!));

      if (allowedOrigins.includes(normalize(origin))) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }));

  // CSRF Protection (Same-Site Guard)
  const allowedSet = new Set([
    process.env.CLIENT_URL,
    process.env.VITE_API_URL,
    process.env.VITE_OAUTH_PORTAL_URL,
  ].filter(Boolean) as string[]);

  app.use((req, res, next) => {
    if (req.path.startsWith("/api/whatsapp") || req.path.startsWith("/api/webhooks") || req.path.startsWith("/api/meta")) {
      return next();
    }
    const method = req.method.toUpperCase();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return next();
    if (process.env.NODE_ENV !== "production") return next();

    const origin = req.headers.origin;
    if (!origin || !allowedSet.has(origin)) {
      console.warn(`[Security] CTSRF Blocked: ${origin}`);
      return res.status(403).json({ error: "CSRF blocked" });
    }
    next();
  });

  // Request ID
  app.use((req, res, next) => {
    const id = `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
    (req as any).requestId = id;
    res.setHeader("X-Request-Id", id);
    next();
  });

  // Body Parsing
  // Keep raw body for WhatsApp signature verification
  app.use(express.json({
    limit: "50kb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }));
  app.use(express.urlencoded({ limit: "50kb", extended: true }));

  // Routes
  app.get("/api/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));
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

  // OAuth & Webhooks
  registerNativeOAuth(app);
  registerOAuthRoutes(app);
  registerWhatsAppWebhookRoutes(app);
  registerMetaRoutes(app);

  // File Uploads (Modular)
  // Serve uploaded files securely
  app.get("/api/uploads/:name", requireAuthMiddleware, serveUpload);

  // Handle new uploads
  app.post('/api/upload', requireAuthMiddleware, uploadMiddleware.array('files'), handleUpload);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Serve Frontend (Vite or Static)
  if (process.env.NODE_ENV === "development") {
    const viteModulePath = "./vite";
    const { setupVite } = await import(viteModulePath);
    await setupVite(app);
  } else {
    serveStatic(app);
  }

  // Start Server
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = process.env.NODE_ENV === "production"
    ? preferredPort
    : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Global Error Handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("🔴 APP ERROR:", err);
    if (!res.headersSent) {
      res.status(500).send("Internal Application Error");
    }
  });

  const httpServer = createServer(app);
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}`);

    // Background Services
    initReminderScheduler();
    startCampaignWorker();
    startLogCleanup();
    startAutoBackup();
    startSessionCleanup();
    // Restore WhatsApp Sessions
    import("../services/whatsapp-restorer").then(({ startWhatsAppSessions }) => {
      startWhatsAppSessions().catch(err => console.error("[WhatsAppSession] Startup failed:", err));
    });
  });
}

const run = async () => {
  console.log("[Startup] Server Version: Modular-v2");
  assertEnv();

  if (process.env.RUN_MIGRATIONS === "1") {
    try {
      console.log("[Startup] Starting database migration...");
      await runMigrations();
      console.log("[Startup] Database migration completed.");
    } catch (e) {
      console.error("[Startup] CRITICAL: Auto-migration failed:", e);
      process.exit(1);
    }
  }

  await startServer();
  await ensureAppSettings();
};

run().catch(console.error);

async function ensureAppSettings() {
  const db = await getDb();
  if (!db) return;

  try {
    const rows = await db.select().from(appSettings).limit(1);
    if (rows.length === 0) {
      console.log("[SEED] AppSettings empty. Creating defaults...");
      await db.insert(appSettings).values({
        companyName: "Imagine Lab CRM",
        timezone: "America/Asuncion",
        language: "es",
        currency: "PYG",
        permissionsMatrix: {
          owner: ["*"],
          admin: [
            "dashboard.*",
            "leads.*",
            "kanban.*",
            "campaigns.*",
            "chat.*",
            "scheduling.*",
            "monitoring.*",
            "analytics.*",
            "reports.*",
            "integrations.*",
            "settings.*",
            "users.*",
          ],
          supervisor: [
            "dashboard.view",
            "leads.view",
            "kanban.view",
            "chat.*",
            "monitoring.*",
            "analytics.view",
            "reports.view",
          ],
          agent: ["dashboard.view", "leads.*", "kanban.view", "chat.*", "scheduling.*"],
          viewer: ["dashboard.view", "leads.view", "kanban.view", "analytics.view", "reports.view"],
        },
        scheduling: { slotMinutes: 15, maxPerSlot: 6, allowCustomTime: true },
        salesConfig: { defaultCommissionRate: 0, currencySymbol: "₲", requireValueOnWon: false },
        chatDistributionConfig: { mode: "manual", excludeAgentIds: [] },
      });
      console.log("[SEED] AppSettings seeded successfully.");
    }
  } catch (e) {
    console.error("[SEED] Failed to seed AppSettings:", e);
  }
}

