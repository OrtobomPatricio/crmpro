import { z } from "zod";
import { eq, desc, asc, and, sql, inArray } from "drizzle-orm";
import { leads, pipelines, pipelineStages, whatsappNumbers, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { permissionProcedure, protectedProcedure, router } from "../_core/trpc";
import { dispatchIntegrationEvent } from "../_core/integrationDispatch";
import { leadsToCSV, parseCSV, importLeadsFromCSV } from "../services/backup";

export const leadsRouter = router({
    search: protectedProcedure
        .input(z.object({
            query: z.string().min(1),
            limit: z.number().default(10)
        }))
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) return [];

            const term = `%${input.query}%`;
            return db.select({
                id: leads.id,
                name: leads.name,
                phone: leads.phone,
                email: leads.email
            })
                .from(leads)
                .where(sql`(${leads.name} LIKE ${term} OR ${leads.phone} LIKE ${term})`)
                .limit(input.limit);
        }),

    list: permissionProcedure("leads.view")
        .input(z.object({
            pipelineStageId: z.number().optional(),
            limit: z.number().min(1).max(100).default(50),
            offset: z.number().min(0).default(0),
        }).optional())
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) return [];

            let query = db.select().from(leads);

            if (input?.pipelineStageId) {
                query = query.where(eq(leads.pipelineStageId, input.pipelineStageId)) as typeof query;
            }

            return query
                .orderBy(desc(leads.createdAt))
                .limit(input?.limit ?? 50)
                .offset(input?.offset ?? 0);
        }),

    getById: permissionProcedure("leads.view")
        .input(z.object({ id: z.number() }))
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) return null;

            const result = await db.select()
                .from(leads)
                .where(eq(leads.id, input.id))
                .limit(1);

            return result[0] ?? null;
        }),

    create: permissionProcedure("leads.create")
        .input(z.object({
            name: z.string().min(1),
            phone: z.string().min(1),
            email: z.string().email().optional(),
            country: z.string().min(1),
            source: z.string().optional(),
            notes: z.string().optional(),
            pipelineStageId: z.number().optional(),
            customFields: z.record(z.string(), z.any()).optional(),
            value: z.number().optional(), // Deal value
        }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            // IDEMPOTENCY: Check if lead with this phone already exists
            const existingLead = await db.select().from(leads).where(eq(leads.phone, input.phone)).limit(1);
            if (existingLead[0]) {
                // Return existing lead instead of creating duplicate
                return { id: existingLead[0].id, success: true, existed: true };
            }

            // Resolve pipeline stage (fallback to default pipeline's first stage)
            let stageId: number | null = (input.pipelineStageId as any) ?? null;
            if (!stageId) {
                const p = await db.select().from(pipelines).where(eq(pipelines.isDefault, true)).limit(1);
                const pipeline = p[0];
                if (pipeline) {
                    const s = await db.select().from(pipelineStages).where(eq(pipelineStages.pipelineId, pipeline.id)).orderBy(asc(pipelineStages.order)).limit(1);
                    stageId = s[0]?.id ?? null;
                }
            }

            // Determine next Kanban order in that stage
            let nextOrder = 0;
            if (stageId) {
                const maxRows = await db.select({ max: sql<number>`max(${leads.kanbanOrder})` }).from(leads).where(eq(leads.pipelineStageId, stageId));
                nextOrder = ((maxRows[0] as any)?.max ?? 0) + 1;
            }

            // Default WhatsApp number to associate integrations/webhooks & future conversations
            const defaultNumber = await db.select({ id: whatsappNumbers.id }).from(whatsappNumbers).limit(1);
            const defaultWhatsappNumberId = defaultNumber[0]?.id ?? null;

            // Calculate commission
            const commission = input.country.toLowerCase() === 'panamá' || input.country.toLowerCase() === 'panama'
                ? '10000.00'
                : '5000.00';

            const result = await db.insert(leads).values({
                ...input,
                value: input.value ? input.value.toString() : "0.00",
                commission,
                assignedToId: ctx.user?.id,
                whatsappNumberId: defaultWhatsappNumberId as any,
                pipelineStageId: stageId as any,
                kanbanOrder: nextOrder as any,
            });

            const newLeadId = result[0].insertId;

            if (defaultWhatsappNumberId) {
                void dispatchIntegrationEvent({
                    whatsappNumberId: defaultWhatsappNumberId,
                    event: "lead_created",
                    data: { id: newLeadId, ...input, assignedToId: ctx.user?.id },
                });
            }

            return { id: newLeadId, success: true };
        }),

    export: permissionProcedure("leads.export")
        .query(async () => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");
            const allLeads = await db.select().from(leads);
            const csv = leadsToCSV(allLeads);
            return { csv };
        }),

    import: permissionProcedure("leads.import")
        .input(z.object({ csvContent: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");
            const parsed = parseCSV(input.csvContent);
            const result = await importLeadsFromCSV(parsed);
            return result;
        }),

    update: permissionProcedure("leads.update")
        .input(z.object({
            id: z.number(),
            name: z.string().min(1).optional(),
            phone: z.string().min(1).optional(),
            email: z.string().email().optional().nullable(),
            country: z.string().min(1).optional(),
            source: z.string().optional().nullable(),
            notes: z.string().optional().nullable(),
            pipelineStageId: z.number().optional(),
            customFields: z.record(z.string(), z.any()).optional(),
            value: z.number().optional(),
            assignedToId: z.number().optional().nullable(),
        }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            // CHECK ASSIGN PERMISSION
            if (input.assignedToId !== undefined) {
                const { computeEffectiveRole } = await import("../_core/rbac");
                const userRole = (ctx.user as any).role || "agent";
                const userCustomRole = (ctx.user as any).customRole;
                const { getOrCreateAppSettings } = await import("../services/app-settings");
                const settings = await getOrCreateAppSettings(db);
                const matrix = settings.permissionsMatrix || {};
                const role = computeEffectiveRole({ baseRole: userRole, customRole: userCustomRole, permissionsMatrix: matrix });

                // Check if user has explicit assignment permission
                const hasAssign = role === "owner" || role === "admin" || (matrix[role] && (matrix[role].includes("*") || matrix[role].includes("leads.*") || matrix[role].includes("leads.assign")));

                if (!hasAssign) {
                    throw new Error("No tienes permisos para reasignar leads (leads.assign)");
                }
            }

            const { id, ...data } = input;

            // If stage is changed via update, move it to the end of that stage by default
            if (data.pipelineStageId) {
                const maxRows = await db.select({ max: sql<number>`max(${leads.kanbanOrder})` }).from(leads).where(eq(leads.pipelineStageId, data.pipelineStageId));
                const nextOrder = ((maxRows[0] as any)?.max ?? 0) + 1;
                (data as any).kanbanOrder = nextOrder;
            }

            if (data.country) {
                (data as Record<string, unknown>).commission = data.country.toLowerCase() === 'panamá' || data.country.toLowerCase() === 'panama'
                    ? '10000.00'
                    : '5000.00';
            }

            if (data.value !== undefined) {
                (data as any).value = data.value.toString();
            }

            await db.update(leads)
                .set(data as any)
                .where(eq(leads.id, id));

            // Fire integration webhook (best-effort)
            const updated = await db.select({ whatsappNumberId: leads.whatsappNumberId }).from(leads).where(eq(leads.id, id)).limit(1);
            const waId = updated[0]?.whatsappNumberId as number | null | undefined;
            if (waId) {
                void dispatchIntegrationEvent({
                    whatsappNumberId: waId,
                    event: "lead_updated",
                    data: { id, ...data, updatedById: ctx.user?.id },
                });
            }

            return { success: true };
        }),

    updateStatus: permissionProcedure("leads.update")
        .input(z.object({
            id: z.number(),
            // Support both for backward compatibility or refactor
            pipelineStageId: z.number(),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            // Move to end of stage by default
            const maxRows = await db.select({ max: sql<number>`max(${leads.kanbanOrder})` }).from(leads).where(eq(leads.pipelineStageId, input.pipelineStageId));
            const nextOrder = ((maxRows[0] as any)?.max ?? 0) + 1;

            await db.update(leads)
                .set({ pipelineStageId: input.pipelineStageId, kanbanOrder: nextOrder } as any)
                .where(eq(leads.id, input.id));

            const updated = await db.select({ whatsappNumberId: leads.whatsappNumberId }).from(leads).where(eq(leads.id, input.id)).limit(1);
            const whatsappNumberId = updated[0]?.whatsappNumberId;
            if (whatsappNumberId) {
                void dispatchIntegrationEvent({
                    whatsappNumberId,
                    event: "lead_updated",
                    data: { id: input.id, pipelineStageId: input.pipelineStageId },
                });
            }

            return { success: true };
        }),

    reorderKanban: permissionProcedure("kanban.update")
        .input(z.object({
            pipelineStageId: z.number(),
            orderedLeadIds: z.array(z.number()).min(0),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            const ids = (input.orderedLeadIds ?? []).filter(Boolean);
            if (ids.length === 0) return { success: true, updated: 0 } as const;

            // Build CASE expression to assign 1..n order
            const caseExpr = sql`CASE ${leads.id} ${sql.join(ids.map((id, idx) => sql`WHEN ${id} THEN ${idx + 1}`), sql` `)} END`;

            await db.update(leads)
                .set({ pipelineStageId: input.pipelineStageId, kanbanOrder: caseExpr } as any)
                .where(inArray(leads.id, ids));

            return { success: true, updated: ids.length } as const;
        }),

    delete: permissionProcedure("leads.delete")
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");
            await db.delete(leads).where(eq(leads.id, input.id));
            return { success: true };
        }),

    getByPipeline: permissionProcedure("leads.view")
        .input(z.object({ pipelineId: z.number().optional() }))
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) return {};

            // 1. Get Pipeline (or default)
            let pipeline = null;
            if (input.pipelineId) {
                const p = await db.select().from(pipelines).where(eq(pipelines.id, input.pipelineId)).limit(1);
                pipeline = p[0];
            } else {
                const p = await db.select().from(pipelines).where(eq(pipelines.isDefault, true)).limit(1);
                if (p[0]) pipeline = p[0];
            }

            if (!pipeline) return {}; // valid case if no pipelines yet (though list creates one)

            // 2. Get Stages
            const stages = await db.select().from(pipelineStages).where(eq(pipelineStages.pipelineId, pipeline.id)).orderBy(asc(pipelineStages.order));

            // 3. OPTIMIZED: Filter leads by pipelineStageId instead of full scan
            // Only fetch leads belonging to this pipeline's stages
            const stageIds = stages.map(s => s.id);
            const filteredLeads = stageIds.length > 0
                ? await db.select().from(leads).where(inArray(leads.pipelineStageId, stageIds)).orderBy(asc(leads.kanbanOrder))
                : [];

            const result: Record<string, typeof leads.$inferSelect[]> = {};
            stages.forEach(s => result[s.id] = []);


            // 4. Group leads by stage
            for (const lead of filteredLeads) {
                if (lead.pipelineStageId && result[lead.pipelineStageId]) {
                    result[lead.pipelineStageId].push(lead);
                }
            }

            // Sort each stage by kanbanOrder (fallback createdAt)
            for (const s of stages) {
                const arr = result[s.id] ?? [];
                arr.sort((a: any, b: any) => {
                    const ao = Number(a.kanbanOrder ?? 0);
                    const bo = Number(b.kanbanOrder ?? 0);
                    if (ao !== bo) return ao - bo;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                });
            }

            return result;
        }),
});
