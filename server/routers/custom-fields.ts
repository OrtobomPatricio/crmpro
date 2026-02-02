import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { customFieldDefinitions } from "../../drizzle/schema";
import { getDb } from "../db";
import { permissionProcedure, router } from "../_core/trpc";

export const customFieldsRouter = router({
    list: permissionProcedure("leads.view").query(async () => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(customFieldDefinitions).orderBy(asc(customFieldDefinitions.order));
    }),

    create: permissionProcedure("settings.manage")
        .input(z.object({
            name: z.string().min(1),
            type: z.enum(["text", "number", "date", "select", "checkbox"]),
            options: z.array(z.string()).optional(),
            entityType: z.enum(["lead", "contact", "company"]).default("lead"),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");
            await db.insert(customFieldDefinitions).values(input);
            return { success: true };
        }),

    update: permissionProcedure("settings.manage")
        .input(z.object({
            id: z.number(),
            name: z.string().min(1).optional(),
            type: z.enum(["text", "number", "date", "select", "checkbox"]).optional(),
            options: z.array(z.string()).optional(),
            entityType: z.enum(["lead", "contact", "company"]).optional(),
            isRequired: z.boolean().optional(),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");
            const { id, ...data } = input;
            await db.update(customFieldDefinitions).set(data).where(eq(customFieldDefinitions.id, id));
            return { success: true };
        }),

    delete: permissionProcedure("settings.manage")
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");
            await db.delete(customFieldDefinitions).where(eq(customFieldDefinitions.id, input.id));
            return { success: true };
        }),
});
