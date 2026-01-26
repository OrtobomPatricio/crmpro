
import { z } from "zod";

const FACEBOOK_GRAPH_URL = "https://graph.facebook.com/v19.0";

interface SendFacebookMessageParams {
    accessToken: string;
    recipientId: string;
    message: {
        text?: string;
        attachment?: {
            type: "image" | "video" | "audio" | "file" | "template";
            payload: any;
        };
    };
}

export async function sendFacebookMessage(params: SendFacebookMessageParams) {
    const url = `${FACEBOOK_GRAPH_URL}/me/messages?access_token=${params.accessToken}`;

    const body = {
        recipient: { id: params.recipientId },
        message: params.message,
        messaging_type: "RESPONSE",
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Facebook Send Error:", JSON.stringify(errorData, null, 2));
        throw new Error(`Facebook API Error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return { messageId: data.message_id };
}

export async function getFacebookUserProfile(psid: string, accessToken: string) {
    const url = `${FACEBOOK_GRAPH_URL}/${psid}?fields=first_name,last_name,profile_pic&access_token=${accessToken}`;

    const response = await fetch(url);
    if (!response.ok) return null;

    return await response.json();
}
