import { z } from "zod";
import { eq, desc, count } from "drizzle-orm";
import { whatsappNumbers, whatsappConnections } from "../../drizzle/schema";
import { getDb } from "../db";
import { permissionProcedure, router } from "../_core/trpc";
import { maskSecret, encryptSecret } from "../_core/crypto";

export const whatsappNumbersRouter = router({
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
});
