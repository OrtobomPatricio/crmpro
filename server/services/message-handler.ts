
import { getDb } from "../db";
import { leads, conversations, chatMessages, whatsappNumbers } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const MessageHandler = {
    async handleIncomingMessage(userId: number, message: any) {
        const db = await getDb();
        if (!db) return;

        console.log("Processing incoming message for userId:", userId);

        const jid = message.key.remoteJid;
        if (!jid || jid.includes('@g.us') || jid.includes('status@broadcast')) return; // Ignore groups and status

        const fromMe = message.key.fromMe;
        if (fromMe) return; // Ignore own messages for now (or handle as outbound sync)

        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            "Media Message";

        // simple phone number extraction (remove @s.whatsapp.net)
        const phoneNumber = '+' + jid.split('@')[0];
        const contactName = message.pushName || "Unknown";

        try {
            // 1. Find or Create Lead
            let leadId: number;
            const existingLead = await db.select().from(leads).where(eq(leads.phone, phoneNumber)).limit(1);

            if (existingLead.length > 0) {
                leadId = existingLead[0].id;
                // Optional: Update lastContactedAt
                await db.update(leads).set({ lastContactedAt: new Date() }).where(eq(leads.id, leadId));
            } else {
                const [newLead] = await db.insert(leads).values({
                    name: contactName,
                    phone: phoneNumber,
                    country: "Unknown",
                    stage: "new", // using existing 'status' enum or pipeline default? schema says status is deprecated but present.
                    // pipelineStageId: ... default?
                    source: "whatsapp_inbound",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    lastContactedAt: new Date(),
                }).$returningId();
                leadId = newLead.id;
            }

            // 2. Find or Create Conversation
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
                await db.update(conversations).set({
                    lastMessageAt: new Date(),
                    unreadCount: (existingConv[0].unreadCount || 0) + 1
                }).where(eq(conversations.id, conversationId));
            } else {
                const [newConv] = await db.insert(conversations).values({
                    channel: 'whatsapp',
                    whatsappNumberId: userId,
                    leadId: leadId,
                    contactPhone: phoneNumber,
                    contactName: contactName,
                    unreadCount: 1,
                    lastMessageAt: new Date(),
                    status: 'active'
                }).$returningId();
                conversationId = newConv.id;
            }

            // 3. Insert Chat Message
            await db.insert(chatMessages).values({
                conversationId: conversationId,
                whatsappNumberId: userId,
                direction: 'inbound',
                messageType: 'text',
                content: text,
                whatsappMessageId: message.key.id,
                status: 'delivered',
                deliveredAt: new Date(),
                createdAt: new Date()
            });

            console.log(`Message saved for Lead ${leadId}, Conv ${conversationId}`);

        } catch (error) {
            console.error("Error handling incoming message:", error);
        }
    }
};
