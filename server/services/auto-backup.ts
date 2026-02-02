import cron from "node-cron";
import { createBackup } from "./backup";
import fs from "fs";
import path from "path";

export function startAutoBackup() {
    console.log("[AutoBackup] Starting daily backup scheduler...");

    // Run every day at 2 AM
    cron.schedule("0 2 * * *", async () => {
        try {
            const backupData = await createBackup();
            const backupDir = path.join(process.cwd(), "backups");

            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const filename = `backup-${timestamp}.json`;
            const backupPath = path.join(backupDir, filename);

            fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

            console.log(`[AutoBackup] Created backup: ${backupPath}`);

            // Keep only last 7 backups
            // The backupDir for cleanup is the same as where the new backup was written
            const files = fs.readdirSync(backupDir)
                .filter(f => f.startsWith('backup-'))
                .sort()
                .reverse();

            if (files.length > 7) {
                files.slice(7).forEach(f => {
                    try {
                        fs.unlinkSync(path.join(backupDir, f));
                        console.log(`[AutoBackup] Deleted old backup: ${f}`);
                    } catch (e) {
                        console.error(`[AutoBackup] Handled error deleting old backup ${f}:`, e);
                    }
                });
            }

            // TODO: Upload to S3 if configured
        } catch (err) {
            console.error("[AutoBackup] Error:", err);
        }
    });
}
