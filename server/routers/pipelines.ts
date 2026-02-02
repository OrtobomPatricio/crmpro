import { z } from "zod";
import { eq, asc, and, sql, inArray } from "drizzle-orm";
import { pipelines, pipelineStages } from "../../drizzle/schema";
import { getDb } from "../db";
import { permissionProcedure, router } from "../_core/trpc";

export const pipelinesRouter = router({
    list: permissionProcedure("kanban.view").query(async () => {
        const db = await getDb();
        if (!db) return [];

        let allPipelines = await db.select().from(pipelines);

        // Auto-create default pipeline if none exists
        if (allPipelines.length === 0) {
            const result = await db.insert(pipelines).values({
                name: "Pipeline por defecto",
                isDefault: true,
            });
            const pipelineId = result[0].insertId;

            // Default stages mapping old statuses
            const defaults = [
                { name: "Nuevo", color: "#dbeafe", type: "open", order: 0 },       // blue-100
                { name: "Contactado", color: "#fef9c3", type: "open", order: 1 },  // yellow-100
                { name: "Calificado", color: "#f3e8ff", type: "open", order: 2 },  // purple-100
                { name: "Negociación", color: "#e0e7ff", type: "open", order: 3 }, // indigo-100
                { name: "Ganado", color: "#dcfce7", type: "won", order: 4 },       // green-100
                { name: "Perdido", color: "#fee2e2", type: "lost", order: 5 },     // red-100
            ];

            for (const s of defaults) {
                await db.insert(pipelineStages).values({
                    pipelineId,
                    name: s.name,
                    color: s.color,
                    type: s.type as any,
                    order: s.order,
                });
            }

            allPipelines = await db.select().from(pipelines);
        }

        const allStages = await db.select().from(pipelineStages).orderBy(asc(pipelineStages.order));

        return allPipelines.map(p => ({
            ...p,
            stages: allStages.filter(s => s.pipelineId === p.id)
        }));
    }),

    create: permissionProcedure("kanban.manage")
        .input(z.object({ name: z.string().min(1) }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            const result = await db.insert(pipelines).values({ name: input.name });
            const pipelineId = result[0].insertId;

            // Add default stages for new pipelines too? Or empty? Let's add standard ones
            const defaults = [
                { name: "Nuevo", color: "#e2e8f0", order: 0 },
                { name: "En Proceso", color: "#fef9c3", order: 1 },
                { name: "Ganado", color: "#dcfce7", type: "won", order: 2 },
                { name: "Perdido", color: "#fee2e2", type: "lost", order: 3 },
            ];

            for (const s of defaults) {
                await db.insert(pipelineStages).values({
                    pipelineId,
                    name: s.name,
                    color: s.color,
                    type: (s.type as any) || "open",
                    order: s.order,
                });
            }

            return { success: true, id: pipelineId };
        }),

    updateStage: permissionProcedure("kanban.manage")
        .input(z.object({
            id: z.number(),
            name: z.string().optional(),
            color: z.string().optional(),
            order: z.number().optional(),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("DB error");
            await db.update(pipelineStages).set(input).where(eq(pipelineStages.id, input.id));
            return { success: true };
        }),

    createStage: permissionProcedure("kanban.manage")
        .input(z.object({
            pipelineId: z.number(),
            name: z.string().min(1),
            color: z.string().default("#e2e8f0"),
            order: z.number().default(0),
            type: z.enum(["open", "won", "lost"]).default("open"),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("DB error");
            await db.insert(pipelineStages).values(input);
            return { success: true };
        }),

    deleteStage: permissionProcedure("kanban.manage")
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("DB error");

            // Optional: Check if leads exist? Schema says ON DELETE SET NULL, so it's safe.
            // But maybe we want to warn? For now, just delete.
            await db.delete(pipelineStages).where(eq(pipelineStages.id, input.id));
            return { success: true };
        }),

    reorderStages: permissionProcedure("kanban.manage")
        .input(z.object({
            pipelineId: z.number(),
            orderedStageIds: z.array(z.number()),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("DB error");

            const ids = input.orderedStageIds;
            if (ids.length === 0) return { success: true };

            const caseExpr = sql`CASE ${pipelineStages.id} ${sql.join(ids.map((id, idx) => sql`WHEN ${id} THEN ${idx}`), sql` `)} END`;

            await db.update(pipelineStages)
                .set({ order: caseExpr } as any)
                .where(and(
                    eq(pipelineStages.pipelineId, input.pipelineId),
                    inArray(pipelineStages.id, ids)
                ));

            return { success: true };
        }),
});
