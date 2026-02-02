import { z } from "zod";
import { eq, desc, and, ne } from "drizzle-orm";
import { sessions } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const sessionsRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
        const db = await getDb();
        if (!db || !ctx.user) return [];

        const userSessions = await db.select({
            id: sessions.id,
            ipAddress: sessions.ipAddress,
            userAgent: sessions.userAgent,
            createdAt: sessions.createdAt,
            lastActivityAt: sessions.lastActivityAt,
            sessionToken: sessions.sessionToken,
        }).from(sessions)
            .where(eq(sessions.userId, ctx.user.id))
            .orderBy(desc(sessions.lastActivityAt));

        return userSessions.map(s => ({
            id: s.id,
            ipAddress: s.ipAddress,
            userAgent: s.userAgent,
            createdAt: s.createdAt,
            lastActivityAt: s.lastActivityAt,
            isCurrent: ctx.sessionJti ? s.sessionToken === ctx.sessionJti : false,
        }));
    }),

    revoke: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db || !ctx.user) return { success: false };

        await db.delete(sessions).where(and(eq(sessions.id, input.id), eq(sessions.userId, ctx.user.id)));
        return { success: true };
    }),

    revokeAllOthers: protectedProcedure.mutation(async ({ ctx }) => {
        const db = await getDb();
        if (!db || !ctx.user || !ctx.sessionJti) return { success: false };

        await db.delete(sessions).where(
            and(
                eq(sessions.userId, ctx.user.id),
                ne(sessions.sessionToken, ctx.sessionJti)
            )
        );
        return { success: true };
    }),
});
