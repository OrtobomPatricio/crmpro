import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { workflows } from "../../drizzle/schema";
import { getDb } from "../db";
import { permissionProcedure, router } from "../_core/trpc";

export const workflowsRouter = router({
    list: permissionProcedure("campaigns.view").query(async () => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(workflows).orderBy(desc(workflows.createdAt));
    }),

    create: permissionProcedure("campaigns.manage")
        .input(z.object({
            name: z.string().min(1),
            description: z.string().optional(),
            triggerType: z.enum(["lead_created", "lead_updated", "msg_received", "campaign_link_clicked"]),
            triggerConfig: z.any().optional(),
            actions: z.array(z.any()).optional(),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            const result = await db.insert(workflows).values({
                ...input,
                isActive: true
            });
            return { success: true, id: result[0].insertId };
        }),

    update: permissionProcedure("campaigns.manage")
        .input(z.object({
            id: z.number(),
            name: z.string().optional(),
            description: z.string().optional(),
            triggerType: z.enum(["lead_created", "lead_updated", "msg_received", "campaign_link_clicked"]).optional(),
            triggerConfig: z.any().optional(),
            actions: z.array(z.any()).optional(),
            isActive: z.boolean().optional(),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("DB error");

            await db.update(workflows).set(input).where(eq(workflows.id, input.id));
            return { success: true };
        }),

    toggle: permissionProcedure("campaigns.manage")
        .input(z.object({ id: z.number(), isActive: z.boolean() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");
            await db.update(workflows).set({ isActive: input.isActive }).where(eq(workflows.id, input.id));
            return { success: true };
        }),

    delete: permissionProcedure("campaigns.manage")
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");
            await db.delete(workflows).where(eq(workflows.id, input.id));
            return { success: true };
        }),
});
