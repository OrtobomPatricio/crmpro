import { z } from "zod";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { users } from "../../drizzle/schema";
import { getDb } from "../db";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { sdk } from "../_core/sdk";
import { getSessionCookieOptions } from "../_core/cookies";
import { sendEmail } from "../_core/email";
import { getClientIp } from "../services/security";

export const authRouter = router({
    me: publicProcedure.query(opts => {
        const u = opts.ctx.user;
        if (!u) return null;
        return {
            id: u.id,
            openId: u.openId,
            name: u.name,
            email: u.email,
            role: u.role,
            customRole: (u as any).customRole,
            loginMethod: u.loginMethod,
            isActive: u.isActive,
            hasSeenTour: u.hasSeenTour,
        };
    }),

    logout: publicProcedure.mutation(async ({ ctx }) => {
        const token = ctx.req.cookies[COOKIE_NAME];
        if (token) {
            await sdk.revokeSession(token);
        }
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
        return { success: true } as const;
    }),

    markTourSeen: protectedProcedure.mutation(async ({ ctx }) => {
        const db = await getDb();
        if (!db || !ctx.user) return { success: false };

        await db.update(users)
            .set({ hasSeenTour: true })
            .where(eq(users.id, ctx.user.id));

        return { success: true };
    }),

    loginWithCredentials: publicProcedure
        .input(z.object({ email: z.string().email(), password: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) return { success: false, error: "Database not available" };

            const user = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
            if (!user[0] || !user[0].password) {
                return { success: false, error: "Invalid credentials" };
            }

            const valid = await bcrypt.compare(input.password, user[0].password);
            if (!valid) {
                return { success: false, error: "Invalid credentials" };
            }

            const sessionToken = await sdk.createSessionToken(user[0].openId, {
                name: user[0].name || "",
                expiresInMs: ONE_YEAR_MS,
                ipAddress: getClientIp(ctx.req),
                userAgent: (ctx.req.headers["user-agent"] as string),
            });

            const cookieOptions = getSessionCookieOptions(ctx.req);
            ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

            await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user[0].id));

            return { success: true };
        }),

    acceptInvitation: publicProcedure
        .input(z.object({ token: z.string(), password: z.string().min(6) }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            const user = await db.select().from(users).where(eq(users.invitationToken, input.token)).limit(1);
            if (!user[0]) throw new Error("Invalid token");

            if (user[0].invitationExpires && new Date() > user[0].invitationExpires) {
                throw new Error("Token expired");
            }

            const hashedPassword = await bcrypt.hash(input.password, 10);

            await db.update(users)
                .set({
                    password: hashedPassword,
                    invitationToken: null,
                    invitationExpires: null,
                    isActive: true,
                    loginMethod: 'credentials'
                })
                .where(eq(users.id, user[0].id));

            return { success: true };
        }),
});
