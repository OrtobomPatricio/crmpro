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
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            // Check if connection exists
            let existing = await db.select()
                .from(whatsappConnections)
                .where(eq(whatsappConnections.whatsappNumberId, input.whatsappNumberId))
                .limit(1);

            if (!existing[0]) {
                await db.insert(whatsappConnections).values({
                    whatsappNumberId: input.whatsappNumberId,
                    connectionType: 'qr',
                    isConnected: false,
                });
            }

            // Import dynamically to avoid top-level side effects if service fails
            const { BaileysService } = await import("../services/baileys");

            // Initialize separate session
            let qrCode: string | undefined;

            await BaileysService.initializeSession(
                input.whatsappNumberId,
                async (qr) => {
                    qrCode = qr;
                    // Update DB with latest QR
                    await db.update(whatsappConnections)
                        .set({ qrCode: qr, qrExpiresAt: new Date(Date.now() + 60000) }) // 1 min validity for UI
                        .where(eq(whatsappConnections.whatsappNumberId, input.whatsappNumberId));
                },
                async (status) => {
                    const isConnected = status === 'connected';
                    await db.update(whatsappConnections)
                        .set({ isConnected, status: isConnected ? 'connected' : 'disconnected' })
                        .where(eq(whatsappConnections.whatsappNumberId, input.whatsappNumberId));

                    if (isConnected) {
                        await db.update(whatsappNumbers)
                            .set({ isConnected: true, status: 'active' })
                            .where(eq(whatsappNumbers.id, input.whatsappNumberId));
                    }
                }
            );

            // Wait for QR to be generated (poll for up to 15 seconds)
            let attempts = 0;
            while (attempts < 30) {
                qrCode = BaileysService.getQr(input.whatsappNumberId);
                if (qrCode) break;

                await new Promise(r => setTimeout(r, 500));
                attempts++;
            }

            return { qrCode, expiresAt: new Date(Date.now() + 60000) };
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
