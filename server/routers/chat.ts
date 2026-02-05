import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import { conversations, chatMessages, whatsappConnections, whatsappNumbers, facebookPages } from "../../drizzle/schema";
import { getDb } from "../db";
import { permissionProcedure, router } from "../_core/trpc";
import { decryptSecret } from "../_core/crypto";
import { distributeConversation } from "../services/distribution";
import { dispatchIntegrationEvent } from "../_core/integrationDispatch";
import { sendFacebookMessage } from "../_core/facebook";
import { sendCloudTemplate, sendCloudMessage } from "../whatsapp/cloud";

export const chatRouter = router({
    getOrCreateByLeadId: permissionProcedure("chat.view")
        .input(z.object({ leadId: z.number() }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            // 1. Try to find existing conversation by leadId
            const existing = await db.select()
                .from(conversations)
                .where(eq(conversations.leadId, input.leadId))
                .limit(1);

            if (existing[0]) {
                return existing[0];
            }

            // 2. Fetch lead to get phone number
            const { leads } = await import("../../drizzle/schema"); // Lazy load schema circular dependency? No, leads is in schema
            // But we need to import leads table.
            const lead = await db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1);
            if (!lead[0]) throw new Error("Lead not found");

            // 3. Try to find conversation by phone (in case it wasn't linked yet)
            const byPhone = await db.select()
                .from(conversations)
                .where(eq(conversations.contactPhone, lead[0].phone))
                .limit(1);

            if (byPhone[0]) {
                // Link it to the lead
                await db.update(conversations)
                    .set({ leadId: input.leadId, contactName: lead[0].name })
                    .where(eq(conversations.id, byPhone[0].id));
                return { ...byPhone[0], leadId: input.leadId };
            }

            // 4. Create new conversation
            // We need a default whatsapp channel. For now picking the first connected one or null if none.
            const channels = await db.select().from(whatsappConnections).where(eq(whatsappConnections.isConnected, true)).limit(1);
            const defaultChannelId = channels[0]?.whatsappNumberId;

            if (!defaultChannelId) throw new Error("No active WhatsApp channel found to start conversation");

            const result = await db.insert(conversations).values({
                channel: 'whatsapp',
                whatsappNumberId: defaultChannelId,
                contactPhone: lead[0].phone,
                contactName: lead[0].name,
                leadId: input.leadId,
                status: 'active',
                unreadCount: 0,
                assignedToId: ctx.user?.id, // Assign to current user initially
            });

            return {
                id: result[0].insertId,
                channel: 'whatsapp',
                whatsappNumberId: defaultChannelId,
                contactPhone: lead[0].phone,
                contactName: lead[0].name,
                leadId: input.leadId,
                status: 'active',
                unreadCount: 0,
                assignedToId: ctx.user?.id,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
        }),

    getById: permissionProcedure("chat.view")
        .input(z.object({ id: z.number() }))
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) return null;
            const res = await db.select().from(conversations).where(eq(conversations.id, input.id)).limit(1);
            return res[0] || null;
        }),

    listConversations: permissionProcedure("chat.view")
        .input(z.object({ whatsappNumberId: z.number().optional() }))
        .query(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) return [];

            let whereClause = input.whatsappNumberId ? eq(conversations.whatsappNumberId, input.whatsappNumberId) : undefined;

            // Privacy Filter: Agents only see their assigned chats
            const userRole = (ctx.user?.role || "viewer") as string;
            const isPrivileged = ["owner", "admin", "supervisor"].includes(userRole);

            if (!isPrivileged && ctx.user && userRole === "agent") {
                const assignedFilter = eq(conversations.assignedToId, ctx.user.id);
                whereClause = whereClause ? and(whereClause, assignedFilter) : assignedFilter;
            }

            // Drizzle requires strict undefined check logic if we want to chain .where optionally, 
            // but the cleanest way is calling .where() once.
            const query = db.select()
                .from(conversations);

            if (whereClause) {
                query.where(whereClause);
            }

            return query.orderBy(desc(conversations.lastMessageAt));
        }),

    getMessages: permissionProcedure("chat.view")
        .input(z.object({ conversationId: z.number() }))
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) return [];

            return db.select()
                .from(chatMessages)
                .where(eq(chatMessages.conversationId, input.conversationId))
                .orderBy(chatMessages.createdAt);
        }),

    getRecentMessages: permissionProcedure("monitoring.view")
        .input(
            z.object({
                limit: z.number().min(10).max(200).default(50),
                whatsappNumberId: z.number().optional(),
            })
        )
        .query(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) return [];

            const baseQuery = db
                .select({
                    id: chatMessages.id,
                    conversationId: chatMessages.conversationId,
                    whatsappNumberId: chatMessages.whatsappNumberId,
                    direction: chatMessages.direction,
                    messageType: chatMessages.messageType,
                    content: chatMessages.content,
                    mediaUrl: chatMessages.mediaUrl,
                    status: chatMessages.status,
                    createdAt: chatMessages.createdAt,
                    contactPhone: conversations.contactPhone,
                    contactName: conversations.contactName,
                    conversationStatus: conversations.status,
                    unreadCount: conversations.unreadCount,
                    lastMessageAt: conversations.lastMessageAt,
                })
                .from(chatMessages)
                .innerJoin(conversations, eq(chatMessages.conversationId, conversations.id));

            const userRole = (ctx.user?.role || "viewer") as string;
            const isPrivileged = ["owner", "admin", "supervisor"].includes(userRole);

            let whereClause = input.whatsappNumberId
                ? eq(chatMessages.whatsappNumberId, input.whatsappNumberId)
                : undefined;

            if (!isPrivileged && ctx.user && userRole === "agent") {
                const assignedFilter = eq(conversations.assignedToId, ctx.user.id);
                whereClause = whereClause ? and(whereClause, assignedFilter) : assignedFilter;
            }

            const filteredQuery = whereClause
                ? baseQuery.where(whereClause)
                : baseQuery;

            const rows = await filteredQuery
                .orderBy(desc(chatMessages.createdAt))
                .limit(input.limit);

            return rows;
        }),

    markAsRead: permissionProcedure("chat.view")
        .input(z.object({
            conversationId: z.number(),
            whatsappNumberId: z.number().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            // Update local messages status
            await db.update(chatMessages)
                .set({ status: 'read', readAt: new Date() })
                .where(and(
                    eq(chatMessages.conversationId, input.conversationId),
                    eq(chatMessages.direction, 'inbound'),
                    eq(chatMessages.status, 'delivered') // or pending
                ));

            // Reset unread count
            await db.update(conversations)
                .set({ unreadCount: 0 })
                .where(eq(conversations.id, input.conversationId));

            // Attempt to send Read Receipt to WhatsApp (Baileys)
            try {
                // Determine channel
                const conv = await db.select().from(conversations).where(eq(conversations.id, input.conversationId)).limit(1);
                if (conv[0] && conv[0].channel === 'whatsapp' && conv[0].whatsappNumberId) {
                    const { whatsappConnections } = await import("../../drizzle/schema"); // Lazy load
                    const conn = await db.select().from(whatsappConnections).where(eq(whatsappConnections.whatsappNumberId, conv[0].whatsappNumberId)).limit(1);

                    if (conn[0] && conn[0].connectionType === 'qr' && conn[0].isConnected) {
                        // Fetch unread delivered messages to mark as read remotely
                        // Actually, Baileys "readMessages" typically marks the conversation or specific IDs.
                        // For simplicity, we can fetch the last few inbound messages.
                        const unreadMsgs = await db.select({ whatsappMessageId: chatMessages.whatsappMessageId })
                            .from(chatMessages)
                            .where(and(
                                eq(chatMessages.conversationId, input.conversationId),
                                eq(chatMessages.direction, 'inbound'),
                                sql`${chatMessages.whatsappMessageId} IS NOT NULL`
                            ))
                            .orderBy(desc(chatMessages.createdAt))
                            .limit(5); // Mark last 5 to be sure.

                        const { BaileysService } = await import("../services/baileys");
                        for (const msg of unreadMsgs) {
                            if (msg.whatsappMessageId) {
                                await BaileysService.sendReadReceipt(conv[0].whatsappNumberId, conv[0].contactPhone, msg.whatsappMessageId);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to send read receipt", e);
            }

            return { success: true };
        }),

    updateStatus: permissionProcedure("chat.assign")
        .input(z.object({
            conversationId: z.number(),
            status: z.enum(["active", "archived", "blocked"])
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");
            await db.update(conversations).set({ status: input.status }).where(eq(conversations.id, input.conversationId));
            return { success: true };
        }),

    delete: permissionProcedure("chat.manage")
        .input(z.object({ conversationId: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");
            await db.delete(conversations).where(eq(conversations.id, input.conversationId));
            return { success: true };
        }),

    assign: permissionProcedure("chat.assign")
        .input(z.object({ conversationId: z.number(), assignedToId: z.number().nullable() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");
            await db.update(conversations).set({ assignedToId: input.assignedToId }).where(eq(conversations.id, input.conversationId));
            return { success: true };
        }),

    sendMessage: permissionProcedure("chat.send")
        .input(z.object({
            conversationId: z.number(),
            whatsappNumberId: z.number().optional(),
            facebookPageId: z.number().optional(),
            messageType: z.enum(['text', 'image', 'video', 'audio', 'document', 'location', 'sticker', 'contact', 'template']),
            content: z.string().optional(),
            mediaUrl: z.string().optional(),
            mediaName: z.string().optional(),
            mediaMimeType: z.string().optional(),
            latitude: z.number().optional(),
            longitude: z.number().optional(),
            locationName: z.string().optional(),
            // Template specific
            templateName: z.string().optional(),
            templateLanguage: z.string().optional(),
            templateComponents: z.array(z.any()).optional(),
            // Facebook specific
            isFacebook: z.boolean().optional(),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            const now = new Date();

            // Lookup conversation to determine channel
            const convRows = await db.select()
                .from(conversations)
                .where(eq(conversations.id, input.conversationId))
                .limit(1);
            const conv = convRows[0];
            if (!conv) throw new Error("Conversation not found");

            const isFacebook = conv.channel === 'facebook';

            const insertRes = await db.insert(chatMessages).values({
                conversationId: input.conversationId,
                whatsappNumberId: isFacebook ? null : (input.whatsappNumberId || conv.whatsappNumberId),
                facebookPageId: isFacebook ? (input.facebookPageId || conv.facebookPageId) : null,
                direction: 'outbound',
                messageType: input.messageType,
                content: input.content ?? (input.templateName ? `Template: ${input.templateName}` : null),
                mediaUrl: input.mediaUrl ?? null,
                mediaName: input.mediaName ?? null,
                mediaMimeType: input.mediaMimeType ?? null,
                latitude: input.latitude ?? null,
                longitude: input.longitude ?? null,
                locationName: input.locationName ?? null,
                status: 'pending',
            } as any);

            const id = insertRes[0].insertId as number;

            // Update conversation lastMessageAt
            await db.update(conversations)
                .set({ lastMessageAt: now })
                .where(eq(conversations.id, input.conversationId));

            if (isFacebook) {
                // --- FACEBOOK SEND LOGIC ---
                const pageId = input.facebookPageId || conv.facebookPageId;
                if (!pageId) throw new Error("Falta facebookPageId");

                // Get Page Access Token
                const pageRows = await db.select().from(facebookPages).where(eq(facebookPages.id, pageId)).limit(1);
                const page = pageRows[0];

                if (!page || !page.accessToken) throw new Error("Página de Facebook no conectada o sin token");

                const accessToken = decryptSecret(page.accessToken) || page.accessToken;
                if (!accessToken) throw new Error("Error desencriptando token de Facebook");

                // Construct message payload
                let messagePayload: any = {};

                if (input.messageType === 'text') {
                    if (!input.content) throw new Error("Mensaje vacío");
                    messagePayload = { text: input.content };
                } else if (['image', 'video', 'audio', 'file'].includes(input.messageType)) {
                    if (!input.mediaUrl) throw new Error("Falta URL de multimedia");
                    messagePayload = {
                        attachment: {
                            type: input.messageType === 'document' ? 'file' : input.messageType,
                            payload: { url: input.mediaUrl, is_reusable: true }
                        }
                    };
                } else {
                    throw new Error(`Tipo de mensaje no soportado para Facebook: ${input.messageType}`);
                }

                try {
                    const res = await sendFacebookMessage({
                        accessToken,
                        recipientId: conv.contactPhone, // In FB, contactPhone holds the PSID
                        message: messagePayload
                    });

                    await db.update(chatMessages)
                        .set({
                            status: 'sent',
                            facebookMessageId: res.messageId,
                            sentAt: now,
                        })
                        .where(eq(chatMessages.id, id));

                    return { id, success: true, sent: true };
                } catch (err: any) {
                    await db.update(chatMessages)
                        .set({ status: 'failed', errorMessage: err.message, failedAt: now })
                        .where(eq(chatMessages.id, id));
                    throw err;
                }
            } else {
                // --- WHATSAPP SEND LOGIC ---
                const whatsappNumberId = input.whatsappNumberId || conv.whatsappNumberId;
                if (!whatsappNumberId) throw new Error("Falta whatsappNumberId");

                // Lookup WhatsApp API connection
                const connRows = await db.select()
                    .from(whatsappConnections)
                    .where(eq(whatsappConnections.whatsappNumberId, whatsappNumberId))
                    .limit(1);
                const conn = connRows[0];

                if (!conn || !conn.isConnected) {
                    return { id, success: true, queued: true } as const;
                }

                // === Baileys (QR) Logic ===
                if (conn.connectionType === 'qr') {
                    try {
                        const { BaileysService } = await import("../services/baileys");

                        let payload: any = {};
                        if (input.messageType === 'text') {
                            payload = { text: input.content || "" };
                        } else if (['image', 'video', 'audio'].includes(input.messageType)) {
                            payload = {
                                [input.messageType]: { url: input.mediaUrl },
                                caption: input.content
                            };
                        } else if (input.messageType === 'document') {
                            payload = {
                                document: { url: input.mediaUrl },
                                mimetype: input.mediaMimeType || 'application/octet-stream',
                                fileName: input.mediaName || 'document'
                            };
                        }

                        const result = await BaileysService.sendMessage(whatsappNumberId, conv.contactPhone, payload);
                        const waMessageId = result?.key?.id;

                        await db.update(chatMessages)
                            .set({
                                status: 'sent',
                                whatsappMessageId: waMessageId,
                                sentAt: now
                            })
                            .where(eq(chatMessages.id, id));

                        return { id, success: true, sent: true, whatsappMessageId: waMessageId } as const;

                    } catch (err: any) {
                        const message = err?.message || "Failed to send via Baileys";
                        await db.update(chatMessages)
                            .set({ status: 'failed', errorMessage: message, failedAt: now })
                            .where(eq(chatMessages.id, id));
                        throw new Error(message);
                    }
                }

                // === Cloud API Logic (Existing) ===
                if (conn.connectionType !== 'api') {
                    // Should have been handled above if qr, so this effectively catches unknown types
                    return { id, success: true, queued: true } as const;
                }

                // Existing Cloud API Checks...
                const token = decryptSecret(conn.accessToken ?? '') ?? (conn.accessToken ?? null);
                if (!token) {
                    await db.update(chatMessages)
                        .set({ status: 'failed', errorMessage: 'Missing accessToken', failedAt: now })
                        .where(eq(chatMessages.id, id));
                    throw new Error('WhatsApp API no configurada (accessToken faltante)');
                }
                if (!conn.phoneNumberId) {
                    await db.update(chatMessages)
                        .set({ status: 'failed', errorMessage: 'Missing phoneNumberId', failedAt: now })
                        .where(eq(chatMessages.id, id));
                    throw new Error('WhatsApp API no configurada (phoneNumberId faltante)');
                }

                // Build Cloud API payload
                const mt = input.messageType;
                let payload: any;
                let waMessageId: string | undefined;

                try {
                    if (mt === 'template') {
                        if (!input.templateName) throw new Error("Missing templateName");
                        const res = await sendCloudTemplate({
                            accessToken: token,
                            phoneNumberId: conn.phoneNumberId,
                            to: conv.contactPhone,
                            templateName: input.templateName,
                            languageCode: input.templateLanguage || "es",
                            components: input.templateComponents,
                        });
                        waMessageId = res.messageId;

                    } else {
                        // Standard media/text
                        if (mt === 'text') {
                            const body = (input.content ?? '').trim();
                            if (!body) throw new Error('El mensaje de texto está vacío');
                            payload = { type: 'text', body };
                        } else if (mt === 'image' || mt === 'video' || mt === 'audio') {
                            if (!input.mediaUrl) throw new Error('Falta mediaUrl');
                            payload = { type: mt, link: input.mediaUrl, caption: input.content || undefined };
                        } else if (mt === 'document') {
                            if (!input.mediaUrl) throw new Error('Falta mediaUrl');
                            payload = {
                                type: 'document',
                                link: input.mediaUrl,
                                caption: input.content || undefined,
                                filename: input.mediaName || undefined,
                            };
                        } else if (mt === 'location') {
                            if (input.latitude == null || input.longitude == null) throw new Error('Faltan coordenadas');
                            payload = {
                                type: 'location',
                                latitude: input.latitude,
                                longitude: input.longitude,
                                name: input.locationName || undefined,
                            };
                        } else if (mt === 'sticker') {
                            if (!input.mediaUrl) throw new Error('Falta mediaUrl');
                            payload = { type: 'sticker', link: input.mediaUrl };
                        } else if (mt === 'contact') {
                            const vcard = (input.content ?? '').trim();
                            if (!vcard) throw new Error('Falta vCard para contacto');
                            payload = { type: 'contact', vcard };
                        }

                        // Send standard message
                        const res = await sendCloudMessage({
                            accessToken: token,
                            phoneNumberId: conn.phoneNumberId,
                            to: conv.contactPhone,
                            payload,
                        });
                        waMessageId = res.messageId;
                    }

                    // Update DB on success
                    await db.update(chatMessages)
                        .set({
                            status: 'sent',
                            whatsappMessageId: waMessageId,
                            sentAt: now,
                            errorMessage: null,
                            failedAt: null,
                        })
                        .where(eq(chatMessages.id, id));

                    // Bump counters
                    await db.update(whatsappNumbers)
                        .set({
                            messagesSentToday: sql`${whatsappNumbers.messagesSentToday} + 1`,
                            totalMessagesSent: sql`${whatsappNumbers.totalMessagesSent} + 1`,
                            lastConnected: now,
                        })
                        .where(eq(whatsappNumbers.id, whatsappNumberId));

                    void dispatchIntegrationEvent({
                        whatsappNumberId: whatsappNumberId,
                        event: "message_sent",
                        data: {
                            conversationId: input.conversationId,
                            chatMessageId: id,
                            whatsappMessageId: waMessageId,
                            to: conv.contactPhone,
                            messageType: mt,
                            content: input.content ?? null,
                            mediaUrl: input.mediaUrl ?? null,
                        },
                    });

                    return { id, success: true, sent: true, whatsappMessageId: waMessageId } as const;

                } catch (e: any) {
                    const message = e?.message ? String(e.message) : 'Failed to send';
                    await db.update(chatMessages)
                        .set({ status: 'failed', errorMessage: message, failedAt: now })
                        .where(eq(chatMessages.id, id));
                    throw new Error(message);
                }
            }
        }),

    createConversation: permissionProcedure("chat.send")
        .input(z.object({
            whatsappNumberId: z.number().optional(),
            facebookPageId: z.number().optional(),
            contactPhone: z.string(),
            contactName: z.string().optional(),
            leadId: z.number().optional(),
        }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not available");

            const channel = input.facebookPageId ? 'facebook' : 'whatsapp';

            // Validate required ID based on channel
            if (channel === 'whatsapp' && !input.whatsappNumberId) {
                throw new Error("Falta whatsappNumberId");
            }
            if (channel === 'facebook' && !input.facebookPageId) {
                throw new Error("Falta facebookPageId");
            }

            const result = await db.insert(conversations).values({
                channel,
                whatsappNumberId: input.whatsappNumberId ?? null,
                facebookPageId: input.facebookPageId ?? null,
                contactPhone: input.contactPhone,
                contactName: input.contactName,
                leadId: input.leadId,
                lastMessageAt: new Date(),
                status: 'active',
            } as any);

            const newConvId = result[0].insertId;

            // Attempt distribution
            try {
                await distributeConversation(newConvId);
            } catch (e) {
                console.error("[CreateConversation] Distribution failed", e);
            }

            return { id: newConvId, success: true };
        }),
});
