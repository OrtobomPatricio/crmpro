import { z } from "zod";
import { getDb } from "../db";
import { smtpConnections } from "../../drizzle/schema";
import { permissionProcedure, router } from "../_core/trpc";
import { verifySmtpConnection, sendEmail } from "../_core/email";
import { eq } from "drizzle-orm";
import { encryptSecret } from "../_core/crypto";

export const smtpRouter = router({
    list: permissionProcedure("settings.view")
        .query(async () => {
            const db = await getDb();
            if (!db) return [];
            return await db.select().from(smtpConnections).orderBy(smtpConnections.createdAt);
        }),

    create: permissionProcedure("settings.manage")
        .input(z.object({
            name: z.string().min(1).max(100),
            host: z.string().min(1).max(255),
            port: z.number().int().min(1).max(65535),
            secure: z.boolean(),
            user: z.string().min(1).max(255),
            password: z.string().min(1),
            fromEmail: z.string().email().optional(),
            fromName: z.string().max(100).optional(),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            // TODO: Encrypt password before storing. For now assuming input is raw?
            // Actually best practice is to encrypt immediately.
            // Let's encrypt it.
            const encryptedPass = encryptSecret(input.password);

            const [result] = await db.insert(smtpConnections).values({
                ...input,
                password: encryptedPass, // Storing encrypted
                isActive: true,
                isDefault: false,
                testStatus: "untested",
            }).$returningId();

            return { success: true, id: result.id };
        }),

    delete: permissionProcedure("settings.manage")
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) return { success: false };

            await db.delete(smtpConnections).where(eq(smtpConnections.id, input.id));
            return { success: true };
        }),

    test: permissionProcedure("settings.manage")
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            const [connection] = await db
                .select()
                .from(smtpConnections)
                .where(eq(smtpConnections.id, input.id))
                .limit(1);

            if (!connection) throw new Error("Connection not found");

            try {
                // Decrypt if necessary, but verifySmtpConnection likely expects raw pass?
                // The previous code passed `connection.password`. If it was encrypted, it would fail.
                // In `create` above I added encryption.
                // So I must decrypt here.
                // BUT: `security-helpers` or `email.ts` might handle decryption?
                // Looking at email.ts: `verifySmtpConnection` takes { pass: string }.
                // So we must decrypt.
                // IMPORTANT: If legacy passwords are plain text, decrypt might fail or return null?
                // `decryptSecret` handles some legacy? Or we assume encrypted.
                // Let's try decrypt, fallback to raw.

                let pass = connection.password || "";
                try {
                    const decrypted = await import("../_core/crypto").then(m => m.decryptSecret(pass));
                    if (decrypted) pass = decrypted;
                } catch (e) {
                    // ignore, maybe plain text
                }

                // Test connection using the verifySmtpConnection function
                await verifySmtpConnection({
                    host: connection.host,
                    port: connection.port,
                    secure: connection.secure,
                    user: connection.user,
                    pass: pass,
                });

                // Update test status
                await db
                    .update(smtpConnections)
                    .set({ testStatus: "success", lastTested: new Date() })
                    .where(eq(smtpConnections.id, input.id));

                return { success: true, status: "success" };
            } catch (error) {
                await db
                    .update(smtpConnections)
                    .set({ testStatus: "failed", lastTested: new Date() })
                    .where(eq(smtpConnections.id, input.id));

                throw new Error(`Test failed: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
        }),

    setDefault: permissionProcedure("settings.manage")
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) return { success: false };

            // Unset all defaults first
            await db.update(smtpConnections).set({ isDefault: false });

            // Set this one as default
            await db
                .update(smtpConnections)
                .set({ isDefault: true })
                .where(eq(smtpConnections.id, input.id));

            return { success: true };
        }),

    verifySmtpTest: permissionProcedure("settings.manage")
        .input(z.object({ email: z.string().email() }))
        .mutation(async ({ input }) => {
            const sent = await sendEmail({
                to: input.email,
                subject: "Test SMTP Connection - Imagine CRM",
                html: "<p>If you see this, your SMTP configuration is working correctly! 🚀</p>",
            });
            if (!sent) throw new Error("Failed to send email. Check server logs.");
            return { success: true };
        }),
});
