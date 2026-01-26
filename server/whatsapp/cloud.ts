import { ENV } from "../_core/env";

export type CloudSendPayload =
  | { type: "text"; body: string }
  | { type: "image" | "video" | "audio" | "document"; link: string; caption?: string; filename?: string }
  | { type: "location"; latitude: number; longitude: number; name?: string; address?: string }
  | { type: "sticker"; link: string }
  | { type: "contact"; vcard: string };

export async function sendCloudMessage(opts: {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  payload: CloudSendPayload;
}): Promise<{ messageId: string }> {
  const version = ENV.whatsappGraphVersion || "v19.0";
  const base = ENV.whatsappGraphBaseUrl || "https://graph.facebook.com";
  const endpoint = `${base}/${version}/${opts.phoneNumberId}/messages`;

  const body: any = {
    messaging_product: "whatsapp",
    to: opts.to,
  };

  switch (opts.payload.type) {
    case "text":
      body.type = "text";
      body.text = { body: opts.payload.body };
      break;
    case "image":
    case "video":
    case "audio":
      body.type = opts.payload.type;
      body[opts.payload.type] = {
        link: opts.payload.link,
        ...(opts.payload.caption ? { caption: opts.payload.caption } : {}),
      };
      break;
    case "document":
      body.type = "document";
      body.document = {
        link: opts.payload.link,
        ...(opts.payload.caption ? { caption: opts.payload.caption } : {}),
        ...(opts.payload.filename ? { filename: opts.payload.filename } : {}),
      };
      break;
    case "location":
      body.type = "location";
      body.location = {
        latitude: opts.payload.latitude,
        longitude: opts.payload.longitude,
        ...(opts.payload.name ? { name: opts.payload.name } : {}),
        ...(opts.payload.address ? { address: opts.payload.address } : {}),
      };
      break;
    case "sticker":
      body.type = "sticker";
      body.sticker = { link: opts.payload.link };
      break;
    case "contact":
      // WhatsApp Cloud API expects contacts array; we use vcard-only contact
      body.type = "contacts";
      body.contacts = [{ vcard: opts.payload.vcard }];
      break;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const msg = (data as any)?.error?.message || `WhatsApp API error ${res.status}`;
    throw new Error(msg);
  }

  const messageId = (data as any)?.messages?.[0]?.id;
  if (!messageId) {
    throw new Error("WhatsApp API: missing message id");
  }

  return { messageId };
}

export async function sendCloudTemplate(opts: {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  templateName: string;
  languageCode: string;
  components?: any[];
}): Promise<{ messageId: string }> {
  const version = ENV.whatsappGraphVersion || "v19.0";
  const base = ENV.whatsappGraphBaseUrl || "https://graph.facebook.com";
  const endpoint = `${base}/${version}/${opts.phoneNumberId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    to: opts.to,
    type: "template",
    template: {
      name: opts.templateName,
      language: { code: opts.languageCode },
      components: opts.components || [],
    },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const msg = (data as any)?.error?.message || `WhatsApp API error ${res.status}`;
    throw new Error(msg);
  }

  const messageId = (data as any)?.messages?.[0]?.id;
  if (!messageId) {
    throw new Error("WhatsApp API: missing message id");
  }

  return { messageId };
}

export async function markCloudMessageAsRead(opts: {
  accessToken: string;
  phoneNumberId: string;
  messageId: string;
}): Promise<void> {
  const version = ENV.whatsappGraphVersion || "v19.0";
  const base = ENV.whatsappGraphBaseUrl || "https://graph.facebook.com";
  const endpoint = `${base}/${version}/${opts.phoneNumberId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    status: "read",
    message_id: opts.messageId,
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({} as any));
    const msg = (data as any)?.error?.message || `WhatsApp API error ${res.status}`;
    throw new Error(msg);
  }
}
