import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import { accessLogs, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { permissionProcedure, router } from "../_core/trpc";

export const securityRouter = router({
    listAccessLogs: permissionProcedure("settings.view")
        .input(z.object({
            userId: z.number().optional(),
            action: z.string().optional(),
            limit: z.number().min(10).max(200).default(50),
            offset: z.number().default(0),
        }))
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) return [];

            let query = db.select().from(accessLogs).orderBy(desc(accessLogs.createdAt));

            // Apply filters
            const conditions = [];
            if (input.userId) conditions.push(eq(accessLogs.userId, input.userId));
            if (input.action) conditions.push(eq(accessLogs.action, input.action));

            if (conditions.length > 0) {
                query = query.where(and(...conditions)) as any;
            }

            const results = await query.limit(input.limit).offset(input.offset);

            // Join with user names
            const userIds = Array.from(new Set(results.map(r => r.userId).filter(Boolean))) as number[];
            const usersList = userIds.length > 0
                ? await db.select().from(users).where(sql`${users.id} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`)
                : [];

            const usersMap = new Map(usersList.map(u => [u.id, u.name]));

            return results.map(log => ({
                ...log,
                userName: log.userId ? usersMap.get(log.userId) : null,
            }));
        }),
});
