import { z } from "zod";
import { eq, desc, and, count, inArray } from "drizzle-orm";
import { appointments, appointmentReasons, reminderTemplates, appSettings } from "../../drizzle/schema";
import { getDb } from "../db";
import { permissionProcedure, adminProcedure, protectedProcedure, router } from "../_core/trpc";

export const schedulingRouter = router({
    list: permissionProcedure("scheduling.view").query(async () => {
        const db = await getDb();
        if (!db) return [];

        return db.select()
            .from(appointments)
            .orderBy(desc(appointments.appointmentDate));
    }),

    listReasons: permissionProcedure("scheduling.view").query(async () => {
        const db = await getDb();
        if (!db) return [];

        return db.select()
            .from(appointmentReasons)
            .where(eq(appointmentReasons.isActive, true))
            .orderBy(appointmentReasons.name);
    }),

    create: permissionProcedure("scheduling.manage")
        .input(z.object({
            firstName: z.string().min(1),
            lastName: z.string().min(1),
            phone: z.string().min(1),
            email: z.string().optional(),
            reasonId: z.number().optional(),
            appointmentDate: z.string(),
            appointmentTime: z.string().min(1),
            notes: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            // Normalize to midnight to avoid timezone drift and make equality checks consistent
            const normalizedDate = new Date(input.appointmentDate);
            normalizedDate.setHours(0, 0, 0, 0);

            // Load scheduling rules
            const settingsRows = await db.select().from(appSettings).limit(1);
            const maxPerSlot = (settingsRows[0] as any)?.scheduling?.maxPerSlot ?? 6;

            // Allow up to N appointments per exact time slot (configurable in Settings)
            const existing = await db
                .select({ count: count() })
                .from(appointments)
                .where(
                    and(
                        eq(appointments.appointmentDate, normalizedDate),
                        eq(appointments.appointmentTime, input.appointmentTime)
                    )
                );

            const existingCount = existing[0]?.count ?? 0;
            if (existingCount >= maxPerSlot) {
                throw new Error(
                    `Ese horario ya está completo (máximo ${maxPerSlot} personas). Elegí otro horario.`
                );
            }

            const result = await db.insert(appointments).values({
                ...input,
                appointmentDate: normalizedDate,
                createdById: ctx.user?.id,
            });

            return { id: result[0].insertId, success: true };
        }),

    update: permissionProcedure("scheduling.manage")
        .input(z.object({
            id: z.number(),
            firstName: z.string().optional(),
            lastName: z.string().optional(),
            phone: z.string().optional(),
            email: z.string().optional(),
            reasonId: z.number().optional(),
            appointmentDate: z.string().optional(),
            appointmentTime: z.string().optional(),
            notes: z.string().optional(),
            status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']).optional(),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            const { id, appointmentDate, ...rest } = input;
            const updateData: Record<string, unknown> = { ...rest };
            if (appointmentDate) {
                updateData.appointmentDate = new Date(appointmentDate);
            }

            await db.update(appointments)
                .set(updateData)
                .where(eq(appointments.id, id));

            return { success: true };
        }),

    delete: permissionProcedure("scheduling.manage")
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            await db.delete(appointments).where(eq(appointments.id, input.id));
            return { success: true };
        }),

    createReason: adminProcedure
        .input(z.object({
            name: z.string().min(1),
            color: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            const result = await db.insert(appointmentReasons).values(input);
            return { id: result[0].insertId, success: true };
        }),

    deleteReason: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            await db.update(appointmentReasons)
                .set({ isActive: false })
                .where(eq(appointmentReasons.id, input.id));
            return { success: true };
        }),

    // Reminder Templates
    getTemplates: protectedProcedure.query(async () => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(reminderTemplates).where(eq(reminderTemplates.isActive, true));
    }),

    saveTemplate: permissionProcedure("scheduling.manage")
        .input(z.object({
            id: z.number().optional(),
            name: z.string().min(1),
            content: z.string().min(1),
            daysBefore: z.number().min(0),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("DB error");
            if (input.id) {
                await db.update(reminderTemplates).set({
                    name: input.name, content: input.content, daysBefore: input.daysBefore
                }).where(eq(reminderTemplates.id, input.id));
                return { success: true, id: input.id };
            } else {
                const res = await db.insert(reminderTemplates).values({
                    name: input.name, content: input.content, daysBefore: input.daysBefore, isActive: true
                });
                return { success: true, id: res[0].insertId };
            }
        }),

    deleteTemplate: permissionProcedure("scheduling.manage")
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("DB error");
            await db.delete(reminderTemplates).where(eq(reminderTemplates.id, input.id));
            return { success: true };
        }),
});
