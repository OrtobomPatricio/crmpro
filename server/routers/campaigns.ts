import { z } from "zod";
import { eq, desc, and, count } from "drizzle-orm";
import { campaigns, leads, campaignRecipients } from "../../drizzle/schema";
import { getDb } from "../db";
import { permissionProcedure, router } from "../_core/trpc";

export const campaignsRouter = router({
    list: permissionProcedure("campaigns.view").query(async () => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
    }),

    create: permissionProcedure("campaigns.manage")
        .input(z.object({
            name: z.string().min(1),
            type: z.enum(["whatsapp", "email"]),
            templateId: z.number().optional(),
            message: z.string(), // Fallback or override
            audienceConfig: z.any().optional(),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");
            const result = await db.insert(campaigns).values({
                ...input,
                status: "draft",
            });
            return { success: true, id: result[0].insertId };
        }),

    calculateAudience: permissionProcedure("campaigns.manage")
        .input(z.object({
            pipelineStageId: z.number().optional(),
            tags: z.array(z.string()).optional(),
            // Add more filters as needed
        }))
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) return { count: 0 };

            // Simple filter by stage for now
            const conditions = [];
            if (input.pipelineStageId) {
                conditions.push(eq(leads.pipelineStageId, input.pipelineStageId));
            }

            const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

            const countResult = await db.select({ count: count() }).from(leads).where(whereClause);
            return { count: countResult[0]?.count ?? 0 };
        }),

    launch: permissionProcedure("campaigns.manage")
        .input(z.object({ campaignId: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("DB error");

            const campaign = await db.select().from(campaigns).where(eq(campaigns.id, input.campaignId)).limit(1);
            if (!campaign[0]) throw new Error("Campaign not found");

            // IDEMPOTENCY: Check campaign status first
            if (campaign[0].status === "scheduled" || campaign[0].status === "running") {
                return {
                    success: true,
                    recipientsCount: campaign[0].totalRecipients,
                    alreadyLaunched: true
                };
            }

            // Ensure campaign is in draft state
            if (campaign[0].status !== "draft") {
                throw new Error(`Cannot launch campaign with status: ${campaign[0].status}`);
            }

            const config = campaign[0].audienceConfig as any;

            // Fetch audience
            const conditions = [];
            if (config?.pipelineStageId) {
                conditions.push(eq(leads.pipelineStageId, config.pipelineStageId));
            }
            const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

            const audience = await db.select().from(leads).where(whereClause);

            if (audience.length === 0) {
                throw new Error("No recipients found for campaign");
            }

            // Create recipients with duplicate handling
            let insertedCount = 0;
            for (const lead of audience) {
                try {
                    await db.insert(campaignRecipients).values({
                        campaignId: input.campaignId,
                        leadId: lead.id,
                        status: "pending",
                    });
                    insertedCount++;
                } catch (err: any) {
                    // Ignore duplicate errors (unique constraint violation)
                    if (err.code !== 'ER_DUP_ENTRY' && !err.message?.includes('Duplicate')) {
                        throw err;
                    }
                }
            }

            await db.update(campaigns).set({
                status: "scheduled", // Or running immediately
                totalRecipients: audience.length,
                startedAt: new Date(),
            }).where(eq(campaigns.id, input.campaignId));

            // TODO: Trigger actual sending process (Queue/Worker)

            return { success: true, recipientsCount: audience.length, inserted: insertedCount };
        }),

    getById: permissionProcedure("campaigns.view")
        .input(z.object({ id: z.number() }))
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) return null;

            const result = await db.select()
                .from(campaigns)
                .where(eq(campaigns.id, input.id))
                .limit(1);

            return result[0] ?? null;
        }),

    delete: permissionProcedure("campaigns.manage")
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            await db.delete(campaigns).where(eq(campaigns.id, input.id));
            return { success: true };
        }),
});
