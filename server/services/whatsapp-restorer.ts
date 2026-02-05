
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
                // Initialize session (this will load auth credentials from disk)
                await BaileysService.initializeSession(
                    conn.whatsappNumberId,
                    (qr) => console.log(`[WhatsAppSession] QR Update for ${conn.whatsappNumberId}`),
                    (status) => console.log(`[WhatsAppSession] Status Update for ${conn.whatsappNumberId}: ${status}`)
                );
            } catch (err) {
                console.error(`[WhatsAppSession] Failed to restore session ${conn.whatsappNumberId}:`, err);

                // Optional: Mark as disconnected if file is missing/corrupt?
                // await db.update(whatsappConnections).set({ isConnected: false }).where(eq(whatsappConnections.id, conn.id));
            }
        }
    } catch (error) {
        console.error("[WhatsAppSession] Error finding sessions:", error);
    }
}
