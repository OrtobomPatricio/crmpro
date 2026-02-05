
import { getDb } from "../db";
import { whatsappConnections, whatsappNumbers } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { BaileysService } from "./baileys";

export async function startWhatsAppSessions() {
    console.log("[WhatsAppSession] Checking for active sessions to restore...");
    const db = await getDb();
    if (!db) {
        console.error("[WhatsAppSession] DB not available");
        return;
    }

    try {
        // Find all connections that are supposed to be connected via QR
        const activeConnections = await db.select()
            .from(whatsappConnections)
            .where(
                and(
                    eq(whatsappConnections.connectionType, 'qr'),
                    eq(whatsappConnections.isConnected, true)
                )
            );

        console.log(`[WhatsAppSession] Found ${activeConnections.length} sessions to restore.`);

        for (const conn of activeConnections) {
            if (!conn.whatsappNumberId) continue;

            console.log(`[WhatsAppSession] Restoring session for Number ID: ${conn.whatsappNumberId}`);
            try {
                // Initialize session
                await BaileysService.initializeSession(
                    conn.whatsappNumberId,
                    async (qr) => {
                        console.log(`[WhatsAppSession] QR Update for ${conn.whatsappNumberId} (Session Invalid)`);
                        // Session is invalid (needs QR), mark as disconnected in DB
                        const db = await getDb();
                        if (db) {
                            await db.update(whatsappConnections)
                                .set({ isConnected: false })
                                .where(eq(whatsappConnections.id, conn.id));

                            await db.update(whatsappNumbers)
                                .set({ isConnected: false, status: 'disconnected' })
                                .where(eq(whatsappNumbers.id, conn.whatsappNumberId!));
                        }
                    },
                    (status) => console.log(`[WhatsAppSession] Status Update for ${conn.whatsappNumberId}: ${status}`)
                );
            } catch (err) {
                console.error(`[WhatsAppSession] Failed to restore session ${conn.whatsappNumberId}:`, err);
                const db = await getDb();
                if (db) {
                    await db.update(whatsappConnections).set({ isConnected: false }).where(eq(whatsappConnections.id, conn.id));
                }
            }
        }
    } catch (error) {
        console.error("[WhatsAppSession] Error finding sessions:", error);
    }
}
