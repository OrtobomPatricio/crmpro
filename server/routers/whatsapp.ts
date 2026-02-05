import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { whatsappConnections, whatsappNumbers } from "../../drizzle/schema";
import { getDb } from "../db";
import { permissionProcedure, router } from "../_core/trpc";
import { fetchCloudTemplates } from "../whatsapp/cloud";
import { BaileysService } from "../services/baileys";

export const whatsappRouter = router({
    list: permissionProcedure("settings.view")
        .query(async () => {
            const db = await getDb();
            if (!db) return [];

            // Join connections with numbers to get full details
            const connections = await db
                .select({
                    id: whatsappConnections.id,
                    phoneNumberId: whatsappConnections.phoneNumberId,
                    businessAccountId: whatsappConnections.businessAccountId,
                    isConnected: whatsappConnections.isConnected,
                    lastPingAt: whatsappConnections.lastPingAt,
                    createdAt: whatsappConnections.createdAt,
                    number: {
                        id: whatsappNumbers.id,
                        phoneNumber: whatsappNumbers.phoneNumber,
                        displayName: whatsappNumbers.displayName,
                        status: whatsappNumbers.status,
                    }
                })
                .from(whatsappConnections)
                .leftJoin(whatsappNumbers, eq(whatsappConnections.whatsappNumberId, whatsappNumbers.id))
                .orderBy(whatsappConnections.createdAt);

            // Merge with real-time status
            return connections.map(conn => {
                let realStatus = conn.isConnected;
                if (conn.number) {
                    const status = BaileysService.getStatus(conn.number.id);
                    // If Baileys says disconnected/connecting/qr_ready, trust it over DB
                    if (status === 'disconnected') realStatus = false;
                    if (status === 'connected') realStatus = true;
                    // For QR ready, technically incorrectly connected in DB but we want to show it needs action
                    // But the UI might expects boolean. 
                    // Let's trust Baileys status if available.
                }
                return { ...conn, isConnected: realStatus };
            });
        }),

    connect: permissionProcedure("settings.manage")
        .input(z.object({
            displayName: z.string().min(1).max(100),
            phoneNumber: z.string().min(5).max(20),
            phoneNumberId: z.string().min(1),
            accessToken: z.string().min(1),
            businessAccountId: z.string().min(1),
        }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            // Check if connection already exists with this phoneNumberId
            const existingConnection = await db
                .select()
                .from(whatsappConnections)
                .where(eq(whatsappConnections.phoneNumberId, input.phoneNumberId))
                .limit(1);

            if (existingConnection.length > 0) {
                // Update existing connection
                await db.update(whatsappConnections).set({
                    accessToken: input.accessToken,
                    businessAccountId: input.businessAccountId,
                    isConnected: true,
                    lastPingAt: new Date(),
                    updatedAt: new Date()
                }).where(eq(whatsappConnections.id, existingConnection[0].id));

                // Update associated number
                if (existingConnection[0].whatsappNumberId) {
                    await db.update(whatsappNumbers).set({
                        displayName: input.displayName,
                        phoneNumber: input.phoneNumber,
                        isConnected: true,
                        lastConnected: new Date(),
                        status: "active",
                        updatedAt: new Date()
                    }).where(eq(whatsappNumbers.id, existingConnection[0].whatsappNumberId));
                }

                return { success: true, id: existingConnection[0].id };
            }

            // Create new whatsappNumber first
            const [newNumber] = await db.insert(whatsappNumbers).values({
                phoneNumber: input.phoneNumber,
                displayName: input.displayName,
                country: "Unknown", // Could extract from phone number
                countryCode: "+", // Could extract from phone number
                status: "active",
                isConnected: true,
                lastConnected: new Date(),
                dailyMessageLimit: 1000,
                messagesSentToday: 0,
                totalMessagesSent: 0,
            }).$returningId();

            // Create connection
            const [newConnection] = await db.insert(whatsappConnections).values({
                whatsappNumberId: newNumber.id,
                connectionType: "api",
                phoneNumberId: input.phoneNumberId,
                accessToken: input.accessToken,
                businessAccountId: input.businessAccountId,
                isConnected: true,
                lastPingAt: new Date(),
            }).$returningId();

            return { success: true, id: newConnection.id };
        }),

    delete: permissionProcedure("settings.manage")
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) return { success: false };

            // Get connection to find associated whatsappNumber
            const connection = await db
                .select()
                .from(whatsappConnections)
                .where(eq(whatsappConnections.id, input.id))
                .limit(1);

            if (connection.length === 0) {
                throw new Error("Connection not found");
            }

            // Delete connection (will cascade delete conversations if configured)
            await db.delete(whatsappConnections).where(eq(whatsappConnections.id, input.id));

            // Delete associated whatsappNumber
            if (connection[0].whatsappNumberId) {
                await db.delete(whatsappNumbers).where(eq(whatsappNumbers.id, connection[0].whatsappNumberId));
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
        }),

    listTemplates: permissionProcedure("campaigns.view").query(async () => {
        const db = await getDb();
        if (!db) return [];
        // Get the first active connection with a businessAccountId
        const connection = await db.select().from(whatsappConnections)
            .where(and(eq(whatsappConnections.isConnected, true)))
            .limit(1);

        if (!connection[0] || !connection[0].accessToken || !connection[0].businessAccountId) {
            return [];
        }

        try {
            return await fetchCloudTemplates({
                accessToken: connection[0].accessToken,
                businessAccountId: connection[0].businessAccountId
            });
        } catch (e) {
            console.error("Failed to sync templates", e);
            throw new Error("Failed to sync with Meta");
        }
    }),
});
