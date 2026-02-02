import cron from "node-cron";
import { getDb } from "../db";
import { accessLogs, activityLogs } from "../../drizzle/schema";
import { lt } from "drizzle-orm";

/**
 * Log Retention & Cleanup Service
 * 
 * Automatically deletes old logs to prevent database bloat.
 * Runs daily at 3 AM server time.
 * 
 * Default retention: 90 days
 */

const DEFAULT_RETENTION_DAYS = 90;

export function startLogCleanup() {
    console.log("[LogCleanup] Starting log retention worker...");
    console.log(`[LogCleanup] Retention period: ${DEFAULT_RETENTION_DAYS} days`);

    // Run every day at 3 AM
    cron.schedule("0 3 * * *", async () => {
        try {
            await performLogCleanup();
        } catch (err) {
            console.error("[LogCleanup] Error during cleanup:", err);
        }
    });

    // Also allow manual trigger (useful for testing)
    console.log("[LogCleanup] Worker scheduled for daily execution at 03:00");
}

/**
 * Perform the actual log cleanup
 * Can be called manually or by cron
 */
export async function performLogCleanup() {
    const db = await getDb();
    if (!db) {
        console.warn("[LogCleanup] Database not available, skipping cleanup");
        return;
    }

    const retentionDays = parseInt(process.env.LOG_RETENTION_DAYS || String(DEFAULT_RETENTION_DAYS));
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    console.log(`[LogCleanup] Starting cleanup for logs older than ${cutoffDate.toISOString()}`);

    try {
        // Delete old access logs
        const deletedAccessResult = await db
            .delete(accessLogs)
            .where(lt(accessLogs.createdAt, cutoffDate));

        const deletedAccessCount = (deletedAccessResult as any).rowsAffected || 0;

        // Delete old activity logs
        const deletedActivityResult = await db
            .delete(activityLogs)
            .where(lt(activityLogs.createdAt, cutoffDate));

        const deletedActivityCount = (deletedActivityResult as any).rowsAffected || 0;

        console.log(`[LogCleanup] ✅ Cleanup complete:`);
        console.log(`  - Access logs deleted: ${deletedAccessCount}`);
        console.log(`  - Activity logs deleted: ${deletedActivityCount}`);
        console.log(`  - Total deleted: ${deletedAccessCount + deletedActivityCount}`);

        return {
            success: true,
            accessLogsDeleted: deletedAccessCount,
            activityLogsDeleted: deletedActivityCount,
            cutoffDate: cutoffDate.toISOString()
        };
    } catch (error) {
        console.error("[LogCleanup] Failed to delete logs:", error);
        throw error;
    }
}
