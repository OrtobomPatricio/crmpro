import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerWhatsAppWebhookRoutes } from "../whatsapp/webhook";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./serve-static";
import { getDb } from "../db";
import { sql, eq } from "drizzle-orm";
import { users, appSettings } from "../../drizzle/schema";
import { initReminderScheduler } from "../reminderScheduler";
import { startCampaignWorker } from "../services/campaign-worker";
import multer from "multer";
import path from "path";
import fs from "fs";

import { runMigrations } from "../scripts/migrate";
import { validateProductionSecrets } from "./validate-env";

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

  const app = express();
  app.disable("x-powered-by");

  // Only trust proxy if explicitly enabled (prevents IP spoofing on rate limit)
  if (process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", 1);
    console.log("✅ Trust proxy enabled (X-Forwarded-* headers will be used)");
  }

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

  // --- DEBUG ROUTE REMOVED FOR SECURITY ---
  // app.get("/api/public-debug", ...) 

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

  // --- FILE UPLOAD ENDPOINT (SECURED) ---
  // Production-ready path: dist/public in prod, client/public in dev
  const staticRoot = process.env.NODE_ENV === "production"
    ? path.join(process.cwd(), "dist/public")
    : path.join(process.cwd(), "client/public");

  const storage = multer.diskStorage({
    destination: function (_req, _file, cb) {
      const uploadDir = path.join(staticRoot, "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
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
      // Only allow images and videos
      const allowed = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');
      if (!allowed) {
        return cb(new Error('Invalid file type. Only images and videos allowed.'));
      }
      cb(null, true);
    }
  });

  // AUTH REQUIRED: Only authenticated users can upload
  app.post('/api/upload', async (req, res, next) => {
    const ctx = await createContext({ req, res } as any);
    if (!ctx.user) {
      return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }
    // Optional: Check for specific permission (e.g., settings.manage)
    // For now, any authenticated user can upload
    next();
  }, upload.array('files'), (req, res) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = files.map(file => ({
      name: file.originalname,
      url: `/uploads/${file.filename}`, // Served via static
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

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}`);

    // Initialize automated reminder scheduler
    initReminderScheduler();
    startCampaignWorker();
  });
}

import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

const run = async () => {
  console.log("[Startup] Server Version: Fix-AutoMigrate-StaticImport-v2");

  if (process.env.RUN_MIGRATIONS === "1") {
    try {
      console.log("[Startup] Starting database migration...");
      await runMigrations();
      console.log("[Startup] Database migration completed.");
    } catch (e) {
      console.error("[Startup] CRITICAL: Auto-migration failed:", e);
      // We continue to start server even if migration fails, to allow debugging
    }
  } else {
    console.log("[Startup] Skipping migrations (RUN_MIGRATIONS != 1)");
  }

  await startServer();
  await checkAndSeedAdmin();
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

async function checkAndSeedAdmin() {
  const db = await getDb();
  if (!db) return;

  // In Production, NEVER auto-seed default credentials.
  if (process.env.NODE_ENV === "production") {
    console.log("[SEED] Production mode detected. Skipping auto-seed of admin.");
    // Optional: Check if admin exists and warn if none
    return;
  }

  const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);
  const count = Number(userCount[0]?.count ?? 0);

  if (count === 0) {
    console.log("[SEED] No users found. Creating default admin (DEV ONLY)...");

    // Fail-safe: if someone tries to use this in prod by mistake, ensure we don't use weak passwords unless forced? 
    // Actually we already returned if NODE_ENV=production.

    // Allow override via env
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@crm.com";
    const pass = process.env.BOOTSTRAP_ADMIN_PASSWORD || "admin123";

    const hashedPassword = await bcrypt.hash(pass, 10);
    const openId = `local_${nanoid(16)}`;

    await db.insert(users).values({
      openId,
      name: "Admin User",
      email: email,
      password: hashedPassword,
      role: "owner",
      loginMethod: "credentials",
      isActive: true,
      hasSeenTour: false,
    });

    console.log("[SEED] Default admin created:");
    console.log(`Email: ${email}`);
    console.log(`Password: ${process.env.BOOTSTRAP_ADMIN_PASSWORD ? "*****" : "admin123"}`);
  }
}

// CheckAndSeedAdmin is called in run()

