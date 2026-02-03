import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import { getDb } from "../db";
import { conversations, chatMessages, whatsappConnections, users, campaignRecipients, campaigns } from "../../drizzle/schema";
import { and, eq, sql } from "drizzle-orm";
import { ENV } from "../_core/env";
import { dispatchIntegrationEvent } from "../_core/integrationDispatch";

function verifySignature(req: Request): boolean {
  const secret = ENV.whatsappAppSecret;
  if (!secret) return true; // optional

  const header = (req.headers["x-hub-signature-256"] as string | undefined) ?? "";
  if (!header.startsWith("sha256=")) return false;
  const signature = header.slice("sha256=".length);
  const raw = (req as any).rawBody as Buffer | undefined;
  if (!raw || raw.length === 0) return false;

  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

async function getWhatsappNumberIdByPhoneNumberId(phoneNumberId: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ whatsappNumberId: whatsappConnections.whatsappNumberId })
    .from(whatsappConnections)
    .where(eq(whatsappConnections.phoneNumberId, phoneNumberId))
    .limit(1);
  return rows[0]?.whatsappNumberId ?? null;
}

export function registerWhatsAppWebhookRoutes(app: Express) {
  // Verification endpoint (Meta)
  app.get("/api/whatsapp/webhook", (req: Request, res: Response) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === ENV.whatsappWebhookVerifyToken) {
      return res.status(200).send(String(challenge ?? ""));
    }
    return res.status(403).send("Forbidden");
  });

  // Incoming notifications
  app.post("/api/whatsapp/webhook", async (req: Request, res: Response) => {
    try {
      console.log("📨 [Webhook] Received payload from Meta");

      if (!verifySignature(req)) {
        console.warn("⚠️ [Webhook] Signature verification failed!");
        return res.status(401).json({ ok: false });
      }

      const payload: any = req.body ?? {};
      console.log("📨 [Webhook] Payload:", JSON.stringify(payload, null, 2));

      const entries: any[] = Array.isArray(payload.entry) ? payload.entry : [];

      for (const entry of entries) {
        const changes: any[] = Array.isArray(entry.changes) ? entry.changes : [];
        for (const change of changes) {
          const value = change.value ?? {};
          const phoneNumberId = value?.metadata?.phone_number_id;
          if (!phoneNumberId) {
            console.log("⚠️ [Webhook] No phone_number_id found in change");
            continue;
          }

          console.log(`🔎 [Webhook] Processing event for Phone ID: ${phoneNumberId}`);

          const whatsappNumberId = await getWhatsappNumberIdByPhoneNumberId(String(phoneNumberId));
          if (!whatsappNumberId) {
            console.error(`❌ [Webhook] No connected number found for Phone ID: ${phoneNumberId}`);
            continue;
          }

          // 1) Status updates for outbound messages
          const statuses: any[] = Array.isArray(value.statuses) ? value.statuses : [];
          if (statuses.length > 0) {
            console.log(`📊 [Webhook] Processing ${statuses.length} status updates`);
            const db = await getDb();
            if (db) {
              for (const st of statuses) {
                const msgId = String(st.id ?? "");
                const status = String(st.status ?? "");

                // ... (existing logic for status updates)
                // We keep the existing logic but maybe add a log

                if (!msgId) continue;

                // ... (rest of status logic same as before, assume it's fine or I can just include it if I want to be safe interacting with tools)
                // To avoid replacing massive chunks, I will try to keep the diff minimal but I need to include the "statuses" block structure to be safe.
                // Actually, since I am replacing the whole app.post function, I need to include EVERYTHING.

                // Let's copy the status logic from previous file view content.
                // ... logic for status ...

                const now = new Date();
                const patch: any = {};
                if (status === "sent") {
                  patch.status = "sent";
                  patch.sentAt = now;
                } else if (status === "delivered") {
                  patch.status = "delivered";
                  patch.deliveredAt = now;
                } else if (status === "read") {
                  patch.status = "read";
                  patch.readAt = now;
                } else if (status === "failed") {
                  patch.status = "failed";
                }

                if (Object.keys(patch).length > 0) {
                  await db
                    .update(chatMessages)
                    .set(patch)
                    .where(eq(chatMessages.whatsappMessageId, msgId));
                }

                // Also track campaign delivery/read if this message belongs to a campaign recipient
                const rec = await db
                  .select({
                    id: campaignRecipients.id,
                    campaignId: campaignRecipients.campaignId,
                    currentStatus: campaignRecipients.status,
                  })
                  .from(campaignRecipients)
                  .where(eq(campaignRecipients.whatsappMessageId, msgId))
                  .limit(1);

                if (rec[0]) {
                  const current = String(rec[0].currentStatus ?? "pending");
                  const campaignId = rec[0].campaignId;
                  const safeNow = new Date();
                  // Idempotent transitions (avoid double counting)
                  if (status === "delivered") {
                    if (current !== "delivered" && current !== "read") {
                      await db.update(campaignRecipients).set({ status: "delivered", deliveredAt: safeNow }).where(eq(campaignRecipients.id, rec[0].id));
                      await db.update(campaigns).set({ messagesDelivered: sql`${campaigns.messagesDelivered} + 1` }).where(eq(campaigns.id, campaignId));
                    }
                  } else if (status === "read") {
                    if (current !== "read") {
                      await db.update(campaignRecipients).set({ status: "read", readAt: safeNow }).where(eq(campaignRecipients.id, rec[0].id));
                      if (current !== "delivered") {
                        await db.update(campaigns).set({ messagesDelivered: sql`${campaigns.messagesDelivered} + 1` }).where(eq(campaigns.id, campaignId));
                      }
                      await db.update(campaigns).set({ messagesRead: sql`${campaigns.messagesRead} + 1` }).where(eq(campaigns.id, campaignId));
                    }
                  } else if (status === "failed") {
                    if (current !== "failed") {
                      await db.update(campaignRecipients).set({ status: "failed", errorMessage: "Meta status failed" }).where(eq(campaignRecipients.id, rec[0].id));
                      await db.update(campaigns).set({ messagesFailed: sql`${campaigns.messagesFailed} + 1` }).where(eq(campaigns.id, campaignId));
                    }
                  } else if (status === "sent") {
                    if (current === "pending") {
                      await db.update(campaignRecipients).set({ status: "sent", sentAt: safeNow }).where(eq(campaignRecipients.id, rec[0].id));
                    }
                  }
                }
              }
            }
          }

          // 2) Incoming messages
          const messages: any[] = Array.isArray(value.messages) ? value.messages : [];
          if (messages.length > 0) {
            console.log(`📩 [Webhook] Processing ${messages.length} incoming messages`);

            const contact = Array.isArray(value.contacts) ? value.contacts[0] : undefined;
            const contactPhone = String(contact?.wa_id ?? messages[0]?.from ?? "");
            const contactName = contact?.profile?.name ? String(contact.profile.name) : null;

            if (!contactPhone) {
              console.warn("⚠️ [Webhook] Could not determine contact phone");
              continue;
            }

            const db = await getDb();
            if (!db) continue;

            // Find or create conversation
            let convo = await db
              .select()
              .from(conversations)
              .where(and(eq(conversations.whatsappNumberId, whatsappNumberId), eq(conversations.contactPhone, contactPhone)))
              .limit(1);

            let conversationId = convo[0]?.id as number | undefined;
            if (!conversationId) {
              console.log(`🆕 [Webhook] Creating new conversation for ${contactPhone}`);
              const inserted = await db.insert(conversations).values({
                whatsappNumberId,
                contactPhone,
                contactName,
                lastMessageAt: new Date(),
                unreadCount: 1,
                status: "active",
              });
              conversationId = inserted[0].insertId as number;
            } else {
              console.log(`🔄 [Webhook] Updating conversation ${conversationId}`);
              await db
                .update(conversations)
                .set({
                  ...(contactName ? { contactName } : {}),
                  lastMessageAt: new Date(),
                  unreadCount: sql`${conversations.unreadCount} + 1`,
                })
                .where(eq(conversations.id, conversationId));
            }

            for (const m of messages) {
              const msgType = String(m.type ?? "text");
              const waMsgId = m.id ? String(m.id) : undefined;
              console.log(`💬 [Webhook] Message Type: ${msgType}, WA ID: ${waMsgId}`);

              let messageType: any = "text";
              let content: string | null = null;
              let mediaUrl: string | null = null;
              let mediaMimeType: string | null = null;
              let latitude: any = null;
              let longitude: any = null;
              let locationName: string | null = null;

              if (msgType === "text") {
                messageType = "text";
                content = m.text?.body ? String(m.text.body) : null;
              } else if (msgType === "image" || msgType === "video" || msgType === "audio" || msgType === "document" || msgType === "sticker") {
                messageType = msgType;
                content = m[msgType]?.caption ? String(m[msgType].caption) : null;
                mediaUrl = m[msgType]?.id ? String(m[msgType].id) : null;
                mediaMimeType = m[msgType]?.mime_type ? String(m[msgType].mime_type) : null;
              } else if (msgType === "location") {
                messageType = "location";
                const loc = m.location ?? {};
                latitude = loc.latitude ?? null;
                longitude = loc.longitude ?? null;
                locationName = loc.name ? String(loc.name) : null;
                content = loc.address ? String(loc.address) : null;
              } else if (msgType === "contacts") {
                messageType = "contact";
                content = JSON.stringify(m.contacts ?? []);
              } else {
                messageType = "text";
                content = JSON.stringify(m);
              }

              await db.insert(chatMessages).values({
                conversationId,
                whatsappNumberId,
                direction: "inbound",
                messageType,
                content,
                mediaUrl,
                mediaMimeType,
                latitude: latitude ?? undefined,
                longitude: longitude ?? undefined,
                locationName,
                status: "delivered",
                whatsappMessageId: waMsgId,
                deliveredAt: new Date(),
              });

              console.log(`✅ [Webhook] Message saved to DB (Conversation ${conversationId})`);

              void dispatchIntegrationEvent({
                whatsappNumberId,
                event: "message_received",
                data: {
                  conversationId,
                  from: contactPhone,
                  contactName,
                  messageType,
                  content,
                  mediaUrl,
                  mediaMimeType,
                  latitude: latitude ?? null,
                  longitude: longitude ?? null,
                  locationName,
                  whatsappMessageId: waMsgId ?? null,
                },
              });
            }
          }
        }
      }

      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("🔴 [Webhook] Critical Error:", e);
      return res.status(200).json({ ok: true });
    }
  });
}
