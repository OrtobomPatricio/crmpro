import { z } from "zod";
import { eq } from "drizzle-orm";
import { goals, achievements } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const gamificationRouter = router({
    achievements: router({
        list: protectedProcedure.query(async ({ ctx }) => {
            const db = await getDb();
            if (!db || !ctx.user) return [];
            return db.select().from(achievements).where(eq(achievements.userId, ctx.user.id));
        }),

        unlock: protectedProcedure
            .input(z.object({ type: z.string(), metadata: z.any().optional() }))
            .mutation(async ({ input, ctx }) => {
                const db = await getDb();
                if (!db || !ctx.user) return { success: false };
                await db.insert(achievements).values({
                    userId: ctx.user.id,
                    type: input.type,
                    metadata: input.metadata,
                });
                return { success: true };
            }),
    }),

    goals: router({
        list: protectedProcedure.query(async ({ ctx }) => {
            const db = await getDb();
            if (!db || !ctx.user) return [];
            return db.select().from(goals).where(eq(goals.userId, ctx.user.id));
        }),

        create: protectedProcedure
            .input(z.object({
                type: z.enum(["sales_amount", "deals_closed", "leads_created", "messages_sent"]),
                targetAmount: z.number(),
                period: z.enum(["daily", "weekly", "monthly"]),
                startDate: z.string().transform(s => new Date(s)),
                endDate: z.string().transform(s => new Date(s)),
            }))
            .mutation(async ({ input, ctx }) => {
                const db = await getDb();
                if (!db || !ctx.user) return { success: false };
                await db.insert(goals).values({
                    userId: ctx.user.id,
                    type: input.type,
                    targetAmount: input.targetAmount,
                    period: input.period,
                    startDate: input.startDate,
                    endDate: input.endDate,
                });
                return { success: true };
            }),

        updateProgress: protectedProcedure
            .input(z.object({ id: z.number(), amount: z.number() }))
            .mutation(async ({ input, ctx }) => {
                const db = await getDb();
                if (!db) return { success: false };
                await db.update(goals)
                    .set({ currentAmount: input.amount })
                    .where(eq(goals.id, input.id));
                return { success: true };
            }),
    }),
});
