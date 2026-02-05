import { z } from "zod";
import { appSettings } from "../../drizzle/schema";
import { getDb } from "../db";
import { permissionProcedure, adminProcedure, router, protectedProcedure } from "../_core/trpc";
import { sanitizeAppSettings } from "../_core/security-helpers";
import { getOrCreateAppSettings, updateAppSettings } from "../services/app-settings";
import { encryptSecret } from "../_core/crypto";

export const settingsRouter = router({
    get: permissionProcedure("settings.view").query(async () => {
        const db = await getDb();
        if (!db) return null;
        const row = await getOrCreateAppSettings(db);
        return sanitizeAppSettings(row);
    }),

    getScheduling: permissionProcedure("scheduling.view")
        .query(async () => {
            const db = await getDb();
            if (!db) return null;
            const row = await getOrCreateAppSettings(db);
            return row.scheduling || null;
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
                        alertEmail: z.string().includes("@").optional().or(z.literal("")),
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
                metaConfig: z
                    .object({
                        appId: z.string().optional(),
                        appSecret: z.string().optional(),
                        verifyToken: z.string().optional(),
                    })
                    .optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            // Fetch current settings for secure merge (especially for secrets)
            const currentSettings = await getOrCreateAppSettings(db);

            let metaConfigUpdate = undefined;
            if (input.metaConfig) {
                const prevMeta = (currentSettings.metaConfig as Record<string, any>) ?? {};
                metaConfigUpdate = {
                    ...prevMeta,
                    ...(input.metaConfig.appId !== undefined ? { appId: input.metaConfig.appId } : {}),
                    ...(input.metaConfig.verifyToken !== undefined ? { verifyToken: input.metaConfig.verifyToken } : {}),
                    // Only update secret if provided
                    ...(input.metaConfig.appSecret && input.metaConfig.appSecret.trim() ? { appSecret: input.metaConfig.appSecret.trim() } : {}),
                };
            }

            await updateAppSettings(db, {
                companyName: input.companyName,
                logoUrl: input.logoUrl,
                timezone: input.timezone,
                language: input.language,
                currency: input.currency,
                scheduling: input.scheduling,
                slaConfig: input.slaConfig,
                chatDistributionConfig: input.chatDistributionConfig,
                salesConfig: input.salesConfig,
                ...(metaConfigUpdate ? { metaConfig: metaConfigUpdate } : {}),
            });

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

            await updateAppSettings(db, { permissionsMatrix: input.permissionsMatrix });
            return { success: true } as const;
        }),

    updateSecurityConfig: permissionProcedure("settings.manage")
        .input(z.object({
            securityConfig: z.object({
                allowedIps: z.array(z.string()),
                maxLoginAttempts: z.number().optional(),
                sessionTimeoutMinutes: z.number().optional(),
            })
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");
            await updateAppSettings(db, { securityConfig: input.securityConfig });
            return { success: true };
        }),

    updateDashboardConfig: permissionProcedure("settings.manage")
        .input(z.record(z.string(), z.boolean()))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");
            // Merge with existing config
            const currentSettings = await getOrCreateAppSettings(db);
            const current = (currentSettings.dashboardConfig as Record<string, any>) || {};

            await updateAppSettings(db, {
                dashboardConfig: { ...current, ...input }
            });

            return { success: true };
        }),

    updateDashboardLayout: permissionProcedure("settings.manage")
        .input(z.object({ layout: z.array(z.any()) }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");
            const currentSettings = await getOrCreateAppSettings(db);
            const current = (currentSettings.dashboardConfig as Record<string, any>) || {};

            await updateAppSettings(db, {
                dashboardConfig: { ...current, layout: input.layout }
            });

            return { success: true };
        }),

    updateSmtpConfig: permissionProcedure("settings.manage")
        .input(z.object({
            host: z.string(),
            port: z.number(),
            secure: z.boolean(),
            user: z.string(),
            pass: z.string().optional().nullable(),
            from: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            const currentSettings = await getOrCreateAppSettings(db);
            const prev = (currentSettings.smtpConfig as Record<string, any>) ?? {};

            const next = {
                ...prev,
                host: input.host,
                port: input.port,
                secure: input.secure,
                user: input.user,
                from: input.from,
                ...(input.pass && input.pass.trim() ? { pass: encryptSecret(input.pass.trim()) } : {}),
                ...(input.pass === null ? { pass: null } : {}),
            };

            await updateAppSettings(db, { smtpConfig: next });
            return { success: true };
        }),

    updateStorageConfig: permissionProcedure("settings.manage")
        .input(z.object({
            provider: z.enum(["forge", "s3"]),
            bucket: z.string().optional(),
            region: z.string().optional(),
            accessKey: z.string().optional().nullable(),
            secretKey: z.string().optional().nullable(),
            endpoint: z.string().optional(),
            publicUrl: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            const currentSettings = await getOrCreateAppSettings(db);
            const prev = (currentSettings.storageConfig as Record<string, any>) ?? {};

            const next = {
                ...prev,
                provider: input.provider,
                bucket: input.bucket,
                region: input.region,
                endpoint: input.endpoint,
                publicUrl: input.publicUrl,
                ...(input.accessKey && input.accessKey.trim() ? { accessKey: encryptSecret(input.accessKey.trim()) } : {}),
                ...(input.accessKey === null ? { accessKey: null } : {}),
                ...(input.secretKey && input.secretKey.trim() ? { secretKey: encryptSecret(input.secretKey.trim()) } : {}),
                ...(input.secretKey === null ? { secretKey: null } : {}),
            };

            await updateAppSettings(db, { storageConfig: next });
            return { success: true };
        }),

    updateAiConfig: permissionProcedure("settings.manage")
        .input(z.object({
            provider: z.enum(["openai", "anthropic"]),
            apiKey: z.string().optional().nullable(),
            model: z.string(),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            const currentSettings = await getOrCreateAppSettings(db);
            const prev = (currentSettings.aiConfig as Record<string, any>) ?? {};

            const next = {
                ...prev,
                provider: input.provider,
                model: input.model,
                ...(input.apiKey && input.apiKey.trim() ? { apiKey: encryptSecret(input.apiKey.trim()) } : {}),
                ...(input.apiKey === null ? { apiKey: null } : {}),
            };

            await updateAppSettings(db, { aiConfig: next });
            return { success: true };
        }),

    updateMapsConfig: permissionProcedure("settings.manage")
        .input(z.object({
            apiKey: z.string().optional().nullable(),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            const currentSettings = await getOrCreateAppSettings(db);
            const prev = (currentSettings.mapsConfig as Record<string, any>) ?? {};

            const next = {
                ...prev,
                ...(input.apiKey && input.apiKey.trim() ? { apiKey: encryptSecret(input.apiKey.trim()) } : {}),
                ...(input.apiKey === null ? { apiKey: null } : {}),
            };

            await updateAppSettings(db, { mapsConfig: next });
            return { success: true };
        }),

    myPermissions: protectedProcedure.query(async ({ ctx }) => {
        const db = await getDb();
        // Ensure we don't break if no db or user
        if (!db || !ctx.user) return { role: ctx.user?.role ?? "agent", baseRole: ctx.user?.role ?? "agent", permissions: [] };

        const matrix = (await getOrCreateAppSettings(db)).permissionsMatrix ?? {};
        const baseRole = (ctx.user as any).role ?? "agent";
        const customRole = (ctx.user as any).customRole as string | undefined;

        // Compute effective role again just to be sure
        // Note: we dynamically import to avoid circular dependency if rbac imports routers (unlikely but safe)
        const { computeEffectiveRole } = await import("../_core/rbac");
        const role = computeEffectiveRole({ baseRole, customRole, permissionsMatrix: matrix });

        return { role, baseRole, permissions: role === "owner" ? ["*"] : (matrix[role] ?? []) };
    }),
});
