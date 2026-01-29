
import type { Express, Request, Response } from "express";
import { z } from "zod";
import * as db from "./db";
import { eq, and } from "drizzle-orm";
import { whatsappNumbers, whatsappConnections } from "../drizzle/schema";
import { encryptSecret } from "./_core/crypto";
import axios from "axios";

const META_API_VERSION = "v19.0";

export function registerMetaRoutes(app: Express) {

    // 1. Redirect to Facebook Login
    app.get("/api/meta/connect", (req: Request, res: Response) => {
        const appId = process.env.META_APP_ID;
        const redirectUri = `${process.env.VITE_API_URL || "http://localhost:3000"}/api/meta/callback`;
        const scope = "business_management,whatsapp_business_management,whatsapp_business_messaging";

        // State should be random string for security
        const state = Math.random().toString(36).substring(7);

        if (!appId) return res.status(500).send("META_APP_ID is not configured");

        const url = `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}&response_type=code`;

        res.redirect(url);
    });

    // 2. Handle Callback
    app.get("/api/meta/callback", async (req: Request, res: Response) => {
        const { code, state, error } = req.query;

        if (error) {
            console.error("Meta OAuth Error:", error);
            return res.redirect("/settings?tab=distribution&error=meta_auth_failed");
        }

        if (!code) {
            return res.redirect("/settings?tab=distribution&error=no_code");
        }

        try {
            const appId = process.env.META_APP_ID;
            const appSecret = process.env.META_APP_SECRET;
            const redirectUri = `${process.env.VITE_API_URL || "http://localhost:3000"}/api/meta/callback`;

            // A. Exchange code for short-lived token
            const tokenRes = await axios.get(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`, {
                params: {
                    client_id: appId,
                    client_secret: appSecret,
                    redirect_uri: redirectUri,
                    code: code.toString()
                }
            });

            const shortToken = tokenRes.data.access_token;

            // B. Exchange for Long-Lived Token
            const longTokenRes = await axios.get(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`, {
                params: {
                    grant_type: 'fb_exchange_token',
                    client_id: appId,
                    client_secret: appSecret,
                    fb_exchange_token: shortToken
                }
            });

            const accessToken = longTokenRes.data.access_token; // Long-lived

            // C. Fetch WABA and Phone Numbers
            // First get 'me' to find accounts
            // We really need the WABA ID. 
            // Strategy: Get /me/accounts -> find business -> find phone numbers? 
            // Or simpler: /me?fields=id,name,accounts...

            // Let's try to get WhatsApp Business Accounts directly if possible or iterate
            // A common pattern is: GET /me/businesses (requires implementation) or assume user selects one?
            // For automation, we'll fetch the first WABA available or use "shared_waba_id" if we are a tech provider? 
            // Assuming standard OAuth flow:

            // Let's get "me" to check identity
            const meRes = await axios.get(`https://graph.facebook.com/${META_API_VERSION}/me`, {
                params: { access_token: accessToken }
            });

            // Now find WABAs. `GET /<user_id>/whatsapp_business_accounts` would be ideal but permissions vary.
            // A robust way: `GET /me/accounts` implies Pages.
            // Let's rely on `GET /<business_id>/phone_numbers` later.
            // For now, let's fetch WABA info via `GET /me/whatsapp_business_accounts` ? No, endpoint might be `client_whatsapp_business_accounts` or `businesses`.

            // SIMPLIFICATION for "Automatic":
            // 1. Get WABAs: `GET /me/businesses` -> for each business -> `GET /<id>/client_whatsapp_business_accounts`?
            // Actually, with `whatsapp_business_management`, we can often query `GET /<user-id>/businesses`.

            // Let's try to just SAVE the token first, maybe associated with a "pending" state or update the existing connection.
            // But the user wants "discover WABA + phone_number_id".

            // Let's attempt to fetch the FIRST WABA and its FIRST phone number.
            // This is heuristic but works for single-number setups.

            // We'll traverse: me -> businesses -> waba -> phone_numbers
            // Or: `GET /me/accounts` (pages) ?? No.

            // Better: `GET /me?fields=id,name,businesses{id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_database_name,certificate,new_certificate}}}`
            // Note: `owned_whatsapp_business_accounts` works if the user owns it. If they are admin, maybe `client_whatsapp_business_accounts`.

            const details = await axios.get(`https://graph.facebook.com/${META_API_VERSION}/me`, {
                params: {
                    access_token: accessToken,
                    fields: "id,name,businesses{id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,name_status}}}"
                }
            });

            const business = details.data.businesses?.data?.[0];
            const waba = business?.owned_whatsapp_business_accounts?.data?.[0];
            const phone = waba?.phone_numbers?.data?.[0];

            if (waba && phone) {
                const database = await db.getDb();
                if (!database) {
                    console.error("Meta OAuth: DB not available");
                    return res.redirect("/settings?tab=distribution&error=db_error");
                }

                // Upsert Whatsapp Number
                // Check if exists by phone ID
                const existing = await database.select().from(whatsappConnections).where(eq(whatsappConnections.phoneNumberId, phone.id)).limit(1);

                if (existing.length > 0) {
                    await database.update(whatsappConnections).set({
                        accessToken: accessToken, // TODO: Encrypt? The schema says `text`. Ideally encrypt.
                        businessAccountId: waba.id,
                        isConnected: true,
                        updatedAt: new Date()
                    }).where(eq(whatsappConnections.id, existing[0].id));

                    // Also ensure whatsappNumbers exists and is linked?
                } else {
                    // Create number entry
                    // We might not have the raw phone number string (e.g. +549...) here unless we queried it. 
                    // `display_phone_number` usually has spaces/dashes.
                    const rawPhone = phone.display_phone_number.replace(/\D/g, "");

                    // Insert number
                    const numRes = await database.insert(whatsappNumbers).values({
                        phoneNumber: rawPhone,
                        displayName: phone.display_phone_number, // or name_status?
                        country: "Unknown", // we'd need to parse code
                        countryCode: "00",
                        status: "active",
                        isConnected: true
                    });

                    const numId = numRes[0].insertId;

                    // Insert connection
                    await database.insert(whatsappConnections).values({
                        whatsappNumberId: numId,
                        connectionType: "api",
                        phoneNumberId: phone.id,
                        businessAccountId: waba.id,
                        accessToken: accessToken,
                        isConnected: true
                    });
                }

                return res.redirect("/settings?tab=distribution&success=meta_connected");
            } else {
                // Token valid but no WABA/Phone found automatically
                // Store token separately? Or just error?
                console.warn("Meta OAuth: No WABA/Phone found automatically", JSON.stringify(details.data, null, 2));
                return res.redirect("/settings?tab=distribution&error=no_waba_found");
            }

        } catch (err: any) {
            console.error("Meta OAuth Callback Error:", err.response?.data || err.message);
            return res.redirect("/settings?tab=distribution&error=exchange_failed");
        }
    });

    // 3. Webhook Handling
    app.get("/api/meta/webhook", (req: Request, res: Response) => {
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];

        // Verify Token should be setting or ENV
        const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || "imagine_crm_verify";

        if (mode === "subscribe" && token === verifyToken) {
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    });

    app.post("/api/meta/webhook", async (req: Request, res: Response) => {
        // TODO: Implement actual event processing
        // console.log("Meta Webhook:", JSON.stringify(req.body, null, 2));
        res.sendStatus(200);
    });
}
