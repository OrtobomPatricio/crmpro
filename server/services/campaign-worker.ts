
import cron from "node-cron";
import { getDb } from "../db";
import { campaigns, campaignRecipients, whatsappNumbers, whatsappConnections, templates, leads } from "../../drizzle/schema";
import { eq, and, lte, inArray, sql } from "drizzle-orm";
import { sendCloudTemplate } from "../whatsapp/cloud";
import { sendEmail } from "../_core/email";
import { decryptSecret } from "../_core/crypto";
import { dispatchIntegrationEvent } from "../_core/integrationDispatch";

// Concurrency limit per tick
const BATCH_SIZE = 50;

export function startCampaignWorker() {
    console.log("[CampaignWorker] Starting worker...");

    // Run every minute
    cron.schedule("* * * * *", async () => {
        try {
            await processscheduledCampaigns();
            await processRunningCampaigns();
        } catch (err) {
            console.error("[CampaignWorker] Error in cron job:", err);
        }
    });
}

async function processscheduledCampaigns() {
    const db = await getDb();
    if (!db) return;

    const now = new Date();

    // Find campaigns that are scheduled and due
    const dueCampaigns = await db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.status, "scheduled"), lte(campaigns.scheduledAt, now)));

    for (const campaign of dueCampaigns) {
        console.log(`[CampaignWorker] Starting campaign ${campaign.id}: ${campaign.name}`);
        await db
            .update(campaigns)
            .set({ status: "running", startedAt: now })
            .where(eq(campaigns.id, campaign.id));

        // Trigger integration webhooks (if any)
        // We don't have whatsappNumberId at campaign level yet, so we use the first connected account.
        const conn = await db.select().from(whatsappConnections).where(eq(whatsappConnections.isConnected, true)).limit(1);
        if (conn[0]?.whatsappNumberId) {
            void dispatchIntegrationEvent({
                whatsappNumberId: conn[0].whatsappNumberId,
                event: "campaign_started",
                data: { campaignId: campaign.id, name: campaign.name, type: campaign.type, startedAt: now.toISOString() },
            });
        }
    }
}

async function processRunningCampaigns() {
    const db = await getDb();
    if (!db) return;

    // Find running campaigns
    const running = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.status, "running"));

    for (const campaign of running) {
        // Determine channel (whatsapp vs email)
        if (campaign.type === "whatsapp") {
            await processWhatsAppCampaignBatch(campaign);
        } else {
            await processEmailCampaignBatch(campaign);
        }
    }
}

function renderMessage(template: string, vars: Record<string, any>) {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
        const v = (vars as any)[key];
        return v === undefined || v === null ? "" : String(v);
    });
}

async function completeCampaign(db: any, campaign: typeof campaigns.$inferSelect) {
    const completedAt = new Date();
    await db.update(campaigns).set({ status: "completed", completedAt }).where(eq(campaigns.id, campaign.id));

    const conn = await db.select().from(whatsappConnections).where(eq(whatsappConnections.isConnected, true)).limit(1);
    if (conn[0]?.whatsappNumberId) {
        void dispatchIntegrationEvent({
            whatsappNumberId: conn[0].whatsappNumberId,
            event: "campaign_completed",
            data: { campaignId: campaign.id, name: campaign.name, type: campaign.type, completedAt: completedAt.toISOString() },
        });
    }
}

