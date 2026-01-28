export const ENV = {
  appId: process.env.VITE_APP_ID ?? "imagine-crm",
  cookieSecret: process.env.JWT_SECRET ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
};
