import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import cors from "cors";
import helmet from "helmet";
import * as Sentry from "@sentry/node";
// import { Handlers } from "@sentry/node"; // Missing in v8+
import Redis from "ioredis";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerNativeOAuth } from "./native-oauth";
import { registerWhatsAppWebhookRoutes } from "../whatsapp/webhook";
import { registerMetaRoutes } from "../meta-routes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./serve-static";
import { getDb } from "../db";
import { sql, eq } from "drizzle-orm";
import { users, appSettings } from "../../drizzle/schema";
import { initReminderScheduler } from "../reminderScheduler";
import { startCampaignWorker } from "../services/campaign-worker";
import { startLogCleanup } from "../services/cleanup-logs";
import { startAutoBackup } from "../services/auto-backup";
import { startSessionCleanup } from "../services/cleanup-sessions";
import multer from "multer";
import path from "path";
import fs from "fs";

import { runMigrations } from "../scripts/migrate";
import { validateProductionSecrets } from "./validate-env";
import { assertDbConstraints } from "../services/assert-db";
import { assertEnv } from "./assert-env";

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

  // DEBUG LOGGER: Log all requests to see if Meta hits the server
  app.use((req, res, next) => {
    console.log(`🌍 [INCOMING] ${req.method} ${req.originalUrl || req.url} from ${req.ip} | Headers: ${JSON.stringify(req.headers['user-agent'])}`);
    next();
  });

  app.disable("x-powered-by");

  // Rate Limit Config (Redis)
  const RATE_MAX_REDIS = 100;
  const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

  if (redis) {
    console.log("✅ Redis Rate Limiting enabled");
    redis.on("error", (err) => console.error("Redis Client Error", err));

    app.use(async (req, res, next) => {
      // Skip logic for static assets
      if (req.method === "OPTIONS") return next();
      // Skip public routes
      if (req.path.startsWith("/api/whatsapp") || req.path.startsWith("/api/webhooks")) return next();

      try {
        const key = `ratelimit:${req.ip}`;
        const count = await redis.incr(key);
        if (count === 1) await redis.expire(key, 60);
        if (count > RATE_MAX_REDIS) {
          res.setHeader("Retry-After", 60);
          return res.status(429).json({ error: "Too Many Requests" });
        }
      } catch (e) {
        console.error("Rate Limit Error:", e);
      }
      next();
    });
  }

  // Only trust proxy if explicitly enabled (prevents IP spoofing on rate limit)
  if (process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", 1);
    console.log("✅ Trust proxy enabled (X-Forwarded-* headers will be used)");
  }

  // Basic security headers (without extra deps)
  // Security Middleware
  const isProd = process.env.NODE_ENV === "production";

  if (process.env.SENTRY_DSN) {
    // Sentry.init({
    //   dsn: process.env.SENTRY_DSN,
    //   environment: process.env.NODE_ENV,
    //   tracesSampleRate: 0.1,
    // });
    // TODO: Update Sentry for v8+ (Handlers removed)
    // app.use(Sentry.Handlers.requestHandler() as any);
    // app.use(Sentry.Handlers.tracingHandler() as any);
    // console.log("✅ Sentry initialized"); // This line was removed as per instruction
  }

  // Basic security headers (without extra deps)
  // Security Middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // CSP: Allow unsafe-inline/eval to support Vite runtime & hydration
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://maps.googleapis.com"],
        upgradeInsecureRequests: null,
        imgSrc: ["'self'", "data:", "blob:", "https://*.googleusercontent.com", "https://maps.gstatic.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        connectSrc: ["'self'", "https://maps.googleapis.com"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin for images if needed
    hsts: false, // Disable HSTS for HTTP-only VPS access
    crossOriginOpenerPolicy: false, // Disable COOP to prevent warnings on HTTP
    originAgentCluster: false, // Disable Origin-Agent-Cluster to prevent warnings on HTTP
  }));

  // Force removal of HSTS header just in case
  app.use((_req, res, next) => {
    res.removeHeader("Strict-Transport-Security");
    next();
  });

  app.use(async (req, res, next) => {
    if (req.path.startsWith("/api/whatsapp")) return next();

    // existing memory fallback or just next if using redis
    next();
  });
  app.use((_req, res, next) => {
    res.removeHeader("Strict-Transport-Security");
    next();
  });

  app.use(cors({
    origin: (origin, callback) => {
      // Allow localhost in development
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      // Production strict check
      // 5.1 en prod: SI aceptar origin vacío (navegación normal, curl, mobile apps)
      if (!origin) {
        return callback(null, true);
      }

      // Normalize origins (remove trailing slashes)
      const normalize = (url: string) => url ? url.replace(/\/$/, "") : "";

      const allowedOrigins = [
        process.env.CLIENT_URL,
        process.env.VITE_API_URL,
      ].filter(Boolean).map(url => normalize(url!));

      const normalizedOrigin = normalize(origin);

      if (allowedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from origin: '${origin}' (Normalized: '${normalizedOrigin}')`);
        console.warn(`[CORS] Allowed list: ${JSON.stringify(allowedOrigins)}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }));

  // 5.2 Same-Site Guard Middleware
  // Protects against CSRF for mutations even if CORS fails or is bypassed
  const allowedSet = new Set([
    process.env.CLIENT_URL,
    process.env.VITE_API_URL,
  ].filter(Boolean) as string[]);

  app.use((req, res, next) => {
    // Only verify for mutations
    const method = req.method.toUpperCase();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return next();

    // Dev allow
    if (process.env.NODE_ENV !== "production") return next();

    const origin = req.headers.origin;
    if (!origin || !allowedSet.has(origin)) {
      console.warn(`[Security] Blocked CSRF attempt from origin: ${origin}`);
      return res.status(403).json({ error: "CSRF blocked" });
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

  // Memory leak prevention: clean up expired buckets periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (now > bucket.resetAt) {
        buckets.delete(key);
      }
    }
  }, 300000); // 5 minutes

  // Health check for Docker/K8s
  app.get("/api/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

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

  // --- DEBUG ROUTE REMOVED FOR SECURITY ---
  // app.get("/api/public-debug", ...) 

  // Configure body parser with larger size limit for file uploads
  // Also keep raw body for WhatsApp webhook signature verification
  // Configure body parser with stricter size limit for security
  // Uploads are handled by multer (multipart), so they are not affected by this limit.
  // Keep raw body for WhatsApp webhook checking.
  app.use(
    express.json({
      limit: "50kb",
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ limit: "50kb", extended: true }));

  // Native OAuth (Google + Microsoft)
  registerNativeOAuth(app);

  // Legacy OAuth callback (backward compatibility if needed)
  if (process.env.SENTRY_DSN) {
    // TODO: Update Sentry for v8+
    // app.use(Sentry.Handlers.errorHandler() as any);
  }

  registerOAuthRoutes(app);

  // WhatsApp Cloud API webhook
  registerWhatsAppWebhookRoutes(app);

  // Meta OAuth & Webhook
  registerMetaRoutes(app);

  // --- FILE UPLOAD ENDPOINT (SECURED) ---
  // Store uploads outside the webroot for security
  // const staticRoot = ... (removed)
  const uploadDir = path.join(process.cwd(), "storage/uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: function (_req, _file, cb) {
      cb(null, uploadDir);
    },
    filename: function (_req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max
      files: 5 // Max 5 files per request
    },
    fileFilter: (_req, file, cb) => {
      // SECURITY: Block SVG to prevent XSS
      if (file.mimetype === "image/svg+xml") {
        return cb(new Error("SVG files are not allowed for security reasons."));
      }

      // Allowlist
      const allowedTypes = [
        "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif",
        "video/mp4", "video/webm", "video/quicktime",
        "application/pdf"
      ];

      if (!allowedTypes.includes(file.mimetype)) {
        return cb(new Error(`Invalid file type: ${file.mimetype}`));
      }
      cb(null, true);
    }
  });

  // SERVE UPLOADS (Authenticated)
  // We need a way to check auth for these static files if we want strict privacy,
  // OR we can just serve them publicly via a specific route but logically separate from code.
  // User requested "servir por endpoint con auth"

  // Middleware to check authentication for uploads
  // SECURITY: Protect file uploads from unauthorized access
  const requireAuthMiddleware = async (req: any, res: any, next: any) => {
    try {
      // Create context using the same method as tRPC
      const ctx = await createContext({ req, res } as any);

      if (!ctx.user) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "You must be logged in to access this resource"
        });
      }

      // User is authenticated, allow access
      next();
    } catch (err) {
      console.error("[Auth] File upload authentication failed:", err);
      return res.status(401).json({
        error: "Authentication failed",
        message: "Invalid or expired session"
      });
    }
  };

  app.get("/api/uploads/:name", requireAuthMiddleware, (req, res) => {
    const name = req.params.name;
    // Prevent directory traversal
    const safeName = path.basename(name);
    const filepath = path.join(uploadDir, safeName);

    // Security headers
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'"); // Prevent executing scripts inside

    if (fs.existsSync(filepath)) {
      res.sendFile(filepath);
    } else {
      res.status(404).send("Not found");
    }
  });

  // AUTH REQUIRED: Only authenticated users can upload
  app.post('/api/upload', async (req, res, next) => {
    const ctx = await createContext({ req, res } as any);
    if (!ctx.user) {
      return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }
    next();
  }, upload.array('files'), (req, res) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = files.map(file => ({
      name: file.originalname,
      url: `/api/uploads/${file.filename}`, // Servido por nuestro nuevo endpoint
      type: file.mimetype.startsWith('image/') ? 'image' :
        file.mimetype.startsWith('video/') ? 'video' : 'file',
      size: file.size
    }));

    res.json({ files: uploadedFiles });
  });

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
    // Dynamic import with variable to PREVENT esbuild from bundling vite.ts and its dependencies
    // (like @tailwindcss/vite) into the production build.
    const viteModulePath = "./vite";
    const { setupVite } = await import(viteModulePath);
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

  // GLOBAL ERROR HANDLER (DEBUG)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("🔴 APP ERROR:", err);
    console.error("Stack:", err.stack);
    if (!res.headersSent) {
      res.status(500).send("Internal Application Error");
    }
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}`);

    // Initialize automated reminder scheduler
    initReminderScheduler();
    startCampaignWorker();
    startLogCleanup();
    startAutoBackup();
    startSessionCleanup();
  });
}

import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";



const run = async () => {
  console.log("[Startup] Server Version: Secure-Hardened-v1");

  // CRITICAL: Fail fast if env is unsafe
  assertEnv();

  if (process.env.RUN_MIGRATIONS === "1") {
    try {
      console.log("[Startup] Starting database migration...");
      await runMigrations();
      console.log("[Startup] Database migration completed.");
    } catch (e) {
      console.error("[Startup] CRITICAL: Auto-migration failed:", e);
      // Always exit on migration failure
      process.exit(1);
    }
  } else {
    console.log("[Startup] Skipping migrations (RUN_MIGRATIONS != 1)");
  }

  await startServer();
  // checkAndSeedAdmin removed
  // ensureAppSettings intentionally left until Phase 1.3
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
        // Ensure other JSON fields are not null if schema requires them or code breaks
        salesConfig: { defaultCommissionRate: 0, currencySymbol: "₲", requireValueOnWon: false },
        chatDistributionConfig: { mode: "manual", excludeAgentIds: [] },
      });
      console.log("[SEED] AppSettings seeded successfully.");
    }
  } catch (e) {
    console.error("[SEED] Failed to seed AppSettings:", e);
  }
}

// checkAndSeedAdmin function removed for security. Use 'pnpm bootstrap:admin' instead.

// CheckAndSeedAdmin is called in run()

