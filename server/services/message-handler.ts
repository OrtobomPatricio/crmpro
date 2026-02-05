
import { getDb } from "../db";
import { leads, conversations, chatMessages, whatsappNumbers, pipelines, pipelineStages } from "../../drizzle/schema";
import { eq, and, asc, sql } from "drizzle-orm";

export const MessageHandler = {
    async handleIncomingMessage(userId: number, message: any, upsertType: 'append' | 'notify' = 'notify') {
        const db = await getDb();
        if (!db) return;

        // Skip strange messages (status broadcasts, etc)
        const jid = message.key.remoteJid;
        if (!jid || jid.includes('status@broadcast') || jid.includes('@lid')) {
            return;
        }

        // 1. Idempotency Check (Prevent Duplicates)
        // We trust message.key.id from WhatsApp
        const existingMessage = await db.select({ id: chatMessages.id })
            .from(chatMessages)
            .where(eq(chatMessages.whatsappMessageId, message.key.id))
            .limit(1);

        if (existingMessage.length > 0) {
            console.log(`[MessageHandler] Skipping duplicate message ${message.key.id}`);
            return;
        }

        const fromMe = message.key.fromMe;
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            message.message?.videoMessage?.caption ||
            (message.message?.imageMessage ? "Image" : null) ||
            (message.message?.videoMessage ? "Video" : null) ||
            (message.message?.audioMessage ? "Audio" : null) ||
            (message.message?.documentMessage ? "Document" : null) ||
            (message.message?.stickerMessage ? "Sticker" : null) ||
            "Media/Unknown";

        // Extract Timestamp (seconds to milliseconds)
        const messageTimestamp = message.messageTimestamp ? new Date(Number(message.messageTimestamp) * 1000) : new Date();

        // 2. Determine Contact (Lead)
        // simple phone number extraction (remove @s.whatsapp.net)
        const phoneNumber = '+' + jid.split('@')[0];
        const contactName = message.pushName || "Unknown";

        try {
            // Find or Create Lead
            let leadId: number;
            const existingLead = await db.select().from(leads).where(eq(leads.phone, phoneNumber)).limit(1);

            if (existingLead.length > 0) {
                leadId = existingLead[0].id;
                // Only update lastContactedAt if it's a NEW message (notify), not history sync
                if (upsertType === 'notify') {
                    await db.update(leads).set({ lastContactedAt: new Date() }).where(eq(leads.id, leadId));
                }
            } else {
                // If syncing history, maybe we DON'T want to create leads for everyone who ever messaged?
                // But for a CRM, yes we probably do.
                // But let's be careful. If I have 1000 chats, I get 1000 leads.
                // For now, let's allow it as requested "historial".

                // Determine Default Pipeline Stage
                let stageId: number | null = null;
                let nextOrder = 0;

                const defaultPipeline = await db.select().from(pipelines).where(eq(pipelines.isDefault, true)).limit(1);
                if (defaultPipeline[0]) {
                    const firstStage = await db.select().from(pipelineStages)
                        .where(eq(pipelineStages.pipelineId, defaultPipeline[0].id))
                        .orderBy(asc(pipelineStages.order))
                        .limit(1);

                    if (firstStage[0]) {
                        stageId = firstStage[0].id;
                        // Calculate next Kanban Order
                        const maxRows = await db.select({ max: sql<number>`max(${leads.kanbanOrder})` })
                            .from(leads)
                            .where(eq(leads.pipelineStageId, stageId));
                        nextOrder = ((maxRows[0] as any)?.max ?? 0) + 1;
                    }
                }

                const [newLead] = await db.insert(leads).values({
                    name: contactName !== "Unknown" ? contactName : phoneNumber, // Helper if no name
                    phone: phoneNumber,
                    country: "Unknown",
                    pipelineStageId: stageId,
                    kanbanOrder: nextOrder,
                    source: "whatsapp_inbound",
                    createdAt: new Date(), // This is when LEAD was created in CRM, not message time
                    updatedAt: new Date(),
                    lastContactedAt: messageTimestamp,
                }).$returningId();
                leadId = newLead.id;
            }

            // 3. Find or Create Conversation
            let conversationId: number;
            const existingConv = await db.select().from(conversations).where(
                and(
                    eq(conversations.leadId, leadId),
                    eq(conversations.whatsappNumberId, userId),
                    eq(conversations.channel, 'whatsapp')
                )
            ).limit(1);

            if (existingConv.length > 0) {
                conversationId = existingConv[0].id;

                // Sync Logic:
                // If it's a 'notify' (real-time) message, increment unread count & update lastMessageAt
                // If it's 'append' (history), assume read (or at least don't notify) and update lastMessageAt only if newer

                const updates: any = {};

                if (upsertType === 'notify' && !fromMe) {
                    updates.unreadCount = (existingConv[0].unreadCount || 0) + 1;
                    updates.lastMessageAt = new Date(); // now
                    updates.status = 'active'; // revive archived chats if new message comes
                } else if (upsertType === 'append' || fromMe) {
                    // For history, we might want to ensure lastMessageAt reflects the LATEST message
                    // But we are processing one by one.
                    // Let's just update lastMessageAt if this message is newer than current lastMessageAt
                    if (!existingConv[0].lastMessageAt || messageTimestamp > existingConv[0].lastMessageAt) {
                        updates.lastMessageAt = messageTimestamp;
                    }
                }

                if (Object.keys(updates).length > 0) {
                    await db.update(conversations).set(updates).where(eq(conversations.id, conversationId));
                }

            } else {
                const [newConv] = await db.insert(conversations).values({
                    channel: 'whatsapp',
                    whatsappNumberId: userId,
                    leadId: leadId,
                    contactPhone: phoneNumber,
                    contactName: contactName,
                    unreadCount: (upsertType === 'notify' && !fromMe) ? 1 : 0,
                    lastMessageAt: messageTimestamp,
                    status: 'active'
                }).$returningId();
                conversationId = newConv.id;
            }

            // 4. Insert Chat Message
            // Detect Type
            let msgType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' = 'text';
            if (message.message?.imageMessage) msgType = 'image';
            else if (message.message?.videoMessage) msgType = 'video';
            else if (message.message?.audioMessage) msgType = 'audio';
            else if (message.message?.documentMessage) msgType = 'document';
            else if (message.message?.stickerMessage) msgType = 'sticker';

            // TODO: Handle media download/upload to S3/Local
            // For now, we just verify text/type.

            await db.insert(chatMessages).values({
                conversationId: conversationId,
                whatsappNumberId: userId,
                direction: fromMe ? 'outbound' : 'inbound',
                messageType: msgType,
                content: text,
                whatsappMessageId: message.key.id,
                status: fromMe ? 'sent' : 'delivered', // Assume sent if from me in history
                deliveredAt: fromMe ? null : messageTimestamp,
                sentAt: messageTimestamp,
                createdAt: new Date() // Record creation time
            });

            console.log(`[MessageHandler] Saved ${upsertType} msg ${message.key.id} for Lead ${leadId}`);

        } catch (error) {
            console.error("Error handling incoming message:", error);
        }
    }
};
