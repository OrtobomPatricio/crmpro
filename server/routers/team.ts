import { z } from "zod";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { eq, desc } from "drizzle-orm";
import { users, appSettings } from "../../drizzle/schema";
import { getDb } from "../db";
import { permissionProcedure, router } from "../_core/trpc";
import { sendEmail } from "../_core/email";

export const teamRouter = router({
    listUsers: permissionProcedure("users.view").query(async () => {
        const db = await getDb();
        if (!db) return [];

        return db.select({
            id: users.id,
            openId: users.openId,
            name: users.name,
            email: users.email,
            role: users.role,
            customRole: users.customRole,
            isActive: users.isActive,
            createdAt: users.createdAt,
            lastSignedIn: users.lastSignedIn,
        }).from(users).orderBy(desc(users.createdAt));
    }),

    updateRole: permissionProcedure("users.manage")
        .input(z.object({ userId: z.number(), role: z.enum(["owner", "admin", "supervisor", "agent", "viewer"]) }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            // Only owner can assign owner role
            if (input.role === "owner" && (ctx.user as any).role !== "owner") {
                throw new Error("Only owner can assign owner");
            }

            // Nobody can downgrade owner except owner itself
            const target = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
            if (target[0]?.role === "owner" && (ctx.user as any).role !== "owner") {
                throw new Error("Only owner can change another owner");
            }

            await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
            return { success: true } as const;
        }),

    updateCustomRole: permissionProcedure("users.manage")
        .input(z.object({ userId: z.number(), customRole: z.string().max(64).optional().nullable() }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            // Protect owner (only owner can change another owner)
            const target = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
            if (target[0]?.role === "owner" && (ctx.user as any).role !== "owner") {
                throw new Error("Only owner can change another owner");
            }

            const value = input.customRole ? input.customRole.trim() : null;
            if (value === "owner") throw new Error("Forbidden role"); // BLOCK OWNER ESCALATION

            // Validate customRole (blocks reserved roles + checks matrix)
            if (value) {
                const settings = await db.select().from(appSettings).limit(1);
                const matrix = settings[0]?.permissionsMatrix ?? {};
                if (!Object.prototype.hasOwnProperty.call(matrix, value)) {
                    throw new Error("Role does not exist in permissions matrix");
                }
            }

            await db.update(users).set({ customRole: value }).where(eq(users.id, input.userId));
            return { success: true } as const;
        }),

    setActive: permissionProcedure("users.manage")
        .input(z.object({ userId: z.number(), isActive: z.boolean() }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            const target = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
            if (target[0]?.role === "owner" && (ctx.user as any).role !== "owner") {
                throw new Error("Only owner can disable owner");
            }

            await db.update(users).set({ isActive: input.isActive }).where(eq(users.id, input.userId));
            return { success: true } as const;
        }),

    create: permissionProcedure("users.manage")
        .input(z.object({
            name: z.string().min(1),
            email: z.string().email(),
            password: z.string().min(6), // Password required for manual creation
            role: z.enum(["admin", "supervisor", "agent", "viewer"]), // Owner cannot be created this way
        }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            // Check if email already exists
            const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
            if (existing.length > 0) {
                throw new Error("User with this email already exists");
            }

            const hashedPassword = await bcrypt.hash(input.password, 10);
            const openId = `local_${nanoid(16)}`; // Generate unique openId for local users

            const result = await db.insert(users).values({
                openId,
                name: input.name,
                email: input.email,
                password: hashedPassword,
                role: input.role,
                loginMethod: "credentials",
                isActive: true,
                hasSeenTour: false,
            });

            return { id: result[0].insertId, success: true };
        }),

    invite: permissionProcedure("users.manage")
        .input(z.object({
            name: z.string().min(1),
            email: z.string().email(),
            role: z.enum(["admin", "supervisor", "agent", "viewer"]),
        }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
            if (existing.length > 0) {
                throw new Error("User already exists");
            }

            const token = nanoid(32);
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

            const openId = `invite_${nanoid(16)}`;

            await db.insert(users).values({
                openId,
                name: input.name,
                email: input.email,
                role: input.role,
                isActive: true,
                invitationToken: token,
                invitationExpires: expiresAt,
                loginMethod: "credentials",
            });

            const baseUrl = process.env.VITE_API_URL || "http://localhost:3000";
            const inviteLink = `${baseUrl}/setup-account?token=${token}`;

            await sendEmail({
                to: input.email,
                subject: "Welcome to Imagine CRM - Setup your account",
                html: `
            <h3>Hello ${input.name}!</h3>
            <p>You have been invited to join Imagine CRM as a <strong>${input.role}</strong>.</p>
            <p>Click the link below to set your password and access the system:</p>
            <a href="${inviteLink}">${inviteLink}</a>
            <p>This link expires in 24 hours.</p>
          `,
            });

            return { success: true };
        }),

    delete: permissionProcedure("users.manage")
        .input(z.object({ userId: z.number() }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            // Get target user
            const target = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
            if (!target[0]) throw new Error("User not found");

            // Prevent deleting owner (only owner can delete owner accounts)
            if (target[0].role === "owner" && (ctx.user as any).role !== "owner") {
                throw new Error("Only owner can delete another owner");
            }

            // Prevent self-deletion
            if (target[0].id === (ctx.user as any).id) {
                throw new Error("Cannot delete yourself");
            }

            // Delete user
            await db.delete(users).where(eq(users.id, input.userId));
            return { success: true };
        }),
});
