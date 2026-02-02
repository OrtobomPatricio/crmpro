import { z } from "zod";
import { eq } from "drizzle-orm";
import { whatsappConnections, whatsappNumbers } from "../../drizzle/schema";
import { getDb } from "../db";
import { permissionProcedure, router } from "../_core/trpc";
import { maskSecret, encryptSecret } from "../_core/crypto";

export const whatsappConnectionsRouter = router({
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
});
