import cron from "node-cron";
import { getDb } from "../db";
import { accessLogs, activityLogs } from "../../drizzle/schema";
import { lt } from "drizzle-orm";

export function startLogCleanup() {
    console.log("[LogCleanup] Starting log retention worker...");

    // Run daily at 3 AM
    cron.schedule("0 3 * * *", async () => {
        try {
            const db = await getDb();
            if (!db) return;

            const retentionDays = 90; // Keep logs for 90 days
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            // Delete old access logs
            const deletedAccess = await db
                .delete(accessLogs)
                .where(lt(accessLogs.createdAt, cutoffDate));

            // Delete old activity logs
            const deletedActivity = await db
                .delete(activityLogs)
                .where(lt(activityLogs.createdAt, cutoffDate));

            // @ts-ignore - drizzle delete result structure might vary depending on driver
            const countAccess = deletedAccess.rowsAffected || deletedAccess.length || 0;
            // @ts-ignore
            const countActivity = deletedActivity.rowsAffected || deletedActivity.length || 0;

            console.log(`[LogCleanup] Deleted ${countAccess} access logs, ${countActivity} activity logs`);
        } catch (err) {
            console.error("[LogCleanup] Error:", err);
        }
    });
}
