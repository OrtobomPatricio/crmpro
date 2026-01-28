import { maskSecret } from "../_core/crypto";

export function sanitizeAppSettings(row: any) {
    const smtp = row.smtpConfig ? {
        ...row.smtpConfig,
        pass: undefined,
        hasPass: !!row.smtpConfig.pass,
        passMasked: row.smtpConfig.pass ? maskSecret(row.smtpConfig.pass) : null,
    } : null;

    const ai = row.aiConfig ? {
        ...row.aiConfig,
        apiKey: undefined,
        hasApiKey: !!row.aiConfig.apiKey,
        apiKeyMasked: row.aiConfig.apiKey ? maskSecret(row.aiConfig.apiKey) : null,
    } : null;

    const maps = row.mapsConfig ? {
        ...row.mapsConfig,
        apiKey: undefined,
        hasApiKey: !!row.mapsConfig.apiKey,
        apiKeyMasked: row.mapsConfig.apiKey ? maskSecret(row.mapsConfig.apiKey) : null,
    } : null;

    const storage = row.storageConfig ? {
        ...row.storageConfig,
        secretKey: undefined,
        hasSecretKey: !!row.storageConfig.secretKey,
        secretKeyMasked: row.storageConfig.secretKey ? maskSecret(row.storageConfig.secretKey) : null,
        accessKey: row.storageConfig.accessKey ? maskSecret(row.storageConfig.accessKey) : row.storageConfig.accessKey,
    } : null;

    return { ...row, smtpConfig: smtp, aiConfig: ai, mapsConfig: maps, storageConfig: storage };
}
