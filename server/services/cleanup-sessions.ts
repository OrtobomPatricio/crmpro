import { getDb } from "../db";
import { sessions } from "../../drizzle/schema";
import { lt } from "drizzle-orm";

// Run every hour
const INTERVAL_MS = 60 * 60 * 1000;

export function startSessionCleanup() {
    console.log("[System] Starting session cleanup service...");

    // Run immediately mostly for dev feedback, but maybe safer to wait
    runCleanup();

    setInterval(runCleanup, INTERVAL_MS);
}

async function runCleanup() {
    try {
        const db = await getDb();
        if (!db) return;

        const now = new Date();
        // Delete sessions where expiresAt < now
        const result = await db.delete(sessions).where(lt(sessions.expiresAt, now));

        //console.log(`[Cleanup] Removed expired sessions.`);
    } catch (error) {
        console.error("[Cleanup] Failed to cleanup sessions:", error);
    }
}
