import { z } from "zod";
import { leads } from "../../drizzle/schema";
import { getDb } from "../db";
import { permissionProcedure, router } from "../_core/trpc";
import { createBackup, restoreBackup, leadsToCSV, parseCSV, importLeadsFromCSV } from "../services/backup";
import { logAccess, getClientIp } from "../services/security";

export const backupRouter = router({
    createBackup: permissionProcedure("settings.manage")
        .mutation(async ({ ctx }) => {
            const backupData = await createBackup();

            // Calculate total records for UI feedback
            const count = Object.values(backupData.data).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);

            // Log the backup action
            await logAccess({
                userId: ctx.user?.id,
                action: "create_backup",
                ipAddress: getClientIp(ctx.req),
                userAgent: ctx.req.headers['user-agent'],
            });

            return { backup: backupData, count };
        }),

    restoreBackupJson: permissionProcedure("settings.manage")
        .input(z.object({
            backupJson: z.any(),
            mode: z.enum(["replace", "merge"]).default("replace"),
        }))
        .mutation(async ({ input, ctx }) => {
            const result = await restoreBackup(input.backupJson, input.mode);

            await logAccess({
                userId: ctx.user?.id,
                action: "restore_backup",
                metadata: { mode: input.mode, result },
                ipAddress: getClientIp(ctx.req),
                userAgent: ctx.req.headers['user-agent'],
            });

            return result;
        }),

    exportLeadsCSV: permissionProcedure("leads.view")
        .query(async () => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            const leadsData = await db.select().from(leads);
            const csvContent = leadsToCSV(leadsData);

            return { csv: csvContent, count: leadsData.length };
        }),

    importLeadsCSV: permissionProcedure("leads.create")
        .input(z.object({ csvContent: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const parsedData = parseCSV(input.csvContent);
            const result = await importLeadsFromCSV(parsedData);

            // Log the import action
            await logAccess({
                userId: ctx.user?.id,
                action: "import_leads_csv",
                metadata: { result },
                ipAddress: getClientIp(ctx.req),
                userAgent: ctx.req.headers['user-agent'],
            });

            return result;
        }),
});
