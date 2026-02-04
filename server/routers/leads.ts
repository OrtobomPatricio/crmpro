import { z } from "zod";
import { eq, desc, asc, and, sql, inArray } from "drizzle-orm";
import { leads, pipelines, pipelineStages, whatsappNumbers, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { permissionProcedure, protectedProcedure, router } from "../_core/trpc";
import { dispatchIntegrationEvent } from "../_core/integrationDispatch";
import { leadsToCSV, parseCSV, importLeadsFromCSV } from "../services/backup";

// E.164 Regex (basic)
const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;

export const leadsRouter = router({
    search: protectedProcedure
        .input(z.object({
            query: z.string().trim().min(1),
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
            name: z.string().trim().min(1),
            phone: z.string().trim().regex(PHONE_REGEX, "Invalid E.164 phone format"),
            email: z.string().trim().email().optional().or(z.literal("")),
            country: z.string().trim().min(1),
            source: z.string().trim().optional(),
            notes: z.string().trim().optional(),
            pipelineStageId: z.number().optional(),
            customFields: z.record(z.string(), z.any()).optional(),
            value: z.number().optional(), // Deal value
        }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            return await db.transaction(async (tx) => {
                // IDEMPOTENCY: Check if lead with this phone already exists (Use Transaction Lock logic if needed, but select is fine usually)
                // Note: Repeatable Read isolation might prevent seeing concurrent inserts unless using stronger locking (FOR UPDATE), 
                // but checking phone uniqueness usually relies on Unique Constraint in DB.
                // Here we do a soft check.
                const existingLead = await tx.select().from(leads).where(eq(leads.phone, input.phone)).limit(1);
                if (existingLead[0]) {
                    return { id: existingLead[0].id, success: true, existed: true };
                }

                // Resolve pipeline stage
                let stageId: number | null = (input.pipelineStageId as any) ?? null;
                if (!stageId) {
                    const p = await tx.select().from(pipelines).where(eq(pipelines.isDefault, true)).limit(1);
                    const pipeline = p[0];
                    if (pipeline) {
                        const s = await tx.select().from(pipelineStages).where(eq(pipelineStages.pipelineId, pipeline.id)).orderBy(asc(pipelineStages.order)).limit(1);
                        stageId = s[0]?.id ?? null;
                    }
                }

                // Determine next Kanban order
                // CRITICAL: We lock the reads to prevent race conditions on ordering if strict ordering mattered heavily.
                // For now, standard select is "good enough" for Kanban unless high concurrency.
                let nextOrder = 0;
                if (stageId) {
                    const maxRows = await tx.select({ max: sql<number>`max(${leads.kanbanOrder})` }).from(leads).where(eq(leads.pipelineStageId, stageId));
                    nextOrder = ((maxRows[0] as any)?.max ?? 0) + 1;
                }

                // Assignment
                const defaultNumber = await tx.select({ id: whatsappNumbers.id }).from(whatsappNumbers).limit(1);
                const defaultWhatsappNumberId = defaultNumber[0]?.id ?? null;

                // Commission logic
                const countryLower = input.country.toLowerCase();
                const commission = (countryLower === 'panamá' || countryLower === 'panama')
                    ? '10000.00'
                    : '5000.00';

                const result = await tx.insert(leads).values({
                    ...input,
                    email: input.email || null, // handle empty string vs null
                    value: input.value ? input.value.toString() : "0.00",
                    commission,
                    assignedToId: ctx.user?.id,
                    whatsappNumberId: defaultWhatsappNumberId as any,
                    pipelineStageId: stageId as any,
                    kanbanOrder: nextOrder as any,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });

                const newLeadId = result[0].insertId;

                if (defaultWhatsappNumberId) {
                    // We run side-effects OUTSIDE transaction usually, or fire-and-forget inside.
                    // Dispatching event is safe here as it's likely async/detached or non-blocking logic.
                    void dispatchIntegrationEvent({
                        whatsappNumberId: defaultWhatsappNumberId,
                        event: "lead_created",
                        data: { id: newLeadId, ...input, assignedToId: ctx.user?.id },
                    });
                }

                return { id: newLeadId, success: true };
            });
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
            name: z.string().trim().min(1).optional(),
            phone: z.string().trim().regex(PHONE_REGEX).optional(),
            email: z.string().trim().email().optional().nullable(),
            country: z.string().trim().min(1).optional(),
            source: z.string().trim().optional().nullable(),
            notes: z.string().trim().optional().nullable(),
            pipelineStageId: z.number().optional(),
            customFields: z.record(z.string(), z.any()).optional(),
            value: z.number().optional(),
            assignedToId: z.number().optional().nullable(),
        }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            return await db.transaction(async (tx) => {
                // CHECK ASSIGN PERMISSION
                if (input.assignedToId !== undefined) {
                    const { computeEffectiveRole } = await import("../_core/rbac");
                    const userRole = (ctx.user as any).role || "agent";
                    const userCustomRole = (ctx.user as any).customRole;
                    const { getOrCreateAppSettings } = await import("../services/app-settings");
                    const settings = await getOrCreateAppSettings(db);
                    const matrix = settings.permissionsMatrix || {};
                    const role = computeEffectiveRole({ baseRole: userRole, customRole: userCustomRole, permissionsMatrix: matrix });

                    const hasAssign = role === "owner" || role === "admin" || (matrix[role] && (matrix[role].includes("*") || matrix[role].includes("leads.*") || matrix[role].includes("leads.assign")));

                    if (!hasAssign) throw new Error("No tienes permisos para reasignar leads (leads.assign)");
                }

                const { id, ...data } = input;

                // Handle atomic stage change and ordering
                if (data.pipelineStageId) {
                    const maxRows = await tx.select({ max: sql<number>`max(${leads.kanbanOrder})` }).from(leads).where(eq(leads.pipelineStageId, data.pipelineStageId));
                    const nextOrder = ((maxRows[0] as any)?.max ?? 0) + 1;
                    (data as any).kanbanOrder = nextOrder;
                }

                if (data.country) {
                    const c = data.country.toLowerCase();
                    (data as Record<string, unknown>).commission = (c === 'panamá' || c === 'panama') ? '10000.00' : '5000.00';
                }

                if (data.value !== undefined) {
                    (data as any).value = data.value.toString();
                }

                (data as any).updatedAt = new Date();

                await tx.update(leads)
                    .set(data as any)
                    .where(eq(leads.id, id));

                // Webhook logic
                const updated = await tx.select({ whatsappNumberId: leads.whatsappNumberId }).from(leads).where(eq(leads.id, id)).limit(1);
                const waId = updated[0]?.whatsappNumberId as number | null | undefined;
                if (waId) {
                    void dispatchIntegrationEvent({
                        whatsappNumberId: waId,
                        event: "lead_updated",
                        data: { id, ...data, updatedById: ctx.user?.id },
                    });
                }

                return { success: true };
            });
        }),

    updateStatus: permissionProcedure("leads.update")
        .input(z.object({
            id: z.number(),
            pipelineStageId: z.number(),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            return await db.transaction(async (tx) => {
                const maxRows = await tx.select({ max: sql<number>`max(${leads.kanbanOrder})` }).from(leads).where(eq(leads.pipelineStageId, input.pipelineStageId));
                const nextOrder = ((maxRows[0] as any)?.max ?? 0) + 1;

                await tx.update(leads)
                    .set({
                        pipelineStageId: input.pipelineStageId,
                        kanbanOrder: nextOrder,
                        updatedAt: new Date()
                    } as any)
                    .where(eq(leads.id, input.id));

                const updated = await tx.select({ whatsappNumberId: leads.whatsappNumberId }).from(leads).where(eq(leads.id, input.id)).limit(1);
                const whatsappNumberId = updated[0]?.whatsappNumberId;
                if (whatsappNumberId) {
                    void dispatchIntegrationEvent({
                        whatsappNumberId,
                        event: "lead_updated",
                        data: { id: input.id, pipelineStageId: input.pipelineStageId },
                    });
                }

                return { success: true };
            });
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

            return await db.transaction(async (tx) => {
                const caseExpr = sql`CASE ${leads.id} ${sql.join(ids.map((id, idx) => sql`WHEN ${id} THEN ${idx + 1}`), sql` `)} END`;

                await tx.update(leads)
                    .set({
                        pipelineStageId: input.pipelineStageId,
                        kanbanOrder: caseExpr,
                        updatedAt: new Date()
                    } as any)
                    .where(inArray(leads.id, ids));

                return { success: true, updated: ids.length } as const;
            });
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

            const pipeline = input.pipelineId
                ? (await db.select().from(pipelines).where(eq(pipelines.id, input.pipelineId)).limit(1))[0]
                : (await db.select().from(pipelines).where(eq(pipelines.isDefault, true)).limit(1))[0];

            if (!pipeline) return {};

            const stages = await db.select().from(pipelineStages).where(eq(pipelineStages.pipelineId, pipeline.id)).orderBy(asc(pipelineStages.order));
            const stageIds = stages.map(s => s.id);

            const filteredLeads = stageIds.length > 0
                ? await db.select().from(leads).where(inArray(leads.pipelineStageId, stageIds)).orderBy(asc(leads.kanbanOrder))
                : [];

            const result: Record<string, typeof leads.$inferSelect[]> = {};
            stages.forEach(s => result[s.id] = []);

            for (const lead of filteredLeads) {
                if (lead.pipelineStageId && result[lead.pipelineStageId]) {
                    result[lead.pipelineStageId].push(lead);
                }
            }

            // Fallback sort by Date if order is 0 or same
            for (const s of stages) {
                result[s.id]?.sort((a, b) => {
                    const ao = Number(a.kanbanOrder ?? 0);
                    const bo = Number(b.kanbanOrder ?? 0);
                    if (ao !== bo) return ao - bo;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                });
            }

            return result;
        }),
});
