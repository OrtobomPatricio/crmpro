import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import { conversations, chatMessages, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { permissionProcedure, router } from "../_core/trpc";

export const messagesRouter = router({
    getActiveStats: permissionProcedure("chat.view")
        .query(async () => {
            const db = await getDb();
            if (!db) return { activeConversations: 0, unansweredMessages: 0, avgResponseTime: 0 };

            // Active conversations (< 24 hours since last message)
            const activeConvs = await db
                .select({ count: sql<number>`COUNT(*)` })
                .from(conversations)
                .where(
                    and(
                        sql`${conversations.lastMessageAt} >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
                        eq(conversations.status, 'active')
                    )
                );

            const activeConversations = Number(activeConvs[0]?.count ?? 0);

            // Unanswered messages: inbound messages where no outbound reply exists after them
            const unansweredQuery = await db
                .select({ count: sql<number>`COUNT(DISTINCT ${chatMessages.conversationId})` })
                .from(chatMessages)
                .where(
                    and(
                        eq(chatMessages.direction, 'inbound'),
                        sql`NOT EXISTS (
                SELECT 1 FROM ${chatMessages} AS cm2
                WHERE cm2.conversationId = ${chatMessages.conversationId}
                  AND cm2.direction = 'outbound'
                  AND cm2.createdAt > ${chatMessages.createdAt}
              )`
                    )
                );

            const unansweredMessages = Number(unansweredQuery[0]?.count ?? 0);

            // Average response time (in minutes)
            // Calculate time difference between inbound message and first outbound response
            const avgResponseQuery = await db
                .select({
                    avgMinutes: sql<number>`AVG(
              TIMESTAMPDIFF(MINUTE, 
                (SELECT MIN(cm1.createdAt) 
                 FROM ${chatMessages} AS cm1 
                 WHERE cm1.conversationId = ${conversations.id} 
                   AND cm1.direction = 'inbound'),
                (SELECT MIN(cm2.createdAt) 
                 FROM ${chatMessages} AS cm2 
                 WHERE cm2.conversationId = ${conversations.id} 
                   AND cm2.direction = 'outbound'
                   AND cm2.createdAt > (
                     SELECT MIN(cm1.createdAt) 
                     FROM ${chatMessages} AS cm1 
                     WHERE cm1.conversationId = ${conversations.id} 
                       AND cm1.direction = 'inbound'
                   ))
              )
            )`
                })
                .from(conversations)
                .where(
                    and(
                        sql`${conversations.lastMessageAt} >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
                        eq(conversations.status, 'active')
                    )
                );

            const avgResponseTime = Math.round(Number(avgResponseQuery[0]?.avgMinutes ?? 0) * 10) / 10;

            return {
                activeConversations,
                unansweredMessages,
                avgResponseTime,
            };
        }),

    getAgentPerformance: permissionProcedure("monitoring.view")
        .input(z.object({
            dateRange: z.object({
                from: z.date().optional(),
                to: z.date().optional(),
            }).optional(),
        }).optional())
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) return { total: 0, agents: [] };

            // Default to last 30 days
            const fromDate = input?.dateRange?.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const toDate = input?.dateRange?.to ?? new Date();

            // Get total processed messages (outbound only)
            const totalQuery = await db
                .select({ count: sql<number>`COUNT(*)` })
                .from(chatMessages)
                .where(
                    and(
                        eq(chatMessages.direction, 'outbound'),
                        sql`${chatMessages.createdAt} >= ${fromDate}`,
                        sql`${chatMessages.createdAt} <= ${toDate}`
                    )
                );

            const total = Number(totalQuery[0]?.count ?? 0);

            // Get messages by agent (using assignedToId from conversations)
            const agentStats = await db
                .select({
                    userId: conversations.assignedToId,
                    userName: users.name,
                    messageCount: sql<number>`COUNT(${chatMessages.id})`,
                })
                .from(chatMessages)
                .innerJoin(conversations, eq(chatMessages.conversationId, conversations.id))
                .leftJoin(users, eq(conversations.assignedToId, users.id))
                .where(
                    and(
                        eq(chatMessages.direction, 'outbound'),
                        sql`${chatMessages.createdAt} >= ${fromDate}`,
                        sql`${chatMessages.createdAt} <= ${toDate}`,
                        sql`${conversations.assignedToId} IS NOT NULL`
                    )
                )
                .groupBy(conversations.assignedToId, users.name)
                .orderBy(desc(sql<number>`COUNT(${chatMessages.id})`));

            const agents = agentStats.map(stat => ({
                userId: stat.userId!,
                userName: stat.userName ?? 'Unknown',
                messageCount: Number(stat.messageCount),
                percentage: total > 0 ? Math.round((Number(stat.messageCount) / total) * 100) : 0,
            }));

            return {
                total,
                agents,
            };
        }),
});
