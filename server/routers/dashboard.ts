import { z } from "zod";
import { eq, desc, sql, count, asc, inArray, and } from "drizzle-orm";
import { leads, whatsappNumbers, activityLogs, users, appointments, appointmentReasons, pipelineStages } from "../../drizzle/schema";
import { getDb } from "../db";
import { permissionProcedure, router } from "../_core/trpc";

export const dashboardRouter = router({
    getStats: permissionProcedure("dashboard.view").query(async () => {
        const db = await getDb();
        if (!db) {
            return {
                totalLeads: 0,
                totalNumbers: 0,
                activeNumbers: 0,
                warmingUpNumbers: 0,
                blockedNumbers: 0,
                messagesToday: 0,
                conversionRate: 0,
                warmupNumbers: [],
                countriesDistribution: [],
                recentLeads: [],
            };
        }

        // Get lead counts
        const leadCount = await db.select({ count: count() }).from(leads);
        const totalLeads = leadCount[0]?.count ?? 0;

        // Get number stats
        const numberStats = await db.select({
            status: whatsappNumbers.status,
            count: count(),
        }).from(whatsappNumbers).groupBy(whatsappNumbers.status);

        const totalNumbers = numberStats.reduce((acc, s) => acc + s.count, 0);
        const activeNumbers = numberStats.find(s => s.status === 'active')?.count ?? 0;
        const warmingUpNumbers = numberStats.find(s => s.status === 'warming_up')?.count ?? 0;
        const blockedNumbers = numberStats.find(s => s.status === 'blocked')?.count ?? 0;

        // Get messages sent today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const messagesTodayResult = await db.select({
            total: sql<number>`SUM(${whatsappNumbers.messagesSentToday})`,
        }).from(whatsappNumbers);
        const messagesToday = messagesTodayResult[0]?.total ?? 0;

        // Get conversion rate
        const wonLeads = await db.select({ count: count() })
            .from(leads)
            .where(eq(leads.status, 'won'));
        const conversionRate = totalLeads > 0
            ? Math.round((wonLeads[0]?.count ?? 0) / totalLeads * 100)
            : 0;

        // Get warmup numbers
        const warmupNumbersList = await db.select()
            .from(whatsappNumbers)
            .where(eq(whatsappNumbers.status, 'warming_up'))
            .orderBy(desc(whatsappNumbers.warmupDay))
            .limit(5);

        // Get countries distribution
        const countriesDistribution = await db.select({
            country: whatsappNumbers.country,
            count: count(),
        }).from(whatsappNumbers).groupBy(whatsappNumbers.country);

        // Get recent leads
        const recentLeads = await db.select()
            .from(leads)
            .orderBy(desc(leads.createdAt))
            .limit(5);

        return {
            totalLeads,
            totalNumbers,
            activeNumbers,
            warmingUpNumbers,
            blockedNumbers,
            messagesToday,
            conversionRate,
            warmupNumbers: warmupNumbersList,
            countriesDistribution,
            recentLeads,
        };
    }),

    getPipelineFunnel: permissionProcedure("dashboard.view")
        .query(async () => {
            const db = await getDb();
            if (!db) return [];

            const stageCounts = await db
                .select({
                    stageId: leads.pipelineStageId,
                    stageName: pipelineStages.name,
                    stageColor: pipelineStages.color,
                    stageOrder: pipelineStages.order,
                    count: sql<number>`count(*)`,
                })
                .from(leads)
                .leftJoin(pipelineStages, eq(leads.pipelineStageId, pipelineStages.id))
                .where(sql`${leads.pipelineStageId} IS NOT NULL`)
                .groupBy(leads.pipelineStageId, pipelineStages.name, pipelineStages.color, pipelineStages.order)
                .orderBy(asc(pipelineStages.order));

            return stageCounts.map(s => ({
                stage: s.stageName || "Sin etapa",
                count: Number(s.count),
                color: s.stageColor || "#e2e8f0",
            }));
        }),

    getLeaderboard: permissionProcedure("dashboard.view")
        .query(async () => {
            const db = await getDb();
            if (!db) return [];

            const leaderboard = await db
                .select({
                    userId: leads.assignedToId,
                    userName: users.name,
                    dealsWon: sql<number>`count(*)`,
                    totalCommission: sql<number>`sum(${leads.commission})`,
                })
                .from(leads)
                .leftJoin(users, eq(leads.assignedToId, users.id))
                .where(eq(leads.status, "won"))
                .groupBy(leads.assignedToId, users.name)
                .orderBy(desc(sql`count(*)`))
                .limit(10);

            return leaderboard.map((l, i) => ({
                rank: i + 1,
                name: l.userName || "Sin asignar",
                dealsWon: Number(l.dealsWon),
                commission: Number(l.totalCommission || 0),
            }));
        }),

    getUpcomingAppointments: permissionProcedure("dashboard.view")
        .query(async () => {
            const db = await getDb();
            if (!db) return [];

            const upcoming = await db
                .select({
                    id: appointments.id,
                    firstName: appointments.firstName,
                    lastName: appointments.lastName,
                    phone: appointments.phone,
                    appointmentDate: appointments.appointmentDate,
                    appointmentTime: appointments.appointmentTime,
                    status: appointments.status,
                    reasonName: appointmentReasons.name,
                })
                .from(appointments)
                .leftJoin(appointmentReasons, eq(appointments.reasonId, appointmentReasons.id))
                .where(
                    and(
                        sql`${appointments.appointmentDate} >= CURDATE()`,
                        inArray(appointments.status, ["scheduled", "confirmed"])
                    )
                )
                .orderBy(asc(appointments.appointmentDate), asc(appointments.appointmentTime))
                .limit(5);

            return upcoming;
        }),

    getRecentActivity: permissionProcedure("dashboard.view")
        .query(async () => {
            const db = await getDb();
            if (!db) return [];

            const activities = await db
                .select({
                    id: activityLogs.id,
                    action: activityLogs.action,
                    entityType: activityLogs.entityType,
                    entityId: activityLogs.entityId,
                    userName: users.name,
                    createdAt: activityLogs.createdAt,
                })
                .from(activityLogs)
                .leftJoin(users, eq(activityLogs.userId, users.id))
                .orderBy(desc(activityLogs.createdAt))
                .limit(10);

            return activities;
        }),
});