async function processEmailCampaignBatch(campaign: typeof campaigns.$inferSelect) {
    const db = await getDb();
    if (!db) return;

    const recipients = await db
        .select()
        .from(campaignRecipients)
        .where(and(eq(campaignRecipients.campaignId, campaign.id), eq(campaignRecipients.status, "pending")))
        .limit(BATCH_SIZE);

    if (recipients.length === 0) {
        console.log(`[CampaignWorker] Email campaign ${campaign.id} completed.`);
        await completeCampaign(db, campaign);
        return;
    }

    for (const recipient of recipients) {
        try {
            const leadRes = await db
                .select({
                    email: leads.email,
                    name: leads.name,
                    phone: leads.phone,
                    country: leads.country,
                    notes: leads.notes,
                })
                .from(leads)
                .where(eq(leads.id, recipient.leadId))
                .limit(1);

            const lead = leadRes[0];
            if (!lead || !lead.email) {
                await updateRecipientStatus(db, recipient.id, "failed", "Lead sin email");
                await db.update(campaigns)
                    .set({ messagesFailed: sql`${campaigns.messagesFailed} + 1` })
                    .where(eq(campaigns.id, campaign.id));
                continue;
            }

            const html = renderMessage(campaign.message || "", {
                name: lead.name,
                phone: lead.phone,
                email: lead.email,
                country: lead.country,
                notes: lead.notes,
            });

            const ok = await sendEmail({
                to: String(lead.email),
                subject: campaign.name,
                html,
                text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
            });

            if (!ok) {
                await updateRecipientStatus(db, recipient.id, "failed", "SMTP no configurado");
                await db.update(campaigns)
                    .set({ messagesFailed: sql`${campaigns.messagesFailed} + 1` })
                    .where(eq(campaigns.id, campaign.id));
                continue;
            }

            const now = new Date();
            await db.update(campaignRecipients)
                .set({
                    status: "delivered",
                    sentAt: now,
                    deliveredAt: now,
                })
                .where(eq(campaignRecipients.id, recipient.id));

            await db.update(campaigns)
                .set({
                    messagesSent: sql`${campaigns.messagesSent} + 1`,
                    messagesDelivered: sql`${campaigns.messagesDelivered} + 1`,
                })
                .where(eq(campaigns.id, campaign.id));

        } catch (error: any) {
            console.error(`[CampaignWorker] Failed to email recipient ${recipient.id}:`, error.message);
            await updateRecipientStatus(db, recipient.id, "failed", error.message);
            await db.update(campaigns)
                .set({ messagesFailed: sql`${campaigns.messagesFailed} + 1` })
                .where(eq(campaigns.id, campaign.id));
        }
    }
}

