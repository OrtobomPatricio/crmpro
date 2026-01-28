import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router, adminProcedure, permissionProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { leads, whatsappNumbers, campaigns, campaignRecipients, messages, activityLogs, users, integrations, appointments, appointmentReasons, conversations, chatMessages, whatsappNumbers as wn, whatsappConnections, appSettings, workflows, reminderTemplates, pipelines, pipelineStages, customFieldDefinitions, templates, accessLogs, sessions, goals, achievements, internalMessages } from "../drizzle/schema";

// ...


import { assertSafeOutboundUrl } from "./_core/urlSafety";
import { encryptSecret, decryptSecret, maskSecret } from "./_core/crypto";
import { sendCloudMessage } from "./whatsapp/cloud";
import { dispatchIntegrationEvent } from "./_core/integrationDispatch";
import { eq, desc, sql, and, count, asc, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { sdk } from "./_core/sdk";
import { ONE_YEAR_MS } from "@shared/const";
import { sendEmail, verifySmtpConnection } from "./_core/email";
import { distributeConversation } from "./services/distribution";
import { logAccess, getClientIp } from "./services/security";
import { createBackup, restoreBackup, validateBackupFile, leadsToCSV, parseCSV, importLeadsFromCSV } from "./services/backup";

export const appRouter = router({
  system: systemRouter,

  // WhatsApp Management
  whatsapp: router({
    connect: permissionProcedure("settings.manage")
      .input(z.object({
        phoneNumberId: z.string(),
        accessToken: z.string(),
        businessAccountId: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Simple validation of token could be done here by calling graph api
        // For now, just save.

        // We need a unique whatsappNumberId.
        // For now, let's just use a hash or random number if we don't have a real one from an earlier step.
        // Wait, the schema has whatsappNumberId as unique int.
        // We should probably fetch the phone number details from Graph API to get the real ID or just auto-increment if it's our internal ID?
        // The schema says `whatsappNumberId` (int) and `phoneNumberId` (string).
        // Let's assume we create a new entry.

        // Check if exists
        const existing = await db.select().from(whatsappConnections).where(eq(whatsappConnections.phoneNumberId, input.phoneNumberId)).limit(1);

        if (existing.length > 0) {
          await db.update(whatsappConnections).set({
            accessToken: input.accessToken,
            businessAccountId: input.businessAccountId,
            isConnected: true,
            updatedAt: new Date()
          }).where(eq(whatsappConnections.id, existing[0].id));
        } else {
          // Generate a pseudo-random ID for whatsappNumberId if not provided?
          // Actually, `whatsappNumberId` in `whatsappConnections` seems to match `whatsappNumbers.id` maybe?
          // Let's look at schema again... `whatsappNumberId` is int.
          // If we don't have `whatsappNumbers` entry, we might need to create one or just use a random int.
          // Let's use a simple heuristic: check max ID and increment? Or just use a random int for now.
          // Use timestamp (seconds) to minimize collisions and fit in 32-bit INT
          const randomId = Math.floor(Date.now() / 1000);

          await db.insert(whatsappConnections).values({
            whatsappNumberId: randomId,
            connectionType: "api",
            phoneNumberId: input.phoneNumberId,
            accessToken: input.accessToken,
            businessAccountId: input.businessAccountId,
            isConnected: true
          });
        }

        return { success: true };
      }),

    disconnect: permissionProcedure("settings.manage")
      .input(z.object({ phoneNumberId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { success: false };

        await db.update(whatsappConnections)
          .set({ isConnected: false, accessToken: null })
          .where(eq(whatsappConnections.phoneNumberId, input.phoneNumberId));

        return { success: true };
      }),

    getStatus: permissionProcedure("settings.view")
      .query(async () => {
        const db = await getDb();
        if (!db) return [];
        return await db.select().from(whatsappConnections);
      })
  }),

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    markTourSeen: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db || !ctx.user) return { success: false };

      await db.update(users)
        .set({ hasSeenTour: true })
        .where(eq(users.id, ctx.user.id));

      return { success: true };
      return { success: true };
    }),

    loginWithCredentials: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { success: false, error: "Database not available" };

        const user = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
        if (!user[0] || !user[0].password) {
          return { success: false, error: "Invalid credentials" };
        }

        const valid = await bcrypt.compare(input.password, user[0].password);
        if (!valid) {
          return { success: false, error: "Invalid credentials" };
        }

        const sessionToken = await sdk.createSessionToken(user[0].openId, {
          name: user[0].name || "",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user[0].id));

        return { success: true };
      }),

    acceptInvitation: publicProcedure
      .input(z.object({ token: z.string(), password: z.string().min(6) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const user = await db.select().from(users).where(eq(users.invitationToken, input.token)).limit(1);
        if (!user[0]) throw new Error("Invalid token");

        if (user[0].invitationExpires && new Date() > user[0].invitationExpires) {
          throw new Error("Token expired");
        }

        const hashedPassword = await bcrypt.hash(input.password, 10);

        await db.update(users)
          .set({
            password: hashedPassword,
            invitationToken: null,
            invitationExpires: null,
            isActive: true,
            loginMethod: 'credentials'
          })
          .where(eq(users.id, user[0].id));

        return { success: true };
      }),
  }),

  // --- Pro Settings / Team / RBAC ---
  settings: router({
    /**
     * Settings panel (only admin/owner or with settings.view)
     */
    get: permissionProcedure("settings.view").query(async () => {
      const db = await getDb();
      if (!db) return null;

      const rows = await db.select().from(appSettings).limit(1);
      if (rows.length === 0) {
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
            agent: ["dashboard.view", "leads.*", "kanban.*", "chat.*", "scheduling.*"],
            viewer: ["dashboard.view", "leads.view", "kanban.view", "analytics.view", "reports.view"],
          },
          scheduling: { slotMinutes: 15, maxPerSlot: 6, allowCustomTime: true },
        });
        const seeded = await db.select().from(appSettings).limit(1);
        return seeded[0] ?? null;
      }

      return rows[0] ?? null;
    }),

    updateGeneral: permissionProcedure("settings.manage")
      .input(
        z.object({
          companyName: z.string().min(1).max(120).optional(),
          logoUrl: z.string().url().optional().nullable(),
          timezone: z.string().min(1).max(60).optional(),
          language: z.string().min(2).max(10).optional(),
          currency: z.string().min(1).max(10).optional(),
          scheduling: z
            .object({
              slotMinutes: z.number().min(5).max(120),
              maxPerSlot: z.number().min(1).max(20),
              allowCustomTime: z.boolean(),
            })
            .optional(),
          chatDistributionConfig: z
            .object({
              mode: z.enum(["manual", "round_robin", "all_agents"]),
              excludeAgentIds: z.array(z.number()),
            })
            .optional(),
          slaConfig: z
            .object({
              maxResponseTimeMinutes: z.number().min(5),
              alertEmail: z.string().email().optional().or(z.literal("")),
              notifySupervisor: z.boolean(),
            })
            .optional(),
          salesConfig: z
            .object({
              defaultCommissionRate: z.number().min(0).max(1),
              currencySymbol: z.string().min(1).max(5),
              requireValueOnWon: z.boolean(),
            })
            .optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const existing = await db.select().from(appSettings).limit(1);
        if (existing.length === 0) {
          await db.insert(appSettings).values({
            companyName: input.companyName ?? "Imagine Lab CRM",
            logoUrl: input.logoUrl ?? null,
            timezone: input.timezone ?? "America/Asuncion",
            language: input.language ?? "es",
            currency: input.currency ?? "PYG",
            permissionsMatrix: undefined,
            scheduling: input.scheduling ?? { slotMinutes: 15, maxPerSlot: 6, allowCustomTime: true },
            slaConfig: input.slaConfig,
            chatDistributionConfig: input.chatDistributionConfig,
            salesConfig: input.salesConfig,
          });
        } else {
          await db.update(appSettings).set({
            ...(input.companyName ? { companyName: input.companyName } : {}),
            ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
            ...(input.timezone ? { timezone: input.timezone } : {}),
            ...(input.language ? { language: input.language } : {}),
            ...(input.currency ? { currency: input.currency } : {}),
            ...(input.scheduling ? { scheduling: input.scheduling } : {}),
            ...(input.slaConfig ? { slaConfig: input.slaConfig } : {}),
            ...(input.chatDistributionConfig ? { chatDistributionConfig: input.chatDistributionConfig } : {}),
            ...(input.salesConfig ? { salesConfig: input.salesConfig } : {}),
          });
        }

        return { success: true } as const;
      }),

    updatePermissionsMatrix: adminProcedure
      .input(z.object({ permissionsMatrix: z.record(z.string(), z.array(z.string())) }))
      .mutation(async ({ input, ctx }) => {
        if ((ctx.user as any).role !== "owner") {
          throw new Error("Only owner can change permissions");
        }
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const existing = await db.select().from(appSettings).limit(1);
        if (existing.length === 0) {
          await db.insert(appSettings).values({ permissionsMatrix: input.permissionsMatrix as any });
        } else {
          await db.update(appSettings).set({ permissionsMatrix: input.permissionsMatrix as any });
        }
        return { success: true } as const;
      }),

    updateDashboardConfig: permissionProcedure("settings.manage")
      .input(z.record(z.string(), z.boolean()))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const existing = await db.select().from(appSettings).limit(1);
        if (existing.length === 0) {
          await db.insert(appSettings).values({ dashboardConfig: input });
        } else {
          // Merge with existing config
          const current = (existing[0].dashboardConfig as Record<string, any>) || {};
          await db.update(appSettings).set({ dashboardConfig: { ...current, ...input } });
        }
        return { success: true };
      }),

    updateDashboardLayout: permissionProcedure("settings.manage")
      .input(z.object({ layout: z.array(z.any()) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const existing = await db.select().from(appSettings).limit(1);

        if (existing.length === 0) {
          await db.insert(appSettings).values({ dashboardConfig: { layout: input.layout } });
        } else {
          const current = (existing[0].dashboardConfig as Record<string, any>) || {};
          await db.update(appSettings).set({
            dashboardConfig: { ...current, layout: input.layout }
          });
        }
        return { success: true };
      }),

    updateSmtpConfig: permissionProcedure("settings.manage")
      .input(z.object({
        host: z.string(),
        port: z.number(),
        secure: z.boolean(),
        user: z.string(),
        pass: z.string(),
        from: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const existing = await db.select().from(appSettings).limit(1);
        if (existing.length === 0) {
          await db.insert(appSettings).values({ smtpConfig: input });
        } else {
          await db.update(appSettings).set({ smtpConfig: input });
        }
        return { success: true };
      }),

    verifySmtpTest: permissionProcedure("settings.manage")
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const sent = await sendEmail({
          to: input.email,
          subject: "Test SMTP Connection - Imagine CRM",
          html: "<p>If you see this, your SMTP configuration is working correctly! 🚀</p>",
        });
        if (!sent) throw new Error("Failed to send email. Check server logs.");
        return { success: true };
      }),

    updateStorageConfig: permissionProcedure("settings.manage")
      .input(z.object({
        provider: z.enum(["forge", "s3"]),
        bucket: z.string().optional(),
        region: z.string().optional(),
        accessKey: z.string().optional(),
        secretKey: z.string().optional(),
        endpoint: z.string().optional(),
        publicUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const existing = await db.select().from(appSettings).limit(1);
        if (!existing[0]) {
          await db.insert(appSettings).values({ storageConfig: input });
        } else {
          await db.update(appSettings).set({ storageConfig: input });
        }
        return { success: true };
      }),

    updateAiConfig: permissionProcedure("settings.manage")
      .input(z.object({
        provider: z.enum(["openai", "anthropic"]),
        apiKey: z.string().min(1),
        model: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const existing = await db.select().from(appSettings).limit(1);
        // In a real app we might encrypt the apiKey
        if (!existing[0]) {
          await db.insert(appSettings).values({ aiConfig: input });
        } else {
          await db.update(appSettings).set({ aiConfig: input });
        }
        return { success: true };
      }),

    updateMapsConfig: permissionProcedure("settings.manage")
      .input(z.object({
        apiKey: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const existing = await db.select().from(appSettings).limit(1);
        if (!existing[0]) {
          await db.insert(appSettings).values({ mapsConfig: input });
        } else {
          await db.update(appSettings).set({ mapsConfig: input });
        }
        return { success: true };
      }),

    getScheduling: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { slotMinutes: 15, maxPerSlot: 6, allowCustomTime: true };
      const rows = await db.select().from(appSettings).limit(1);
      return (rows[0] as any)?.scheduling ?? { slotMinutes: 15, maxPerSlot: 6, allowCustomTime: true };
    }),

    myPermissions: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db || !ctx.user) return { role: ctx.user?.role ?? "agent", baseRole: ctx.user?.role ?? "agent", permissions: [] };
      const rows = await db.select().from(appSettings).limit(1);
      const matrix = (rows[0] as any)?.permissionsMatrix ?? {};
      const baseRole = (ctx.user as any).role ?? "agent";
      const customRole = (ctx.user as any).customRole as string | undefined;
      const role = baseRole === "owner" ? "owner" : (customRole || baseRole);
      return { role, baseRole, permissions: role === "owner" ? ["*"] : (matrix[role] ?? []) };
    }),
  }),

  // Team management
  team: router({
    listUsers: permissionProcedure("users.view").query(async () => {
      const db = await getDb();
      if (!db) return [];

      return db.select({
        id: users.id,
        openId: users.openId,
        name: users.name,
        email: users.email,
        role: users.role,
        customRole: users.customRole,
        isActive: users.isActive,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
      }).from(users).orderBy(desc(users.createdAt));
    }),

    updateRole: permissionProcedure("users.manage")
      .input(z.object({ userId: z.number(), role: z.enum(["owner", "admin", "supervisor", "agent", "viewer"]) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Only owner can assign owner role
        if (input.role === "owner" && (ctx.user as any).role !== "owner") {
          throw new Error("Only owner can assign owner");
        }

        // Nobody can downgrade owner except owner itself
        const target = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
        if (target[0]?.role === "owner" && (ctx.user as any).role !== "owner") {
          throw new Error("Only owner can change another owner");
        }

        await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
        return { success: true } as const;
      }),

    updateCustomRole: permissionProcedure("users.manage")
      .input(z.object({ userId: z.number(), customRole: z.string().max(64).optional().nullable() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Protect owner (only owner can change another owner)
        const target = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
        if (target[0]?.role === "owner" && (ctx.user as any).role !== "owner") {
          throw new Error("Only owner can change another owner");
        }

        const value = input.customRole ? input.customRole.trim() : null;
        await db.update(users).set({ customRole: value }).where(eq(users.id, input.userId));
        return { success: true } as const;
      }),

    setActive: permissionProcedure("users.manage")
      .input(z.object({ userId: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const target = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
        if (target[0]?.role === "owner" && (ctx.user as any).role !== "owner") {
          throw new Error("Only owner can disable owner");
        }

        await db.update(users).set({ isActive: input.isActive }).where(eq(users.id, input.userId));
        return { success: true } as const;
      }),

    create: permissionProcedure("users.manage")
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6), // Password required for manual creation
        role: z.enum(["admin", "supervisor", "agent", "viewer"]), // Owner cannot be created this way
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Check if email already exists
        const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
        if (existing.length > 0) {
          throw new Error("User with this email already exists");
        }

        const hashedPassword = await bcrypt.hash(input.password, 10);
        const openId = `local_${nanoid(16)}`; // Generate unique openId for local users

        const result = await db.insert(users).values({
          openId,
          name: input.name,
          email: input.email,
          password: hashedPassword,
          role: input.role,
          loginMethod: "credentials",
          isActive: true,
          hasSeenTour: false,
        });

        return { id: result[0].insertId, success: true };
      }),

    invite: permissionProcedure("users.manage")
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        role: z.enum(["admin", "supervisor", "agent", "viewer"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
        if (existing.length > 0) {
          throw new Error("User already exists");
        }

        const token = nanoid(32);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const openId = `invite_${nanoid(16)}`;

        await db.insert(users).values({
          openId,
          name: input.name,
          email: input.email,
          role: input.role,
          isActive: true,
          invitationToken: token,
          invitationExpires: expiresAt,
          loginMethod: "credentials",
        });

        const baseUrl = process.env.VITE_API_URL || "http://localhost:3000";
        const inviteLink = `${baseUrl}/setup-account?token=${token}`;

        await sendEmail({
          to: input.email,
          subject: "Welcome to Imagine CRM - Setup your account",
          html: `
            <h3>Hello ${input.name}!</h3>
            <p>You have been invited to join Imagine CRM as a <strong>${input.role}</strong>.</p>
            <p>Click the link below to set your password and access the system:</p>
            <a href="${inviteLink}">${inviteLink}</a>
            <p>This link expires in 24 hours.</p>
          `,
        });

        return { success: true };
      }),
  }),

  // Dashboard router
  dashboard: router({
    getStats: permissionProcedure("dashboard.view").query(async () => {
      const db = await getDb();
      if (!db) {
        return {
          totalLeads: 0,
          totalNumbers: 0,
          activeNumbers: 0,
          warmingUpNumbers: 0,
          blockedNumbers: 0,
          messagesToday: 0,
          conversionRate: 0,
          warmupNumbers: [],
          countriesDistribution: [],
          recentLeads: [],
        };
      }

      // Get lead counts
      const leadCount = await db.select({ count: count() }).from(leads);
      const totalLeads = leadCount[0]?.count ?? 0;

      // Get number stats
      const numberStats = await db.select({
        status: whatsappNumbers.status,
        count: count(),
      }).from(whatsappNumbers).groupBy(whatsappNumbers.status);

      const totalNumbers = numberStats.reduce((acc, s) => acc + s.count, 0);
      const activeNumbers = numberStats.find(s => s.status === 'active')?.count ?? 0;
      const warmingUpNumbers = numberStats.find(s => s.status === 'warming_up')?.count ?? 0;
      const blockedNumbers = numberStats.find(s => s.status === 'blocked')?.count ?? 0;

      // Get messages sent today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const messagesTodayResult = await db.select({
        total: sql<number>`SUM(${whatsappNumbers.messagesSentToday})`,
      }).from(whatsappNumbers);
      const messagesToday = messagesTodayResult[0]?.total ?? 0;

      // Get conversion rate
      const wonLeads = await db.select({ count: count() })
        .from(leads)
        .where(eq(leads.status, 'won'));
      const conversionRate = totalLeads > 0
        ? Math.round((wonLeads[0]?.count ?? 0) / totalLeads * 100)
        : 0;

      // Get warmup numbers
      const warmupNumbers = await db.select()
        .from(whatsappNumbers)
        .where(eq(whatsappNumbers.status, 'warming_up'))
        .orderBy(desc(whatsappNumbers.warmupDay))
        .limit(5);

      // Get countries distribution
      const countriesDistribution = await db.select({
        country: whatsappNumbers.country,
        count: count(),
      }).from(whatsappNumbers).groupBy(whatsappNumbers.country);

      // Get recent leads
      const recentLeads = await db.select()
        .from(leads)
        .orderBy(desc(leads.createdAt))
        .limit(5);

      return {
        totalLeads,
        totalNumbers,
        activeNumbers,
        warmingUpNumbers,
        blockedNumbers,
        messagesToday,
        conversionRate,
        warmupNumbers,
        countriesDistribution,
        recentLeads,
      };
    }),
  }),

  pipelines: router({
    list: permissionProcedure("kanban.view").query(async () => {
      const db = await getDb();
      if (!db) return [];

      let allPipelines = await db.select().from(pipelines);

      // Auto-create default pipeline if none exists
      if (allPipelines.length === 0) {
        const result = await db.insert(pipelines).values({
          name: "Pipeline por defecto",
          isDefault: true,
        });
        const pipelineId = result[0].insertId;

        // Default stages mapping old statuses
        const defaults = [
          { name: "Nuevo", color: "#dbeafe", type: "open", order: 0 },       // blue-100
          { name: "Contactado", color: "#fef9c3", type: "open", order: 1 },  // yellow-100
          { name: "Calificado", color: "#f3e8ff", type: "open", order: 2 },  // purple-100
          { name: "Negociación", color: "#e0e7ff", type: "open", order: 3 }, // indigo-100
          { name: "Ganado", color: "#dcfce7", type: "won", order: 4 },       // green-100
          { name: "Perdido", color: "#fee2e2", type: "lost", order: 5 },     // red-100
        ];

        for (const s of defaults) {
          await db.insert(pipelineStages).values({
            pipelineId,
            name: s.name,
            color: s.color,
            type: s.type as any,
            order: s.order,
          });
        }

        allPipelines = await db.select().from(pipelines);
      }

      const allStages = await db.select().from(pipelineStages).orderBy(asc(pipelineStages.order));

      return allPipelines.map(p => ({
        ...p,
        stages: allStages.filter(s => s.pipelineId === p.id)
      }));
    }),

    create: permissionProcedure("kanban.manage")
      .input(z.object({ name: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db.insert(pipelines).values({ name: input.name });
        const pipelineId = result[0].insertId;

        // Add default stages for new pipelines too? Or empty? Let's add standard ones
        const defaults = [
          { name: "Nuevo", color: "#e2e8f0", order: 0 },
          { name: "En Proceso", color: "#fef9c3", order: 1 },
          { name: "Ganado", color: "#dcfce7", type: "won", order: 2 },
          { name: "Perdido", color: "#fee2e2", type: "lost", order: 3 },
        ];

        for (const s of defaults) {
          await db.insert(pipelineStages).values({
            pipelineId,
            name: s.name,
            color: s.color,
            type: (s.type as any) || "open",
            order: s.order,
          });
        }

        return { success: true, id: pipelineId };
      }),

    updateStage: permissionProcedure("kanban.manage")
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        color: z.string().optional(),
        order: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB error");
        await db.update(pipelineStages).set(input).where(eq(pipelineStages.id, input.id));
        return { success: true };
      }),
  }),

  customFields: router({
    list: permissionProcedure("leads.view").query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(customFieldDefinitions).orderBy(asc(customFieldDefinitions.order));
    }),

    create: permissionProcedure("settings.manage")
      .input(z.object({
        name: z.string().min(1),
        type: z.enum(["text", "number", "date", "select", "checkbox"]),
        options: z.array(z.string()).optional(),
        entityType: z.enum(["lead", "contact", "company"]).default("lead"),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.insert(customFieldDefinitions).values(input);
        return { success: true };
      }),
  }),

  // Templates Router
  templates: router({
    list: permissionProcedure("campaigns.view").query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(templates).orderBy(desc(templates.createdAt));
    }),

    create: permissionProcedure("campaigns.manage")
      .input(z.object({
        name: z.string().min(1),
        content: z.string().min(1),
        type: z.enum(["whatsapp", "email"]),
        variables: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.insert(templates).values(input);
        return { success: true };
      }),

    update: permissionProcedure("campaigns.manage")
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        content: z.string().optional(),
        variables: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.update(templates).set(input).where(eq(templates.id, input.id));
        return { success: true };
      }),

    delete: permissionProcedure("campaigns.manage")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB error");
        await db.delete(templates).where(eq(templates.id, input.id));
        return { success: true };
      }),
  }),

  // Campaigns Router
  campaigns: router({
    list: permissionProcedure("campaigns.view").query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
    }),

    create: permissionProcedure("campaigns.manage")
      .input(z.object({
        name: z.string().min(1),
        type: z.enum(["whatsapp", "email"]),
        templateId: z.number().optional(),
        message: z.string(), // Fallback or override
        audienceConfig: z.any().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const result = await db.insert(campaigns).values({
          ...input,
          status: "draft",
        });
        return { success: true, id: result[0].insertId };
      }),

    calculateAudience: permissionProcedure("campaigns.manage")
      .input(z.object({
        pipelineStageId: z.number().optional(),
        tags: z.array(z.string()).optional(),
        // Add more filters as needed
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { count: 0 };

        // Simple filter by stage for now
        const conditions = [];
        if (input.pipelineStageId) {
          conditions.push(eq(leads.pipelineStageId, input.pipelineStageId));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const countResult = await db.select({ count: count() }).from(leads).where(whereClause);
        return { count: countResult[0]?.count ?? 0 };
      }),

    launch: permissionProcedure("campaigns.manage")
      .input(z.object({ campaignId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB error");

        const campaign = await db.select().from(campaigns).where(eq(campaigns.id, input.campaignId)).limit(1);
        if (!campaign[0]) throw new Error("Campaign not found");

        const config = campaign[0].audienceConfig as any;

        // Fetch audience
        const conditions = [];
        if (config?.pipelineStageId) {
          conditions.push(eq(leads.pipelineStageId, config.pipelineStageId));
        }
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const audience = await db.select().from(leads).where(whereClause);

        // Create recipients
        for (const lead of audience) {
          await db.insert(campaignRecipients).values({
            campaignId: input.campaignId,
            leadId: lead.id,
            status: "pending",
          });
        }

        await db.update(campaigns).set({
          status: "scheduled", // Or running immediately
          totalRecipients: audience.length,
          startedAt: new Date(),
        }).where(eq(campaigns.id, input.campaignId));

        // TODO: Trigger actual sending process (Queue/Worker)

        return { success: true, recipientsCount: audience.length };
      }),

    getById: permissionProcedure("campaigns.view")
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        const result = await db.select()
          .from(campaigns)
          .where(eq(campaigns.id, input.id))
          .limit(1);

        return result[0] ?? null;
      }),

    delete: permissionProcedure("campaigns.manage")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.delete(campaigns).where(eq(campaigns.id, input.id));
        return { success: true };
      }),
  }),

  // Leads router
  leads: router({
    search: protectedProcedure
      .input(z.object({
        query: z.string().min(1),
        limit: z.number().default(10)
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        const term = `%${input.query}%`;
        return db.select({
          id: leads.id,
          name: leads.name,
          phone: leads.phone,
          email: leads.email
        })
          .from(leads)
          .where(sql`(${leads.name} LIKE ${term} OR ${leads.phone} LIKE ${term})`)
          .limit(input.limit);
      }),

    list: permissionProcedure("leads.view")
      .input(z.object({
        pipelineStageId: z.number().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        let query = db.select().from(leads);

        if (input?.pipelineStageId) {
          query = query.where(eq(leads.pipelineStageId, input.pipelineStageId)) as typeof query;
        }

        return query
          .orderBy(desc(leads.createdAt))
          .limit(input?.limit ?? 50)
          .offset(input?.offset ?? 0);
      }),

    getById: permissionProcedure("leads.view")
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        const result = await db.select()
          .from(leads)
          .where(eq(leads.id, input.id))
          .limit(1);

        return result[0] ?? null;
      }),

    create: permissionProcedure("leads.create")
      .input(z.object({
        name: z.string().min(1),
        phone: z.string().min(1),
        email: z.string().email().optional(),
        country: z.string().min(1),
        source: z.string().optional(),
        notes: z.string().optional(),
        pipelineStageId: z.number().optional(),
        customFields: z.record(z.string(), z.any()).optional(),
        value: z.number().optional(), // Deal value
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Resolve pipeline stage (fallback to default pipeline's first stage)
        let stageId: number | null = (input.pipelineStageId as any) ?? null;
        if (!stageId) {
          const p = await db.select().from(pipelines).where(eq(pipelines.isDefault, true)).limit(1);
          const pipeline = p[0];
          if (pipeline) {
            const s = await db.select().from(pipelineStages).where(eq(pipelineStages.pipelineId, pipeline.id)).orderBy(asc(pipelineStages.order)).limit(1);
            stageId = s[0]?.id ?? null;
          }
        }

        // Determine next Kanban order in that stage
        let nextOrder = 0;
        if (stageId) {
          const maxRows = await db.select({ max: sql<number>`max(${leads.kanbanOrder})` }).from(leads).where(eq(leads.pipelineStageId, stageId));
          nextOrder = ((maxRows[0] as any)?.max ?? 0) + 1;
        }

        // Default WhatsApp number to associate integrations/webhooks & future conversations
        const defaultNumber = await db.select({ id: whatsappNumbers.id }).from(whatsappNumbers).limit(1);
        const defaultWhatsappNumberId = defaultNumber[0]?.id ?? null;

        // Calculate commission
        const commission = input.country.toLowerCase() === 'panamá' || input.country.toLowerCase() === 'panama'
          ? '10000.00'
          : '5000.00';

        const result = await db.insert(leads).values({
          ...input,
          value: input.value ? input.value.toString() : "0.00",
          commission,
          assignedToId: ctx.user?.id,
          whatsappNumberId: defaultWhatsappNumberId as any,
          pipelineStageId: stageId as any,
          kanbanOrder: nextOrder as any,
        });

        const newLeadId = result[0].insertId;

        if (defaultWhatsappNumberId) {
          void dispatchIntegrationEvent({
            whatsappNumberId: defaultWhatsappNumberId,
            event: "lead_created",
            data: { id: newLeadId, ...input, assignedToId: ctx.user?.id },
          });
        }

        return { id: newLeadId, success: true };
      }),

    update: permissionProcedure("leads.update")
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        phone: z.string().min(1).optional(),
        email: z.string().email().optional().nullable(),
        country: z.string().min(1).optional(),
        source: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        pipelineStageId: z.number().optional(),
        customFields: z.record(z.string(), z.any()).optional(),
        value: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { id, ...data } = input;

        // If stage is changed via update, move it to the end of that stage by default
        if (data.pipelineStageId) {
          const maxRows = await db.select({ max: sql<number>`max(${leads.kanbanOrder})` }).from(leads).where(eq(leads.pipelineStageId, data.pipelineStageId));
          const nextOrder = ((maxRows[0] as any)?.max ?? 0) + 1;
          (data as any).kanbanOrder = nextOrder;
        }

        if (data.country) {
          (data as Record<string, unknown>).commission = data.country.toLowerCase() === 'panamá' || data.country.toLowerCase() === 'panama'
            ? '10000.00'
            : '5000.00';
        }

        if (data.value !== undefined) {
          (data as any).value = data.value.toString();
        }

        await db.update(leads)
          .set(data as any)
          .where(eq(leads.id, id));

        // Fire integration webhook (best-effort)
        const updated = await db.select({ whatsappNumberId: leads.whatsappNumberId }).from(leads).where(eq(leads.id, id)).limit(1);
        const waId = updated[0]?.whatsappNumberId as number | null | undefined;
        if (waId) {
          void dispatchIntegrationEvent({
            whatsappNumberId: waId,
            event: "lead_updated",
            data: { id, ...data, updatedById: ctx.user?.id },
          });
        }

        return { success: true };
      }),

    updateStatus: permissionProcedure("leads.update")
      .input(z.object({
        id: z.number(),
        // Support both for backward compatibility or refactor
        pipelineStageId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Move to end of stage by default
        const maxRows = await db.select({ max: sql<number>`max(${leads.kanbanOrder})` }).from(leads).where(eq(leads.pipelineStageId, input.pipelineStageId));
        const nextOrder = ((maxRows[0] as any)?.max ?? 0) + 1;

        await db.update(leads)
          .set({ pipelineStageId: input.pipelineStageId, kanbanOrder: nextOrder } as any)
          .where(eq(leads.id, input.id));

        const updated = await db.select({ whatsappNumberId: leads.whatsappNumberId }).from(leads).where(eq(leads.id, input.id)).limit(1);
        const whatsappNumberId = updated[0]?.whatsappNumberId;
        if (whatsappNumberId) {
          void dispatchIntegrationEvent({
            whatsappNumberId,
            event: "lead_updated",
            data: { id: input.id, pipelineStageId: input.pipelineStageId },
          });
        }

        return { success: true };
      }),

    reorderKanban: permissionProcedure("kanban.update")
      .input(z.object({
        pipelineStageId: z.number(),
        orderedLeadIds: z.array(z.number()).min(0),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const ids = (input.orderedLeadIds ?? []).filter(Boolean);
        if (ids.length === 0) return { success: true, updated: 0 } as const;

        // Build CASE expression to assign 1..n order
        const caseExpr = sql`CASE ${leads.id} ${sql.join(ids.map((id, idx) => sql`WHEN ${id} THEN ${idx + 1}`), sql` `)} END`;

        await db.update(leads)
          .set({ pipelineStageId: input.pipelineStageId, kanbanOrder: caseExpr } as any)
          .where(inArray(leads.id, ids));

        return { success: true, updated: ids.length } as const;
      }),

    delete: permissionProcedure("leads.delete")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.delete(leads).where(eq(leads.id, input.id));
        return { success: true };
      }),

    getByPipeline: permissionProcedure("leads.view")
      .input(z.object({ pipelineId: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return {};

        // 1. Get Pipeline (or default)
        let pipeline = null;
        if (input.pipelineId) {
          const p = await db.select().from(pipelines).where(eq(pipelines.id, input.pipelineId)).limit(1);
          pipeline = p[0];
        } else {
          const p = await db.select().from(pipelines).where(eq(pipelines.isDefault, true)).limit(1);
          if (p[0]) pipeline = p[0];
        }

        if (!pipeline) return {}; // valid case if no pipelines yet (though list creates one)

        // 2. Get Stages
        const stages = await db.select().from(pipelineStages).where(eq(pipelineStages.pipelineId, pipeline.id)).orderBy(asc(pipelineStages.order));

        // 3. Get All Leads (optimization: filter by stages if possible)
        // Since leads might have null stage, we fetch all? Or ideally fetch all and filter in memory for migration check.
        // For performance, we should filtering by stageId IN (stages.ids) OR stageId IS NULL.
        const allLeads = await db.select().from(leads);

        const result: Record<string, typeof leads.$inferSelect[]> = {};
        stages.forEach(s => result[s.id] = []);

        const updates: Promise<any>[] = [];

        for (const lead of allLeads) {
          // If lead belongs to one of the stages, add it
          if (lead.pipelineStageId) {
            if (result[lead.pipelineStageId]) {
              result[lead.pipelineStageId].push(lead);
            }
            // if lead has stage ID but not in this pipeline, we skip it (it belongs to another pipeline)
          } else {
            // Migration logic: Map old status to new stage
            // We need to map 'new' -> 1st stage, 'contacted' -> 2nd, etc. 
            // We configured default map in pipelines.list
            // "New", "Contacted", "Qualified", "Negotiation", "Won", "Lost"
            // names match STATUSES keys roughly.
            let targetStageName = "";
            switch (lead.status) {
              case 'new': targetStageName = "Nuevo"; break;
              case 'contacted': targetStageName = "Contactado"; break;
              case 'qualified': targetStageName = "Calificado"; break;
              case 'negotiation': targetStageName = "Negociación"; break;
              case 'won': targetStageName = "Ganado"; break;
              case 'lost': targetStageName = "Perdido"; break;
              default: targetStageName = "Nuevo";
            }

            const mapped = stages.find(s => s.name === targetStageName) || stages[0];
            if (mapped) {
              // Add to updating queue
              updates.push(db.update(leads).set({ pipelineStageId: mapped.id, kanbanOrder: lead.id } as any).where(eq(leads.id, lead.id)));
              // Add to result
              result[mapped.id].push({ ...lead, pipelineStageId: mapped.id, kanbanOrder: (lead as any).kanbanOrder ?? lead.id } as any);
            }
          }
        }

        // Execute migration updates in background (or await if critical)
        if (updates.length > 0) await Promise.all(updates);

        // Sort each stage by kanbanOrder (fallback createdAt)
        for (const s of stages) {
          const arr = result[s.id] ?? [];
          arr.sort((a: any, b: any) => {
            const ao = Number(a.kanbanOrder ?? 0);
            const bo = Number(b.kanbanOrder ?? 0);
            if (ao !== bo) return ao - bo;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        }

        return result;
      }),
  }),

  // WhatsApp Numbers router
  whatsappNumbers: router({
    list: permissionProcedure("monitoring.view").query(async () => {
      const db = await getDb();
      if (!db) return [];

      return db.select()
        .from(whatsappNumbers)
        .orderBy(desc(whatsappNumbers.createdAt));
    }),

    getById: permissionProcedure("monitoring.view")
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        const result = await db.select({
          number: whatsappNumbers,
          connection: whatsappConnections,
        })
          .from(whatsappNumbers)
          .leftJoin(whatsappConnections, eq(whatsappNumbers.id, whatsappConnections.whatsappNumberId))
          .where(eq(whatsappNumbers.id, input.id))
          .limit(1);

        const row = result[0];
        if (!row) return null;

        return {
          ...row.number,
          accessToken: row.connection?.accessToken ? maskSecret(row.connection.accessToken) : null,
          hasAccessToken: Boolean(row.connection?.accessToken),
        } as any;
      }),

    create: permissionProcedure("monitoring.manage")
      .input(z.object({
        phoneNumber: z.string().min(1),
        displayName: z.string().optional(),
        country: z.string().min(1),
        countryCode: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db.insert(whatsappNumbers).values({
          ...input,
          status: 'warming_up',
          warmupDay: 0,
          warmupStartDate: new Date(),
          dailyMessageLimit: 20,
        });

        return { id: result[0].insertId, success: true };
      }),

    updateStatus: permissionProcedure("monitoring.manage")
      .input(z.object({
        id: z.number(),
        status: z.enum(['active', 'warming_up', 'blocked', 'disconnected']),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.update(whatsappNumbers)
          .set({ status: input.status })
          .where(eq(whatsappNumbers.id, input.id));

        return { success: true };
      }),

    updateConnection: permissionProcedure("monitoring.manage")
      .input(z.object({
        id: z.number(),
        isConnected: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.update(whatsappNumbers)
          .set({
            isConnected: input.isConnected,
            lastConnected: input.isConnected ? new Date() : undefined,
          })
          .where(eq(whatsappNumbers.id, input.id));

        return { success: true };
      }),

    delete: permissionProcedure("monitoring.manage")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.delete(whatsappNumbers).where(eq(whatsappNumbers.id, input.id));
        return { success: true };
      }),

    getStats: permissionProcedure("monitoring.view").query(async () => {
      const db = await getDb();
      if (!db) return {
        total: 0,
        byStatus: [],
        byCountry: [],
      };

      const total = await db.select({ count: count() }).from(whatsappNumbers);

      const byStatus = await db.select({
        status: whatsappNumbers.status,
        count: count(),
      }).from(whatsappNumbers).groupBy(whatsappNumbers.status);

      const byCountry = await db.select({
        country: whatsappNumbers.country,
        count: count(),
      }).from(whatsappNumbers).groupBy(whatsappNumbers.country);

      return {
        total: total[0]?.count ?? 0,
        byStatus,
        byCountry,
      };
    }),

    updateCredentials: permissionProcedure("monitoring.manage")
      .input(z.object({
        id: z.number(),
        phoneNumberId: z.string().min(1),
        businessAccountId: z.string().min(1),
        accessToken: z.string().min(1).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Check if connection exists
        const existing = await db.select()
          .from(whatsappConnections)
          .where(eq(whatsappConnections.whatsappNumberId, input.id))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(whatsappConnections).values({
            whatsappNumberId: input.id,
            connectionType: 'api',
            phoneNumberId: input.phoneNumberId,
            businessAccountId: input.businessAccountId,
            accessToken: input.accessToken ? encryptSecret(input.accessToken) : null,
            isConnected: true,
            lastPingAt: new Date(),
          });
        } else {
          await db.update(whatsappConnections)
            .set({
              phoneNumberId: input.phoneNumberId,
              businessAccountId: input.businessAccountId,
              ...(input.accessToken ? { accessToken: encryptSecret(input.accessToken) } : {}),
              isConnected: true,
              lastPingAt: new Date(),
            })
            .where(eq(whatsappConnections.whatsappNumberId, input.id));
        }

        // Also update number status to active if it was warming_up
        await db.update(whatsappNumbers)
          .set({ isConnected: true })
          .where(eq(whatsappNumbers.id, input.id));

        return { success: true };
      }),
  }),

  // Campaigns router


  // Integrations router
  integrations: router({
    list: permissionProcedure("integrations.view").query(async () => {
      const db = await getDb();
      if (!db) return [];

      return db.select()
        .from(integrations)
        .orderBy(desc(integrations.createdAt));
    }),

    getById: permissionProcedure("integrations.view")
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        const result = await db.select()
          .from(integrations)
          .where(eq(integrations.id, input.id))
          .limit(1);

        return result[0] ?? null;
      }),

    create: permissionProcedure("integrations.manage")
      .input(z.object({
        name: z.string().min(1),
        type: z.enum(['n8n', 'chatwoot', 'zapier', 'webhook']),
        webhookUrl: z.string().url(),
        whatsappNumberId: z.number(),
        events: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await assertSafeOutboundUrl(input.webhookUrl);

        const result = await db.insert(integrations).values({
          ...input,
          events: input.events ?? ['message_received', 'lead_created', 'lead_updated', 'campaign_sent'],
          createdById: ctx.user?.id,
          isActive: true,
        });

        return { id: result[0].insertId, success: true };
      }),

    update: permissionProcedure("integrations.manage")
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        webhookUrl: z.string().url().optional(),
        whatsappNumberId: z.number().optional(),
        isActive: z.boolean().optional(),
        events: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        if (input.webhookUrl) {
          await assertSafeOutboundUrl(input.webhookUrl);
        }

        const { id, ...updateData } = input;
        await db.update(integrations)
          .set(updateData)
          .where(eq(integrations.id, id));

        return { success: true };
      }),

    delete: permissionProcedure("integrations.manage")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.delete(integrations).where(eq(integrations.id, input.id));
        return { success: true };
      }),

    toggle: permissionProcedure("integrations.manage")
      .input(z.object({
        id: z.number(),
        isActive: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.update(integrations)
          .set({ isActive: input.isActive })
          .where(eq(integrations.id, input.id));

        return { success: true };
      }),

    testWebhook: permissionProcedure("integrations.manage")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const integration = await db.select()
          .from(integrations)
          .where(eq(integrations.id, input.id))
          .limit(1);

        if (!integration[0]) throw new Error("Integration not found");

        await assertSafeOutboundUrl(integration[0].webhookUrl);

        // Test webhook by sending a test payload
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);

          const response = await fetch(integration[0].webhookUrl, {
            method: 'POST',
            redirect: 'error',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              event: 'test',
              timestamp: new Date().toISOString(),
              data: { message: 'Test from Imagine Lab CRM' },
            }),
          });

          clearTimeout(timeout);

          if (response.ok) {
            await db.update(integrations)
              .set({ lastTriggeredAt: new Date() })
              .where(eq(integrations.id, input.id));
            return { success: true, status: response.status };
          } else {
            return { success: false, status: response.status, error: 'Webhook returned error' };
          }
        } catch (error) {
          return { success: false, error: 'Failed to connect to webhook' };
        }
      }),
  }),

  // Scheduling router
  scheduling: router({
    list: permissionProcedure("scheduling.view").query(async () => {
      const db = await getDb();
      if (!db) return [];

      return db.select()
        .from(appointments)
        .orderBy(desc(appointments.appointmentDate));
    }),

    listReasons: permissionProcedure("scheduling.view").query(async () => {
      const db = await getDb();
      if (!db) return [];

      return db.select()
        .from(appointmentReasons)
        .where(eq(appointmentReasons.isActive, true))
        .orderBy(appointmentReasons.name);
    }),

    create: permissionProcedure("scheduling.manage")
      .input(z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        phone: z.string().min(1),
        email: z.string().optional(),
        reasonId: z.number().optional(),
        appointmentDate: z.string(),
        appointmentTime: z.string().min(1),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Normalize to midnight to avoid timezone drift and make equality checks consistent
        const normalizedDate = new Date(input.appointmentDate);
        normalizedDate.setHours(0, 0, 0, 0);

        // Load scheduling rules
        const settingsRows = await db.select().from(appSettings).limit(1);
        const maxPerSlot = (settingsRows[0] as any)?.scheduling?.maxPerSlot ?? 6;

        // Allow up to N appointments per exact time slot (configurable in Settings)
        const existing = await db
          .select({ count: count() })
          .from(appointments)
          .where(
            and(
              eq(appointments.appointmentDate, normalizedDate),
              eq(appointments.appointmentTime, input.appointmentTime)
            )
          );

        const existingCount = existing[0]?.count ?? 0;
        if (existingCount >= maxPerSlot) {
          throw new Error(
            `Ese horario ya está completo (máximo ${maxPerSlot} personas). Elegí otro horario.`
          );
        }

        const result = await db.insert(appointments).values({
          ...input,
          appointmentDate: normalizedDate,
          createdById: ctx.user?.id,
        });

        return { id: result[0].insertId, success: true };
      }),

    update: permissionProcedure("scheduling.manage")
      .input(z.object({
        id: z.number(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        reasonId: z.number().optional(),
        appointmentDate: z.string().optional(),
        appointmentTime: z.string().optional(),
        notes: z.string().optional(),
        status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { id, appointmentDate, ...rest } = input;
        const updateData: Record<string, unknown> = { ...rest };
        if (appointmentDate) {
          updateData.appointmentDate = new Date(appointmentDate);
        }

        await db.update(appointments)
          .set(updateData)
          .where(eq(appointments.id, id));

        return { success: true };
      }),

    delete: permissionProcedure("scheduling.manage")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.delete(appointments).where(eq(appointments.id, input.id));
        return { success: true };
      }),

    createReason: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        color: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db.insert(appointmentReasons).values(input);
        return { id: result[0].insertId, success: true };
      }),

    deleteReason: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.update(appointmentReasons)
          .set({ isActive: false })
          .where(eq(appointmentReasons.id, input.id));
        return { success: true };
      }),

    // Reminder Templates
    getTemplates: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(reminderTemplates).where(eq(reminderTemplates.isActive, true));
    }),

    saveTemplate: permissionProcedure("scheduling.manage")
      .input(z.object({
        id: z.number().optional(),
        name: z.string().min(1),
        content: z.string().min(1),
        daysBefore: z.number().min(0),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB error");
        if (input.id) {
          await db.update(reminderTemplates).set({
            name: input.name, content: input.content, daysBefore: input.daysBefore
          }).where(eq(reminderTemplates.id, input.id));
          return { success: true, id: input.id };
        } else {
          const res = await db.insert(reminderTemplates).values({
            name: input.name, content: input.content, daysBefore: input.daysBefore, isActive: true
          });
          return { success: true, id: res[0].insertId };
        }
      }),

    deleteTemplate: permissionProcedure("scheduling.manage")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB error");
        await db.delete(reminderTemplates).where(eq(reminderTemplates.id, input.id));
        return { success: true };
      }),
  }),

  // Conversations/Chat router
  chat: router({
    listConversations: permissionProcedure("chat.view")
      .input(z.object({ whatsappNumberId: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        if (input.whatsappNumberId) {
          return db.select()
            .from(conversations)
            .where(eq(conversations.whatsappNumberId, input.whatsappNumberId))
            .orderBy(desc(conversations.lastMessageAt));
        }

        return db.select()
          .from(conversations)
          .orderBy(desc(conversations.lastMessageAt));
      }),

    getMessages: permissionProcedure("chat.view")
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        return db.select()
          .from(chatMessages)
          .where(eq(chatMessages.conversationId, input.conversationId))
          .orderBy(chatMessages.createdAt);
      }),

    /**
     * Live monitoring feed for supervisors.
     * Returns the most recent messages across all conversations.
     */
    getRecentMessages: permissionProcedure("monitoring.view")
      .input(
        z.object({
          limit: z.number().min(10).max(200).default(50),
          whatsappNumberId: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        const baseQuery = db
          .select({
            id: chatMessages.id,
            conversationId: chatMessages.conversationId,
            whatsappNumberId: chatMessages.whatsappNumberId,
            direction: chatMessages.direction,
            messageType: chatMessages.messageType,
            content: chatMessages.content,
            mediaUrl: chatMessages.mediaUrl,
            status: chatMessages.status,
            createdAt: chatMessages.createdAt,
            contactPhone: conversations.contactPhone,
            contactName: conversations.contactName,
            conversationStatus: conversations.status,
            unreadCount: conversations.unreadCount,
            lastMessageAt: conversations.lastMessageAt,
          })
          .from(chatMessages)
          .innerJoin(conversations, eq(chatMessages.conversationId, conversations.id));

        const whereClause = input.whatsappNumberId
          ? eq(chatMessages.whatsappNumberId, input.whatsappNumberId)
          : undefined;

        const rows = whereClause
          ? await baseQuery
            .where(whereClause)
            .orderBy(desc(chatMessages.createdAt))
            .limit(input.limit)
          : await baseQuery
            .orderBy(desc(chatMessages.createdAt))
            .limit(input.limit);

        return rows;
      }),

    markAsRead: permissionProcedure("chat.view")
      .input(z.object({
        conversationId: z.number(),
        whatsappNumberId: z.number().optional(), // optional if we just use convo
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Update local messages status
        await db.update(chatMessages)
          .set({ status: 'read', readAt: new Date() })
          .where(and(
            eq(chatMessages.conversationId, input.conversationId),
            eq(chatMessages.direction, 'inbound'),
            eq(chatMessages.status, 'delivered') // or pending
          ));

        // Reset unread count
        await db.update(conversations)
          .set({ unreadCount: 0 })
          .where(eq(conversations.id, input.conversationId));

        return { success: true };
      }),

    sendMessage: permissionProcedure("chat.send")
      .input(z.object({
        conversationId: z.number(),
        whatsappNumberId: z.number().optional(),
        facebookPageId: z.number().optional(),
        messageType: z.enum(['text', 'image', 'video', 'audio', 'document', 'location', 'sticker', 'contact', 'template']),
        content: z.string().optional(),
        mediaUrl: z.string().optional(),
        mediaName: z.string().optional(),
        mediaMimeType: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        locationName: z.string().optional(),
        // Template specific
        templateName: z.string().optional(),
        templateLanguage: z.string().optional(),
        templateComponents: z.array(z.any()).optional(),
        // Facebook specific
        isFacebook: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const now = new Date();

        // Lookup conversation to determine channel
        const convRows = await db.select()
          .from(conversations)
          .where(eq(conversations.id, input.conversationId))
          .limit(1);
        const conv = convRows[0];
        if (!conv) throw new Error("Conversation not found");

        const isFacebook = conv.channel === 'facebook';

        const insertRes = await db.insert(chatMessages).values({
          conversationId: input.conversationId,
          whatsappNumberId: isFacebook ? null : (input.whatsappNumberId || conv.whatsappNumberId),
          facebookPageId: isFacebook ? (input.facebookPageId || conv.facebookPageId) : null,
          direction: 'outbound',
          messageType: input.messageType,
          content: input.content ?? (input.templateName ? `Template: ${input.templateName}` : null),
          mediaUrl: input.mediaUrl ?? null,
          mediaName: input.mediaName ?? null,
          mediaMimeType: input.mediaMimeType ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          locationName: input.locationName ?? null,
          status: 'pending',
        } as any);

        const id = insertRes[0].insertId as number;

        // Update conversation lastMessageAt
        await db.update(conversations)
          .set({ lastMessageAt: now })
          .where(eq(conversations.id, input.conversationId));

        if (isFacebook) {
          // --- FACEBOOK SEND LOGIC ---
          const pageId = input.facebookPageId || conv.facebookPageId;
          if (!pageId) throw new Error("Falta facebookPageId");

          // Get Page Access Token
          const { facebookPages } = await import("../drizzle/schema");
          const pageRows = await db.select().from(facebookPages).where(eq(facebookPages.id, pageId)).limit(1);
          const page = pageRows[0];

          if (!page || !page.accessToken) throw new Error("Página de Facebook no conectada o sin token");

          const accessToken = decryptSecret(page.accessToken) || page.accessToken;
          if (!accessToken) throw new Error("Error desencriptando token de Facebook");

          const { sendFacebookMessage } = await import("./_core/facebook");

          // Construct message payload
          let messagePayload: any = {};

          if (input.messageType === 'text') {
            if (!input.content) throw new Error("Mensaje vacío");
            messagePayload = { text: input.content };
          } else if (['image', 'video', 'audio', 'file'].includes(input.messageType)) {
            if (!input.mediaUrl) throw new Error("Falta URL de multimedia");
            messagePayload = {
              attachment: {
                type: input.messageType === 'document' ? 'file' : input.messageType,
                payload: { url: input.mediaUrl, is_reusable: true }
              }
            };
          } else {
            throw new Error(`Tipo de mensaje no soportado para Facebook: ${input.messageType}`);
          }

          try {
            const res = await sendFacebookMessage({
              accessToken,
              recipientId: conv.contactPhone, // In FB, contactPhone holds the PSID
              message: messagePayload
            });

            await db.update(chatMessages)
              .set({
                status: 'sent',
                facebookMessageId: res.messageId,
                sentAt: now,
              })
              .where(eq(chatMessages.id, id));

            return { id, success: true, sent: true };
          } catch (err: any) {
            await db.update(chatMessages)
              .set({ status: 'failed', errorMessage: err.message, failedAt: now })
              .where(eq(chatMessages.id, id));
            throw err;
          }
        } else {
          // --- WHATSAPP SEND LOGIC ---
          const whatsappNumberId = input.whatsappNumberId || conv.whatsappNumberId;
          if (!whatsappNumberId) throw new Error("Falta whatsappNumberId");

          // Lookup WhatsApp API connection
          const connRows = await db.select()
            .from(whatsappConnections)
            .where(eq(whatsappConnections.whatsappNumberId, whatsappNumberId))
            .limit(1);
          const conn = connRows[0];

          // If not connected via API, keep it pending
          if (!conn || conn.connectionType !== 'api' || !conn.isConnected) {
            return { id, success: true, queued: true } as const;
          }

          const token = decryptSecret(conn.accessToken ?? '') ?? (conn.accessToken ?? null);
          if (!token) {
            await db.update(chatMessages)
              .set({ status: 'failed', errorMessage: 'Missing accessToken', failedAt: now })
              .where(eq(chatMessages.id, id));
            throw new Error('WhatsApp API no configurada (accessToken faltante)');
          }
          if (!conn.phoneNumberId) {
            await db.update(chatMessages)
              .set({ status: 'failed', errorMessage: 'Missing phoneNumberId', failedAt: now })
              .where(eq(chatMessages.id, id));
            throw new Error('WhatsApp API no configurada (phoneNumberId faltante)');
          }

          // Build Cloud API payload
          const mt = input.messageType;
          let payload: any;
          let waMessageId: string | undefined;

          try {
            if (mt === 'template') {
              if (!input.templateName) throw new Error("Missing templateName");
              const { sendCloudTemplate } = await import("./whatsapp/cloud");
              const res = await sendCloudTemplate({
                accessToken: token,
                phoneNumberId: conn.phoneNumberId,
                to: conv.contactPhone,
                templateName: input.templateName,
                languageCode: input.templateLanguage || "es",
                components: input.templateComponents,
              });
              waMessageId = res.messageId;

            } else {
              // Standard media/text
              if (mt === 'text') {
                const body = (input.content ?? '').trim();
                if (!body) throw new Error('El mensaje de texto está vacío');
                payload = { type: 'text', body };
              } else if (mt === 'image' || mt === 'video' || mt === 'audio') {
                if (!input.mediaUrl) throw new Error('Falta mediaUrl');
                payload = { type: mt, link: input.mediaUrl, caption: input.content || undefined };
              } else if (mt === 'document') {
                if (!input.mediaUrl) throw new Error('Falta mediaUrl');
                payload = {
                  type: 'document',
                  link: input.mediaUrl,
                  caption: input.content || undefined,
                  filename: input.mediaName || undefined,
                };
              } else if (mt === 'location') {
                if (input.latitude == null || input.longitude == null) throw new Error('Faltan coordenadas');
                payload = {
                  type: 'location',
                  latitude: input.latitude,
                  longitude: input.longitude,
                  name: input.locationName || undefined,
                };
              } else if (mt === 'sticker') {
                if (!input.mediaUrl) throw new Error('Falta mediaUrl');
                payload = { type: 'sticker', link: input.mediaUrl };
              } else if (mt === 'contact') {
                const vcard = (input.content ?? '').trim();
                if (!vcard) throw new Error('Falta vCard para contacto');
                payload = { type: 'contact', vcard };
              }

              // Send standard message
              const res = await sendCloudMessage({
                accessToken: token,
                phoneNumberId: conn.phoneNumberId,
                to: conv.contactPhone,
                payload,
              });
              waMessageId = res.messageId;
            }

            // Update DB on success
            await db.update(chatMessages)
              .set({
                status: 'sent',
                whatsappMessageId: waMessageId,
                sentAt: now,
                errorMessage: null,
                failedAt: null,
              })
              .where(eq(chatMessages.id, id));

            // Bump counters
            await db.update(whatsappNumbers)
              .set({
                messagesSentToday: sql`${whatsappNumbers.messagesSentToday} + 1`,
                totalMessagesSent: sql`${whatsappNumbers.totalMessagesSent} + 1`,
                lastConnected: now,
              })
              .where(eq(whatsappNumbers.id, whatsappNumberId));

            void dispatchIntegrationEvent({
              whatsappNumberId: whatsappNumberId,
              event: "message_sent",
              data: {
                conversationId: input.conversationId,
                chatMessageId: id,
                whatsappMessageId: waMessageId,
                to: conv.contactPhone,
                messageType: mt,
                content: input.content ?? null,
                mediaUrl: input.mediaUrl ?? null,
              },
            });

            return { id, success: true, sent: true, whatsappMessageId: waMessageId } as const;

          } catch (e: any) {
            const message = e?.message ? String(e.message) : 'Failed to send';
            await db.update(chatMessages)
              .set({ status: 'failed', errorMessage: message, failedAt: now })
              .where(eq(chatMessages.id, id));
            throw new Error(message);
          }
        }
      }),

    createConversation: permissionProcedure("chat.send")
      .input(z.object({
        whatsappNumberId: z.number().optional(),
        facebookPageId: z.number().optional(),
        contactPhone: z.string(),
        contactName: z.string().optional(),
        leadId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const channel = input.facebookPageId ? 'facebook' : 'whatsapp';

        // Validate required ID based on channel
        if (channel === 'whatsapp' && !input.whatsappNumberId) {
          throw new Error("Falta whatsappNumberId");
        }
        if (channel === 'facebook' && !input.facebookPageId) {
          throw new Error("Falta facebookPageId");
        }

        const result = await db.insert(conversations).values({
          channel,
          whatsappNumberId: input.whatsappNumberId ?? null,
          facebookPageId: input.facebookPageId ?? null,
          contactPhone: input.contactPhone,
          contactName: input.contactName,
          leadId: input.leadId,
          lastMessageAt: new Date(),
          status: 'active',
        } as any);

        const newConvId = result[0].insertId;

        // Attempt distribution
        try {
          await distributeConversation(newConvId);
        } catch (e) {
          console.error("[CreateConversation] Distribution failed", e);
        }

        return { id: newConvId, success: true };
      }),
  }),

  // WhatsApp connections router
  whatsappConnections: router({
    get: permissionProcedure("monitoring.view")
      .input(z.object({ whatsappNumberId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        const result = await db.select()
          .from(whatsappConnections)
          .where(eq(whatsappConnections.whatsappNumberId, input.whatsappNumberId))
          .limit(1);

        const row = result[0] ?? null;
        if (!row) return null;

        return {
          ...row,
          accessToken: row.accessToken ? maskSecret(row.accessToken) : null,
          hasAccessToken: Boolean(row.accessToken),
        } as any;
      }),

    setupApi: permissionProcedure("monitoring.manage")
      .input(z.object({
        whatsappNumberId: z.number(),
        accessToken: z.string(),
        phoneNumberId: z.string(),
        businessAccountId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        let encryptedToken: string;
        try {
          encryptedToken = encryptSecret(input.accessToken);
        } catch {
          throw new Error("Falta DATA_ENCRYPTION_KEY para encriptar el accessToken");
        }

        // Check if connection exists
        const existing = await db.select()
          .from(whatsappConnections)
          .where(eq(whatsappConnections.whatsappNumberId, input.whatsappNumberId))
          .limit(1);

        if (existing[0]) {
          await db.update(whatsappConnections)
            .set({
              connectionType: 'api',
              accessToken: encryptedToken,
              phoneNumberId: input.phoneNumberId,
              businessAccountId: input.businessAccountId,
              isConnected: true,
            })
            .where(eq(whatsappConnections.whatsappNumberId, input.whatsappNumberId));
        } else {
          await db.insert(whatsappConnections).values({
            whatsappNumberId: input.whatsappNumberId,
            connectionType: 'api',
            accessToken: encryptedToken,
            phoneNumberId: input.phoneNumberId,
            businessAccountId: input.businessAccountId,
            isConnected: true,
          });
        }

        // Update whatsapp number status
        await db.update(whatsappNumbers)
          .set({ isConnected: true, status: 'active' })
          .where(eq(whatsappNumbers.id, input.whatsappNumberId));

        return { success: true };
      }),

    generateQr: permissionProcedure("monitoring.manage")
      .input(z.object({ whatsappNumberId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Generate a placeholder QR code (in real implementation, this would connect to WhatsApp Web)
        const qrCode = `WHATSAPP_QR_${input.whatsappNumberId}_${Date.now()}`;
        const qrExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Check if connection exists
        const existing = await db.select()
          .from(whatsappConnections)
          .where(eq(whatsappConnections.whatsappNumberId, input.whatsappNumberId))
          .limit(1);

        if (existing[0]) {
          await db.update(whatsappConnections)
            .set({
              connectionType: 'qr',
              qrCode,
              qrExpiresAt,
              isConnected: false,
            })
            .where(eq(whatsappConnections.whatsappNumberId, input.whatsappNumberId));
        } else {
          await db.insert(whatsappConnections).values({
            whatsappNumberId: input.whatsappNumberId,
            connectionType: 'qr',
            qrCode,
            qrExpiresAt,
            isConnected: false,
          });
        }

        return { qrCode, expiresAt: qrExpiresAt };
      }),

    disconnect: permissionProcedure("monitoring.manage")
      .input(z.object({ whatsappNumberId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.update(whatsappConnections)
          .set({ isConnected: false })
          .where(eq(whatsappConnections.whatsappNumberId, input.whatsappNumberId));

        await db.update(whatsappNumbers)
          .set({ isConnected: false, status: 'disconnected' })
          .where(eq(whatsappNumbers.id, input.whatsappNumberId));

        return { success: true };
      }),
  }),


  // Facebook Router
  facebook: router({
    listPages: permissionProcedure("settings.view").query(async () => {
      const db = await getDb();
      if (!db) return [];
      const { facebookPages } = await import("../drizzle/schema"); // Lazy load or assume verified
      return db.select().from(facebookPages).orderBy(desc(facebookPages.createdAt));
    }),

    connectPage: permissionProcedure("settings.manage")
      .input(z.object({
        pageId: z.string(),
        name: z.string(),
        accessToken: z.string(),
        pictureUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { facebookPages } = await import("../drizzle/schema");

        const existing = await db.select().from(facebookPages).where(eq(facebookPages.pageId, input.pageId)).limit(1);

        if (existing[0]) {
          await db.update(facebookPages).set({
            name: input.name,
            accessToken: encryptSecret(input.accessToken),
            pictureUrl: input.pictureUrl,
            isConnected: true,
            updatedAt: new Date(),
          }).where(eq(facebookPages.id, existing[0].id));
        } else {
          await db.insert(facebookPages).values({
            pageId: input.pageId,
            name: input.name,
            accessToken: encryptSecret(input.accessToken),
            pictureUrl: input.pictureUrl,
            isConnected: true,
          });
        }
        return { success: true };
      }),

    disconnectPage: permissionProcedure("settings.manage")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { facebookPages } = await import("../drizzle/schema");

        await db.update(facebookPages)
          .set({ isConnected: false, accessToken: null })
          .where(eq(facebookPages.id, input.id));
        return { success: true };
      }),
  }),

  // Workflows router
  workflows: router({
    list: permissionProcedure("campaigns.view").query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(workflows).orderBy(desc(workflows.createdAt));
    }),

    create: permissionProcedure("campaigns.manage")
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        triggerType: z.enum(["lead_created", "lead_updated", "msg_received", "campaign_link_clicked"]),
        triggerConfig: z.any().optional(),
        actions: z.array(z.any()).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db.insert(workflows).values({
          ...input,
          isActive: true
        });
        return { success: true, id: result[0].insertId };
      }),

    update: permissionProcedure("campaigns.manage")
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        triggerType: z.enum(["lead_created", "lead_updated", "msg_received", "campaign_link_clicked"]).optional(),
        triggerConfig: z.any().optional(),
        actions: z.array(z.any()).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB error");

        await db.update(workflows).set(input).where(eq(workflows.id, input.id));
        return { success: true };
      }),

    toggle: permissionProcedure("campaigns.manage")
      .input(z.object({ id: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.update(workflows).set({ isActive: input.isActive }).where(eq(workflows.id, input.id));
        return { success: true };
      }),

    delete: permissionProcedure("campaigns.manage")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.delete(workflows).where(eq(workflows.id, input.id));
        return { success: true };
      }),
  }),

  // Security router for access logs and session management
  security: router({
    listAccessLogs: permissionProcedure("settings.view")
      .input(z.object({
        userId: z.number().optional(),
        action: z.string().optional(),
        limit: z.number().min(10).max(200).default(50),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        let query = db.select().from(accessLogs).orderBy(desc(accessLogs.createdAt));

        // Apply filters
        const conditions = [];
        if (input.userId) conditions.push(eq(accessLogs.userId, input.userId));
        if (input.action) conditions.push(eq(accessLogs.action, input.action));

        if (conditions.length > 0) {
          query = query.where(and(...conditions)) as any;
        }

        const results = await query.limit(input.limit).offset(input.offset);

        // Join with user names
        const userIds = Array.from(new Set(results.map(r => r.userId).filter(Boolean))) as number[];
        const usersList = userIds.length > 0
          ? await db.select().from(users).where(sql`${users.id} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`)
          : [];

        const usersMap = new Map(usersList.map(u => [u.id, u.name]));

        return results.map(log => ({
          ...log,
          userName: log.userId ? usersMap.get(log.userId) : null,
        }));
      }),

    listActiveSessions: permissionProcedure("settings.view")
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) return [];

        // Get all non-expired sessions
        const now = new Date();
        const activeSessions = await db.select()
          .from(sessions)
          .where(sql`${sessions.expiresAt} > ${now}`)
          .orderBy(desc(sessions.lastActivityAt));

        // Join with user names
        const userIds = Array.from(new Set(activeSessions.map(s => s.userId)));
        const usersList = userIds.length > 0
          ? await db.select().from(users).where(sql`${users.id} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`)
          : [];

        const usersMap = new Map(usersList.map(u => [u.id, u.name]));

        return activeSessions.map(session => ({
          ...session,
          userName: usersMap.get(session.userId) ?? "Unknown",
        }));
      }),

    revokeSession: permissionProcedure("settings.manage")
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Delete the session
        await db.delete(sessions).where(eq(sessions.id, input.sessionId));

        // Log the action
        await logAccess({
          userId: ctx.user?.id,
          action: "revoke_session",
          entityType: "session",
          entityId: input.sessionId,
          ipAddress: getClientIp(ctx.req),
          userAgent: ctx.req.headers['user-agent'],
        });

        return { success: true };
      }),
  }),

  // Backup and data management router
  backup: router({
    createBackup: permissionProcedure("settings.manage")
      .mutation(async ({ ctx }) => {
        const backupData = await createBackup();

        // Log the backup action
        await logAccess({
          userId: ctx.user?.id,
          action: "create_backup",
          ipAddress: getClientIp(ctx.req),
          userAgent: ctx.req.headers['user-agent'],
        });

        return backupData;
      }),

    restoreBackupJson: permissionProcedure("settings.manage")
      .input(z.object({
        backupJson: z.any(),
        mode: z.enum(["replace", "merge"]).default("replace"),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await restoreBackup(input.backupJson, input.mode);

        await logAccess({
          userId: ctx.user?.id,
          action: "restore_backup",
          metadata: { mode: input.mode, result },
          ipAddress: getClientIp(ctx.req),
          userAgent: ctx.req.headers['user-agent'],
        });

        return result;
      }),

    exportLeadsCSV: permissionProcedure("leads.view")
      .query(async () => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const leadsData = await db.select().from(leads);
        const csvContent = leadsToCSV(leadsData);

        return { csv: csvContent, count: leadsData.length };
      }),

    importLeadsCSV: permissionProcedure("leads.create")
      .input(z.object({ csvContent: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const parsedData = parseCSV(input.csvContent);
        const result = await importLeadsFromCSV(parsedData);

        // Log the import action
        await logAccess({
          userId: ctx.user?.id,
          action: "import_leads_csv",
          metadata: { result },
          ipAddress: getClientIp(ctx.req),
          userAgent: ctx.req.headers['user-agent'],
        });

        return result;
      }),
  }),
  achievements: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db || !ctx.user) return [];
      return db.select().from(achievements).where(eq(achievements.userId, ctx.user.id));
    }),

    unlock: protectedProcedure
      .input(z.object({ type: z.string(), metadata: z.any().optional() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db || !ctx.user) return { success: false };
        await db.insert(achievements).values({
          userId: ctx.user.id,
          type: input.type,
          metadata: input.metadata,
        });
        return { success: true };
      }),
  }),

  goals: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db || !ctx.user) return [];
      return db.select().from(goals).where(eq(goals.userId, ctx.user.id));
    }),

    create: protectedProcedure
      .input(z.object({
        type: z.enum(["sales_amount", "deals_closed", "leads_created", "messages_sent"]),
        targetAmount: z.number(),
        period: z.enum(["daily", "weekly", "monthly"]),
        startDate: z.string().transform(s => new Date(s)),
        endDate: z.string().transform(s => new Date(s)),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db || !ctx.user) return { success: false };
        await db.insert(goals).values({
          userId: ctx.user.id,
          type: input.type,
          targetAmount: input.targetAmount,
          period: input.period,
          startDate: input.startDate,
          endDate: input.endDate,
        });
        return { success: true };
      }),

    updateProgress: protectedProcedure
      .input(z.object({ id: z.number(), amount: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.update(goals)
          .set({ currentAmount: input.amount })
          .where(eq(goals.id, input.id));
        return { success: true };
      }),
  }),

  // Dashboard Widgets Data
  dashboard: router({
    getStats: permissionProcedure("dashboard.view")
      .query(async () => {
        const db = await getDb();
        if (!db) return { totalLeads: 0, activeNumbers: 0, messagesToday: 0, conversionRate: 0 };

        // 1. Total Leads
        const leadsCount = await db.select({ count: sql<number>`count(*)` }).from(leads);
        const totalLeads = Number(leadsCount[0]?.count ?? 0);

        // 2. Active WhatsApp Numbers
        const numbersCount = await db.select({ count: sql<number>`count(*)` }).from(whatsappConnections).where(eq(whatsappConnections.isConnected, true));
        const activeNumbers = Number(numbersCount[0]?.count ?? 0);

        // 3. Messages Today (Outbound)
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const messagesCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(chatMessages)
          .where(and(
            eq(chatMessages.direction, "outbound"),
            gte(chatMessages.createdAt, startOfDay)
          ));
        const messagesToday = Number(messagesCount[0]?.count ?? 0);

        // 4. Conversion Rate (Won / Total)
        const wonCount = await db.select({ count: sql<number>`count(*)` }).from(leads).where(eq(leads.status, "won"));
        const won = Number(wonCount[0]?.count ?? 0);
        const conversionRate = totalLeads > 0 ? Math.round((won / totalLeads) * 100) : 0;

        return {
          totalLeads,
          activeNumbers,
          messagesToday,
          conversionRate
        };
      }),

    getPipelineFunnel: permissionProcedure("dashboard.view")
      .query(async () => {
        const db = await getDb();
        if (!db) return [];

        // Get lead counts by pipeline stage
        const stageCounts = await db
          .select({
            stageId: leads.pipelineStageId,
            stageName: pipelineStages.name,
            stageColor: pipelineStages.color,
            stageOrder: pipelineStages.order,
            count: sql<number>`count(*)`,
          })
          .from(leads)
          .leftJoin(pipelineStages, eq(leads.pipelineStageId, pipelineStages.id))
          .where(sql`${leads.pipelineStageId} IS NOT NULL`)
          .groupBy(leads.pipelineStageId, pipelineStages.name, pipelineStages.color, pipelineStages.order)
          .orderBy(asc(pipelineStages.order));

        return stageCounts.map(s => ({
          stage: s.stageName || "Sin etapa",
          count: Number(s.count),
          color: s.stageColor || "#e2e8f0",
        }));
      }),

    getLeaderboard: permissionProcedure("dashboard.view")
      .query(async () => {
        const db = await getDb();
        if (!db) return [];

        // Get top agents by number of won deals and total commission
        const leaderboard = await db
          .select({
            userId: leads.assignedToId,
            userName: users.name,
            dealsWon: sql<number>`count(*)`,
            totalCommission: sql<number>`sum(${leads.commission})`,
          })
          .from(leads)
          .leftJoin(users, eq(leads.assignedToId, users.id))
          .where(eq(leads.status, "won"))
          .groupBy(leads.assignedToId, users.name)
          .orderBy(desc(sql`sum(${leads.commission})`))
          .limit(5);

        return leaderboard.map((agent, index) => ({
          rank: index + 1,
          name: agent.userName || "Sin asignar",
          dealsWon: Number(agent.dealsWon),
          commission: Number(agent.totalCommission || 0),
        }));
      }),

    getUpcomingAppointments: permissionProcedure("dashboard.view")
      .query(async () => {
        const db = await getDb();
        if (!db) return [];

        const upcoming = await db
          .select({
            id: appointments.id,
            firstName: appointments.firstName,
            lastName: appointments.lastName,
            phone: appointments.phone,
            appointmentDate: appointments.appointmentDate,
            appointmentTime: appointments.appointmentTime,
            status: appointments.status,
            reasonName: appointmentReasons.name,
          })
          .from(appointments)
          .leftJoin(appointmentReasons, eq(appointments.reasonId, appointmentReasons.id))
          .where(
            and(
              sql`${appointments.appointmentDate} >= CURDATE()`,
              inArray(appointments.status, ["scheduled", "confirmed"])
            )
          )
          .orderBy(asc(appointments.appointmentDate), asc(appointments.appointmentTime))
          .limit(5);

        return upcoming;
      }),

    getRecentActivity: permissionProcedure("dashboard.view")
      .query(async () => {
        const db = await getDb();
        if (!db) return [];

        const activities = await db
          .select({
            id: activityLogs.id,
            action: activityLogs.action,
            entityType: activityLogs.entityType,
            entityId: activityLogs.entityId,
            userName: users.name,
            createdAt: activityLogs.createdAt,
          })
          .from(activityLogs)
          .leftJoin(users, eq(activityLogs.userId, users.id))
          .orderBy(desc(activityLogs.createdAt))
          .limit(10);

        return activities;
      }),
  }),
  // Internal Team Chat
  internalChat: router({
    send: protectedProcedure
      .input(z.object({
        content: z.string().min(1),
        recipientId: z.number().optional().nullable(), // Null = General
        attachments: z.array(z.object({
          type: z.enum(['image', 'video', 'file']),
          url: z.string(),
          name: z.string()
        })).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db || !ctx.user) throw new Error("Database not available");

        await db.insert(internalMessages).values({
          senderId: ctx.user.id,
          recipientId: input.recipientId ?? null,
          content: input.content,
          attachments: input.attachments,
        });

        return { success: true };
      }),

    getHistory: protectedProcedure
      .input(z.object({
        recipientId: z.number().optional().nullable(), // Null = General
      }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db || !ctx.user) return [];

        if (!input.recipientId) {
          // General channel: fetch all messages where recipientId is null
          const msgs = await db.select({
            id: internalMessages.id,
            content: internalMessages.content,
            attachments: internalMessages.attachments,
            createdAt: internalMessages.createdAt,
            senderId: internalMessages.senderId,
            senderName: users.name,
          })
            .from(internalMessages)
            .leftJoin(users, eq(internalMessages.senderId, users.id))
            .where(sql`${internalMessages.recipientId} IS NULL`)
            .orderBy(asc(internalMessages.createdAt))
            .limit(100);

          return msgs;
        } else {
          // Direct Message: fetch messages between me and recipient (both directions)
          const msgs = await db.select({
            id: internalMessages.id,
            content: internalMessages.content,
            attachments: internalMessages.attachments,
            createdAt: internalMessages.createdAt,
            senderId: internalMessages.senderId,
            senderName: users.name,
          })
            .from(internalMessages)
            .leftJoin(users, eq(internalMessages.senderId, users.id))
            .where(
              and(
                sql`(${internalMessages.senderId} = ${ctx.user.id} AND ${internalMessages.recipientId} = ${input.recipientId}) OR (${internalMessages.senderId} = ${input.recipientId} AND ${internalMessages.recipientId} = ${ctx.user.id})`
              )
            )
            .orderBy(asc(internalMessages.createdAt))
            .limit(100);

          return msgs;
        }
      }),

    // Mark messages as read from a specific sender (or general channel)
    markAsRead: protectedProcedure
      .input(z.object({
        senderId: z.number().optional().nullable(), // Null = General channel updates
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db || !ctx.user) return { success: false };

        if (!input.senderId) {
          // Mark general channel messages as read? 
          // Actually, for General channel, it's harder to track "read" per user without a separate table "MessageReadStatus".
          // For now, we will only track Direct Message read status.
          // If we want to track General, we need a many-to-many table (User <-> Message).
          // Let's skip General channel read status for now to keep schema simple, or just client-side local storage.
          return { success: true };
        } else {
          // Mark all messages FROM senderId TO me as read
          await db.update(internalMessages)
            .set({ isRead: true })
            .where(
              and(
                eq(internalMessages.senderId, input.senderId),
                eq(internalMessages.recipientId, ctx.user.id),
                eq(internalMessages.isRead, false)
              )
            );
        }
        return { success: true };
      }),

    getRecentChats: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db || !ctx.user) return [];

      const allUsers = await db.select({
        id: users.id,
        name: users.name,
        role: users.role,
        isActive: users.isActive
      }).from(users).where(eq(users.isActive, true));

      // Get unread counts for each user
      // We can do this efficiently with a groupBy query
      const unreadCounts = await db.select({
        senderId: internalMessages.senderId,
        count: sql<number>`count(*)`
      })
        .from(internalMessages)
        .where(
          and(
            eq(internalMessages.recipientId, ctx.user.id), // Sent to me
            eq(internalMessages.isRead, false) // Not read
          )
        )
        .groupBy(internalMessages.senderId);

      const unreadMap = new Map<number, number>();
      unreadCounts.forEach(r => unreadMap.set(r.senderId, Number(r.count)));

      return allUsers
        .filter(u => u.id !== ctx.user?.id)
        .map(u => ({
          ...u,
          unreadCount: unreadMap.get(u.id) || 0
        }))
        .sort((a, b) => (b.unreadCount - a.unreadCount)); // Sort by unread first
    }),
  }),

  // Settings Management
  settings: router({
    get: protectedProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const settings = await db.select().from(appSettings).limit(1);
        return settings[0] || null;
      }),

    updateDashboardConfig: protectedProcedure
      .input(z.record(z.boolean()))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get existing settings
        const existing = await db.select().from(appSettings).limit(1);

        if (existing.length > 0) {
          // Update existing
          await db.update(appSettings)
            .set({
              dashboardConfig: {
                ...existing[0].dashboardConfig as any,
                ...input
              },
              updatedAt: new Date()
            })
            .where(eq(appSettings.id, existing[0].id));
        } else {
          // Create first settings entry
          await db.insert(appSettings).values({
            dashboardConfig: input
          });
        }

        return { success: true };
      }),
  }),
});


export type AppRouter = typeof appRouter;
