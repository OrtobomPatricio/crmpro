import cron from "node-cron";
import { getDb } from "./db";
import { appointments, reminderTemplates, whatsappNumbers, whatsappConnections } from "../drizzle/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { sendCloudMessage } from "./whatsapp/cloud";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { decryptSecret } from "./_core/crypto";

interface ReminderJob {
    appointmentId: number;
    phone: string;
    firstName: string;
    appointmentDate: Date;
    appointmentTime: string;
    templateContent: string;
}

/**
 * Replace variables in template content
 */
function replaceTemplateVariables(template: string, data: {
    name: string;
    date: string;
    time: string;
}): string {
    return template
        .replace(/\{\{name\}\}/g, data.name)
        .replace(/\{\{date\}\}/g, data.date)
        .replace(/\{\{time\}\}/g, data.time);
}

/**
 * Send appointment reminder via WhatsApp
 */
async function sendReminder(job: ReminderJob): Promise<boolean> {
    try {
        const db = await getDb();
        if (!db) {
            console.error("[Reminders] Database not available");
            return false;
        }

        // Get first available WhatsApp number with active connection
        const whatsappData = await db
            .select({
                phoneNumberId: whatsappNumbers.id,
                cloudPhoneNumberId: whatsappConnections.phoneNumberId, // Use connection's phone number ID
                accessToken: whatsappConnections.accessToken,
            })
            .from(whatsappNumbers)
            .leftJoin(whatsappConnections, eq(whatsappNumbers.id, whatsappConnections.whatsappNumberId))
            .where(
                and(
                    eq(whatsappNumbers.status, "active"),
                    eq(whatsappConnections.isConnected, true)
                )
            )
            .limit(1);

        if (!whatsappData || whatsappData.length === 0) {
            console.error("[Reminders] No active WhatsApp connection found");
            return false;
        }

        const { cloudPhoneNumberId, accessToken } = whatsappData[0];
        const resolvedToken = decryptSecret(accessToken);

        if (!cloudPhoneNumberId || !resolvedToken) {
            console.error("[Reminders] Missing cloudPhoneNumberId or accessToken");
            return false;
        }

        // Format date and time for the message
        const dateStr = format(job.appointmentDate, "EEEE d 'de' MMMM", { locale: es });
        const timeStr = job.appointmentTime;

        // Replace variables in template
        const message = replaceTemplateVariables(job.templateContent, {
            name: job.firstName,
            date: dateStr,
            time: timeStr,
        });

        // Send WhatsApp message
        await sendCloudMessage({
            accessToken: resolvedToken,
            phoneNumberId: cloudPhoneNumberId,
            to: job.phone,
            payload: {
                type: "text",
                body: message,
            },
        });

        console.log(`[Reminders] Sent reminder for appointment #${job.appointmentId} to ${job.phone}`);
        return true;
    } catch (error) {
        console.error(`[Reminders] Error sending reminder for appointment #${job.appointmentId}:`, error);
        return false;
    }
}

/**
 * Process reminders for a specific daysBefore value
 */
async function processReminders(daysBefore: number): Promise<void> {
    try {
        const db = await getDb();
        if (!db) {
            console.error("[Reminders] Database not available");
            return;
        }

        // Get active templates for this daysBefore
        const templates = await db
            .select()
            .from(reminderTemplates)
            .where(
                and(
                    eq(reminderTemplates.daysBefore, daysBefore),
                    eq(reminderTemplates.isActive, true)
                )
            );

        if (templates.length === 0) {
            console.log(`[Reminders] No active templates for ${daysBefore} days before`);
            return;
        }

        // Use the first active template
        const template = templates[0];

        // Calculate target date (e.g., if daysBefore=1, target is tomorrow)
        const targetDate = addDays(new Date(), daysBefore);
        const targetDateStr = format(targetDate, "yyyy-MM-dd");

        // Get appointments for target date
        const upcomingAppointments = await db
            .select({
                id: appointments.id,
                firstName: appointments.firstName,
                phone: appointments.phone,
                appointmentDate: appointments.appointmentDate,
                appointmentTime: appointments.appointmentTime,
            })
            .from(appointments)
            .where(
                and(
                    eq(appointments.status, "scheduled"),
                    sql`DATE(${appointments.appointmentDate}) = ${targetDateStr}`
                )
            );

        console.log(
            `[Reminders] Found ${upcomingAppointments.length} appointments for ${targetDateStr} (${daysBefore} days from now)`
        );

        // Send reminders
        let successCount = 0;
        for (const apt of upcomingAppointments) {
            const job: ReminderJob = {
                appointmentId: apt.id,
                phone: apt.phone,
                firstName: apt.firstName,
                appointmentDate: new Date(apt.appointmentDate),
                appointmentTime: apt.appointmentTime,
                templateContent: template.content,
            };

            const success = await sendReminder(job);
            if (success) successCount++;

            // Wait 1 second between messages to avoid rate limits
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        console.log(
            `[Reminders] Processed ${upcomingAppointments.length} appointments, sent ${successCount} reminders`
        );
    } catch (error) {
        console.error(`[Reminders] Error processing reminders for daysBefore=${daysBefore}:`, error);
    }
}

/**
 * Main job that runs all reminder checks
 */
async function runReminderJob(): Promise<void> {
    console.log(`[Reminders] Running reminder job at ${new Date().toISOString()}`);

    try {
        const db = await getDb();
        if (!db) {
            console.error("[Reminders] Database not available");
            return;
        }

        // Get all unique daysBefore values from active templates
        const templates = await db
            .select({
                daysBefore: reminderTemplates.daysBefore,
            })
            .from(reminderTemplates)
            .where(eq(reminderTemplates.isActive, true))
            .groupBy(reminderTemplates.daysBefore);

        const daysBeforeList = templates.map((t) => t.daysBefore);
        console.log(`[Reminders] Checking reminders for daysBefore: [${daysBeforeList.join(", ")}]`);

        // Process each daysBefore value
        for (const daysBefore of daysBeforeList) {
            await processReminders(daysBefore);
        }

        console.log(`[Reminders] Reminder job completed`);
    } catch (error) {
        console.error("[Reminders] Error in reminder job:", error);
    }
}

/**
 * Initialize the reminder scheduler
 */
export function initReminderScheduler(): void {
    // Run every day at 9:00 AM
    cron.schedule("0 9 * * *", runReminderJob, {
        timezone: "America/Argentina/Buenos_Aires", // Ajustá según tu zona horaria
    });

    console.log("[Reminders] Scheduler initialized - will run daily at 9:00 AM");

    // Optional: Run immediately on startup for testing (comment out in production)
    // setTimeout(() => runReminderJob(), 5000);
}
