import { z } from "zod";
import { eq, asc, and, sql } from "drizzle-orm";
import { internalMessages, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const internalChatRouter = router({
    send: protectedProcedure
        .input(z.object({
            content: z.string().min(1),
            recipientId: z.number().optional().nullable(), // Null = General
            attachments: z.array(z.object({
                type: z.enum(['image', 'video', 'file']),
                url: z.string(),
                name: z.string()
            })).optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db || !ctx.user) throw new Error("Database not available");

            await db.insert(internalMessages).values({
                senderId: ctx.user.id,
                recipientId: input.recipientId ?? null,
                content: input.content,
                attachments: input.attachments,
            });

            return { success: true };
        }),

    getHistory: protectedProcedure
        .input(z.object({
            recipientId: z.number().optional().nullable(), // Null = General
        }))
        .query(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db || !ctx.user) return [];

            if (!input.recipientId) {
                // General channel: fetch all messages where recipientId is null
                const msgs = await db.select({
                    id: internalMessages.id,
                    content: internalMessages.content,
                    attachments: internalMessages.attachments,
                    createdAt: internalMessages.createdAt,
                    senderId: internalMessages.senderId,
                    senderName: users.name,
                })
                    .from(internalMessages)
                    .leftJoin(users, eq(internalMessages.senderId, users.id))
                    .where(sql`${internalMessages.recipientId} IS NULL`)
                    .orderBy(asc(internalMessages.createdAt))
                    .limit(100);

                return msgs;
            } else {
                // Direct Message: fetch messages between me and recipient (both directions)
                const msgs = await db.select({
                    id: internalMessages.id,
                    content: internalMessages.content,
                    attachments: internalMessages.attachments,
                    createdAt: internalMessages.createdAt,
                    senderId: internalMessages.senderId,
                    senderName: users.name,
                })
                    .from(internalMessages)
                    .leftJoin(users, eq(internalMessages.senderId, users.id))
                    .where(
                        and(
                            sql`(${internalMessages.senderId} = ${ctx.user.id} AND ${internalMessages.recipientId} = ${input.recipientId}) OR (${internalMessages.senderId} = ${input.recipientId} AND ${internalMessages.recipientId} = ${ctx.user.id})`
                        )
                    )
                    .orderBy(asc(internalMessages.createdAt))
                    .limit(100);

                return msgs;
            }
        }),

    // Mark messages as read from a specific sender (or general channel)
    markAsRead: protectedProcedure
        .input(z.object({
            senderId: z.number().optional().nullable(), // Null = General channel updates
        }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db || !ctx.user) return { success: false };

            if (!input.senderId) {
                // Mark general channel messages as read? 
                // Actually, for General channel, it's harder to track "read" per user without a separate table "MessageReadStatus".
                // For now, we will only track Direct Message read status.
                // If we want to track General, we need a many-to-many table (User <-> Message).
                // Let's skip General channel read status for now to keep schema simple, or just client-side local storage.
                return { success: true };
            } else {
                // Mark all messages FROM senderId TO me as read
                await db.update(internalMessages)
                    .set({ isRead: true })
                    .where(
                        and(
                            eq(internalMessages.senderId, input.senderId),
                            eq(internalMessages.recipientId, ctx.user.id),
                            eq(internalMessages.isRead, false)
                        )
                    );
            }
            return { success: true };
        }),

    getRecentChats: protectedProcedure.query(async ({ ctx }) => {
        const db = await getDb();
        if (!db || !ctx.user) return [];

        const allUsers = await db.select({
            id: users.id,
            name: users.name,
            role: users.role,
            isActive: users.isActive
        }).from(users).where(eq(users.isActive, true));

        // Get unread counts for each user
        // We can do this efficiently with a groupBy query
        const unreadCounts = await db.select({
            senderId: internalMessages.senderId,
            count: sql<number>`count(*)`
        })
            .from(internalMessages)
            .where(
                and(
                    eq(internalMessages.recipientId, ctx.user.id), // Sent to me
                    eq(internalMessages.isRead, false) // Not read
                )
            )
            .groupBy(internalMessages.senderId);

        const unreadMap = new Map<number, number>();
        unreadCounts.forEach(r => unreadMap.set(r.senderId, Number(r.count)));

        return allUsers
            .filter(u => u.id !== ctx.user?.id)
            .map(u => ({
                ...u,
                unreadCount: unreadMap.get(u.id) || 0
            }))
            .sort((a, b) => (b.unreadCount - a.unreadCount)); // Sort by unread first
    }),
});
