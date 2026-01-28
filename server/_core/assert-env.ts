import { ENV } from "./env";

export function assertEnv() {
    const isProd = process.env.NODE_ENV === "production";

    // siempre requerido si vas a usar auth
    if (!ENV.cookieSecret || ENV.cookieSecret === "dev-secret-change-me") {
        throw new Error("JWT_SECRET missing or unsafe");
    }

    // requerido si encriptas secretos (deberias)
    if (!ENV.dataEncryptionKey) {
        throw new Error("DATA_ENCRYPTION_KEY missing");
    }

    // requerido para poder asignar owner de forma controlada
    if (!ENV.ownerOpenId) {
        throw new Error("OWNER_OPEN_ID missing");
    }

    if (isProd && !process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL missing in production");
    }
}
