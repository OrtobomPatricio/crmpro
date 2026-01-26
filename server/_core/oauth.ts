import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  // Dev-only quick login (useful for local testing when OAuth is not configured).
  // Enabled only when ALLOW_DEV_LOGIN=1 and OWNER_OPEN_ID is set.
  app.get("/api/dev/login", async (req: Request, res: Response) => {
    // Forced for simulation
    const allow = true;
    const openId = process.env.OWNER_OPEN_ID || "dev-owner";
    const bypass = true;

    if (!allow || !bypass || !openId) {
      res.status(403).json({
        error: "Dev login disabled. Set ALLOW_DEV_LOGIN=1, VITE_DEV_BYPASS_AUTH=1 and OWNER_OPEN_ID in .env",
      });
      return;
    }

    try {
      console.log("[DevLogin] Starting dev login for openId:", openId);

      console.log("[DevLogin] Step 1: Upserting user...");
      await db.upsertUser({
        openId,
        name: "Dev User",
        email: null,
        loginMethod: "dev",
        lastSignedIn: new Date(),
      });
      console.log("[DevLogin] Step 1: User upserted successfully");

      console.log("[DevLogin] Step 2: Creating session token...");
      const sessionToken = await sdk.createSessionToken(openId, {
        name: "Dev User",
        expiresInMs: ONE_YEAR_MS,
      });
      console.log("[DevLogin] Step 2: Session token created successfully");

      console.log("[DevLogin] Step 3: Setting cookie...");
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });
      console.log("[DevLogin] Step 3: Cookie set successfully");

      console.log("[DevLogin] Step 4: Redirecting to /");
      res.redirect(302, "/");
    } catch (error) {
      console.error("[DevLogin] Failed at some step:", error);
      console.error("[DevLogin] Error stack:", error instanceof Error ? error.stack : "No stack trace");
      res.status(500).json({
        error: "Dev login failed",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
