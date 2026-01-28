import { ENV } from "./env";

export function validateProductionSecrets() {
    if (!ENV.isProduction) return;

    const INSECURE_DEFAULTS = [
        "dev-secret-change-me",
        "CHANGE_ME",
        "dev-owner",
        "",
    ];

    // Check JWT_SECRET
    if (INSECURE_DEFAULTS.includes(ENV.cookieSecret)) {
        throw new Error(
            "🔴 PRODUCTION SECURITY ERROR: JWT_SECRET must be set to a secure value. Cannot use default 'dev-secret-change-me'"
        );
    }

    // Check DATA_ENCRYPTION_KEY if encryption features are used
    if (ENV.dataEncryptionKey && INSECURE_DEFAULTS.includes(ENV.dataEncryptionKey)) {
        throw new Error(
            "🔴 PRODUCTION SECURITY ERROR: DATA_ENCRYPTION_KEY must be set to a secure value. Cannot use default 'CHANGE_ME'"
        );
    }

    // Check OWNER_OPEN_ID
    if (INSECURE_DEFAULTS.includes(ENV.ownerOpenId)) {
        throw new Error(
            "🔴 PRODUCTION SECURITY ERROR: OWNER_OPEN_ID must be set to a real value. Cannot use 'dev-owner'"
        );
    }

    console.log("✅ Production environment variables validated successfully");
}
