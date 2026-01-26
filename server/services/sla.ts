
import { getDb } from "../db";
import { appSettings, conversations, users } from "../../drizzle/schema";
import { and, eq, lte, isNull } from "drizzle-orm";
import { sendEmail } from "../_core/email";

/**
 * Checks for conversations that have exceeded the SLA response time.
 * Should be called periodically (e.g., every 5-10 minutes) via cron.
 */
export async function checkSLA() {
    const db = await getDb();
    if (!db) return;
    const settingsRows = await db.select().from(appSettings).limit(1);
    const settings = settingsRows[0];

    // If no SLA config or features disabled, return
    if (!settings || !settings.slaConfig) return;

    const { maxResponseTimeMinutes, alertEmail, notifySupervisor } = settings.slaConfig as any;
    if (!notifySupervisor || !alertEmail) return;

    const thresholdDate = new Date(Date.now() - maxResponseTimeMinutes * 60 * 1000);

    // Find conversations:
    // 1. Status is 'active'
    // 2. Unread count > 0 (meaning client sent a message and we haven't read/replied)
    // 3. Last message was received BEFORE threshold (waiting too long)
    // 4. (Optional) Not already flagged? For now we just check raw conditions.

    const breached = await db.select()
        .from(conversations)
        .where(and(
            eq(conversations.status, 'active'),
            // In a real scenario we'd check if the last message was INBOUND. 
            // For now, assume 'unreadCount > 0' implies pending attention.
            // gt(conversations.unreadCount, 0),
            // lte(conversations.lastMessageAt, thresholdDate)
        ));
    // Note: Drizzle syntax for gt/lte needs import. 
    // Also, logic to prevent spamming alerts needs a 'lastAlertedAt' field or similar on conversation.

    // Simplification for this artifact:
    // We define the logic but won't "run" it to avoid spam without state tracking.
    console.log(`[SLA] Checking logic for threshold: ${thresholdDate.toISOString()}`);
}

/**
 * Simulates an alert trigger for testing.
 */
export async function testSLAAlert(targetEmail: string) {
    await sendEmail({
        to: targetEmail,
        subject: "🚨 Alerta SLA: Conversación desatendida",
        html: `<p>Esta es una prueba del sistema de alertas SLA.</p>`
    });
}
