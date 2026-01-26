import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { integrations } from "../../drizzle/schema";
import { getDb } from "../db";
import { ENV } from "./env";
import { assertSafeOutboundUrl } from "./urlSafety";

export type IntegrationEventName =
  | "message_received"
  | "message_sent"
  | "lead_created"
  | "lead_updated"
  | "campaign_started"
  | "campaign_completed";

export async function dispatchIntegrationEvent(opts: {
  whatsappNumberId: number;
  event: IntegrationEventName;
  data: unknown;
}) {
  const db = await getDb();
  if (!db) return;

  const rows = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.whatsappNumberId, opts.whatsappNumberId), eq(integrations.isActive, true)));

  if (!rows.length) return;

  const payload = {
    event: opts.event,
    timestamp: new Date().toISOString(),
    data: opts.data,
  };

  const body = JSON.stringify(payload);
  const signature = ENV.dataEncryptionKey
    ? `sha256=${crypto.createHmac("sha256", ENV.dataEncryptionKey).update(body).digest("hex")}`
    : null;

  await Promise.all(
    rows.map(async (row) => {
      const allowedEvents = (row.events ?? []) as string[];
      if (allowedEvents.length && !allowedEvents.includes("*") && !allowedEvents.includes(opts.event)) {
        return;
      }

      try {
        await assertSafeOutboundUrl(row.webhookUrl);
      } catch {
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const res = await fetch(row.webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Imaginelab-Event": opts.event,
            ...(signature ? { "X-Imaginelab-Signature": signature } : {}),
          },
          body,
          signal: controller.signal,
        });

        if (res.ok) {
          await db
            .update(integrations)
            .set({ lastTriggeredAt: new Date() })
            .where(eq(integrations.id, row.id));
        }
      } catch {
        // ignore
      } finally {
        clearTimeout(timeout);
      }
    })
  );
}
