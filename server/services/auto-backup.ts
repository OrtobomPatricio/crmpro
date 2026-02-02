import cron from "node-cron";
import { createBackup } from "./backup";
import fs from "fs";
import path from "path";

/**
 * Automatic Backup Service
 * 
 * Creates daily backups of the entire database
 * Runs at 2:00 AM server time
 * Keeps only the last 7 backups by default
 */

const DEFAULT_RETENTION_COUNT = 7;

export function startAutoBackup() {
    const retentionCount = parseInt(process.env.BACKUP_RETENTION_COUNT || String(DEFAULT_RETENTION_COUNT));

    console.log("[AutoBackup] Starting automatic backup scheduler...");
    console.log(`[AutoBackup] Retention: ${retentionCount} backups`);

    // Run every day at 2 AM
    cron.schedule("0 2 * * *", async () => {
        try {
            await performAutoBackup();
        } catch (err) {
            console.error("[AutoBackup] Error during automatic backup:", err);
        }
    });

    console.log("[AutoBackup] Scheduler active - Daily execution at 02:00");
}

/**
 * Perform the actual backup and cleanup
 */
export async function performAutoBackup() {
    console.log("[AutoBackup] Starting daily backup...");

    try {
        // Create backup data (returns object, not path)
        const backupData = await createBackup();

        // Ensure backup directory exists
        const backupDir = path.join(process.cwd(), "backups");
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // Generate filename
        const filename = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        const backupPath = path.join(backupDir, filename);

        // Write to file
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

        console.log(`[AutoBackup] ✅ Backup created: ${backupPath}`);

        // Cleanup old backups
        await cleanupOldBackups();

        // TODO: Upload to S3/external storage if configured
        if (process.env.S3_BACKUP_BUCKET) {
            console.log("[AutoBackup] Uploading to S3...");
            await uploadBackupToS3(backupPath);
        }

        return {
            success: true,
            backupPath,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error("[AutoBackup] Failed to create backup:", error);
        throw error;
    }
}

/**
 * Remove old backups, keeping only the most recent ones
 */
async function cleanupOldBackups() {
    const retentionCount = parseInt(process.env.BACKUP_RETENTION_COUNT || String(DEFAULT_RETENTION_COUNT));
    const backupDir = path.join(process.cwd(), "backups");

    if (!fs.existsSync(backupDir)) {
        console.log("[AutoBackup] No backup directory found, skipping cleanup");
        return;
    }

    try {
        // Get all backup files sorted by date (newest first)
        const files = fs.readdirSync(backupDir)
            .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
            .map(f => ({
                name: f,
                path: path.join(backupDir, f),
                time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);

        // Keep only the most recent backups
        if (files.length > retentionCount) {
            const filesToDelete = files.slice(retentionCount);

            for (const file of filesToDelete) {
                fs.unlinkSync(file.path);
                console.log(`[AutoBackup] 🗑️  Deleted old backup: ${file.name}`);
            }

            console.log(`[AutoBackup] Cleanup complete. Kept ${retentionCount} backups, deleted ${filesToDelete.length}`);
        } else {
            console.log(`[AutoBackup] Cleanup skipped. Current backups: ${files.length}/${retentionCount}`);
        }
    } catch (error) {
        console.error("[AutoBackup] Error during cleanup:", error);
    }
}

/**
 * Upload backup to S3 (placeholder for future implementation)
 */
async function uploadBackupToS3(backupPath: string) {
    // TODO: Implement S3 upload using AWS SDK
    // const s3 = new AWS.S3();
    // const fileStream = fs.createReadStream(backupPath);
    // await s3.upload({
    //   Bucket: process.env.S3_BACKUP_BUCKET,
    //   Key: path.basename(backupPath),
    //   Body: fileStream
    // }).promise();

    console.log("[AutoBackup] S3 upload not yet implemented");
}
