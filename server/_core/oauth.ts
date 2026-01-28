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
  // Dev-only quick login (useful for local testing when OAuth is not configured).
  // Enabled only when ALLOW_DEV_LOGIN=1 and OWNER_OPEN_ID is set.
  const isProd = process.env.NODE_ENV === "production";
  const allowDevLogin = !isProd && process.env.ALLOW_DEV_LOGIN === "1";

  if (allowDevLogin) {
    app.get("/api/dev/login", async (req: Request, res: Response) => {
      const openId = process.env.OWNER_OPEN_ID;
      if (!openId) return res.status(500).json({ error: "OWNER_OPEN_ID missing" });

      await db.upsertUser({
        openId,
        name: "Dev User",
        email: null,
        loginMethod: "dev",
        lastSignedIn: new Date(),
        role: "owner"
      });
      const sessionToken = await sdk.createSessionToken(openId, { name: "Dev User" });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return res.redirect(302, "/");
    });
  }

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
