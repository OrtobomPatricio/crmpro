export const ENV = {
  appId: process.env.VITE_APP_ID ?? "imagine-crm",
  cookieSecret: process.env.JWT_SECRET ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  whatsappGraphVersion: process.env.WHATSAPP_GRAPH_VERSION ?? "v19.0",
  whatsappGraphBaseUrl: process.env.WHATSAPP_GRAPH_BASE_URL ?? "https://graph.facebook.com",
  whatsappWebhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "",
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET ?? "",
  forgeApiUrl: process.env.FORGE_API_URL ?? "",
  forgeApiKey: process.env.FORGE_API_KEY ?? "",
};