async function processWhatsAppCampaignBatch(campaign: typeof campaigns.$inferSelect) {
    const db = await getDb();
    if (!db) return;

    // 1. Get recipients pending
    const recipients = await db
        .select()
        .from(campaignRecipients)
        .where(and(eq(campaignRecipients.campaignId, campaign.id), eq(campaignRecipients.status, "pending")))
        .limit(BATCH_SIZE);

    if (recipients.length === 0) {
        console.log(`[CampaignWorker] WhatsApp campaign ${campaign.id} completed.`);
        await completeCampaign(db, campaign);
        return;
    }

    // 2. Get connection credentials
    // Logic: Campaigns might be linked to a specific whatsappNumberId in the future, 
    // currently the schema links recipients to whatsappNumberId.
    // We'll assume the system uses the FIRST active connection if not specified, 
    // or we need to find the connection for the recipient's assigned number.

    // For simplicity: Try to find a valid connection for the sending number.
    // In `leads`, we have `whatsappNumberId`? No, that's assignation.
    // In `campaignRecipients`, `whatsappNumberId` IS NULLABLE.

    // We need a valid accessToken.
    const connections = await db.select().from(whatsappConnections).where(eq(whatsappConnections.isConnected, true));

    if (connections.length === 0) {
        console.warn(`[CampaignWorker] No active WhatsApp connections found. Pausing campaign ${campaign.id}.`);
        await db.update(campaigns).set({ status: "paused" }).where(eq(campaigns.id, campaign.id));
        return;
    }

    // We'll pick a default connection (used when recipient doesn't specify whatsappNumberId)
    const defaultConnection = connections[0];

    const resolvedDefaultAccessToken = decryptSecret(defaultConnection.accessToken);
    const resolvedDefaultPhoneNumberId = defaultConnection.phoneNumberId;

    if (!resolvedDefaultAccessToken || !resolvedDefaultPhoneNumberId) {
        console.error(`[CampaignWorker] Connection ${defaultConnection.id} missing credentials.`);
        await db.update(campaigns).set({ status: "paused" }).where(eq(campaigns.id, campaign.id));
        return;
    }

    // Note: per-recipient connection selection happens later.

    // 3. Get Template
    let templateName = "";
    let languageCode = "es";

    if (campaign.templateId) {
        const tmpl = await db.select().from(templates).where(eq(templates.id, campaign.templateId)).limit(1);
        if (tmpl[0]) {
            templateName = tmpl[0].name;
            // TODO: Store language in template table
        }
    }

    if (!templateName) {
        console.error(`[CampaignWorker] Campaign ${campaign.id} has no valid template.`);
        // Status enum does not include "failed" - pause instead.
        await db.update(campaigns).set({ status: "paused" }).where(eq(campaigns.id, campaign.id));
        return;
    }

    // 4. Send Messages
    for (const recipient of recipients) {
        try {
            // Fetch lead phone
            // Using raw select because query builder typing might be tricky with dynamic imports
            const leadRes = await db
                .select({ phone: leads.phone, name: leads.name })
                .from(leads)
                .where(eq(leads.id, recipient.leadId))
                .limit(1);

            if (!leadRes[0] || !leadRes[0].phone) {
                await updateRecipientStatus(db, recipient.id, "failed", "Lead no encontrado o sin teléfono");
                await db.update(campaigns)
                    .set({ messagesFailed: sql`${campaigns.messagesFailed} + 1` })
                    .where(eq(campaigns.id, campaign.id));
                continue;
            }

            const phone = leadRes[0].phone.replace(/\D/g, ""); // strip non-digits

            // Send Template
            // Mock components for now (variables)
            // Prefer recipient-assigned connection if provided
            const connForRecipient = recipient.whatsappNumberId
                ? connections.find(c => c.whatsappNumberId === recipient.whatsappNumberId) ?? defaultConnection
                : defaultConnection;

            const accessToken = decryptSecret(connForRecipient.accessToken) ?? resolvedDefaultAccessToken;
            const phoneNumberId = connForRecipient.phoneNumberId ?? resolvedDefaultPhoneNumberId;

            if (!accessToken || !phoneNumberId) {
                await updateRecipientStatus(db, recipient.id, "failed", "WhatsApp connection missing credentials");
                await db.update(campaigns)
                    .set({ messagesFailed: sql`${campaigns.messagesFailed} + 1` })
                    .where(eq(campaigns.id, campaign.id));
                continue;
            }

            const { messageId } = await sendCloudTemplate({
                accessToken,
                phoneNumberId,
                to: phone,
                templateName,
                languageCode
            });

            await db.update(campaignRecipients)
                .set({
                    status: "sent",
                    sentAt: new Date(),
                    whatsappNumberId: connForRecipient.whatsappNumberId,
                    whatsappMessageId: messageId,
                })
                .where(eq(campaignRecipients.id, recipient.id)); // Using recipient.id

            // Update campaign stats
            // We can do this in bulk content later, but for now 1 by 1
            await db.update(campaigns)
                .set({ messagesSent: sql`${campaigns.messagesSent} + 1` })
                .where(eq(campaigns.id, campaign.id));

        } catch (error: any) {
            console.error(`[CampaignWorker] Failed to send to recipient ${recipient.id}:`, error.message);
            await updateRecipientStatus(db, recipient.id, "failed", error.message);
            await db.update(campaigns)
                .set({ messagesFailed: sql`${campaigns.messagesFailed} + 1` })
                .where(eq(campaigns.id, campaign.id));
        }
    }
}

async function updateRecipientStatus(db: any, id: number, status: any, errorMessage?: string) {
    await db.update(campaignRecipients)
        .set({ status, errorMessage: errorMessage || null })
        .where(eq(campaignRecipients.id, id));
}
