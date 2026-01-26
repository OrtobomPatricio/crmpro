export const ENV = {
  appId: process.env.VITE_APP_ID || "imagine-crm",
  cookieSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL || "https://dev-oauth.example.com",
  ownerOpenId: process.env.OWNER_OPEN_ID || "dev-owner",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",

  // Encryption for stored credentials (e.g., WhatsApp tokens)
  dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY ?? "",

  // WhatsApp Cloud API
  whatsappWebhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "",
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET ?? "",
  whatsappGraphVersion: process.env.WHATSAPP_GRAPH_VERSION ?? "v19.0",
  whatsappGraphBaseUrl: process.env.WHATSAPP_GRAPH_BASE_URL ?? "https://graph.facebook.com",
};
