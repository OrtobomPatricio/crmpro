/**
 * Security helpers for sanitizing API responses and validating roles
 */

/**
 * Sanitize app settings before returning to client
 * CRITICAL: Don't return fake values that could be re-saved to DB
 * Instead, return metadata indicating a secret exists
 */
import { maskSecret } from "./crypto";

export function sanitizeAppSettings(settings: any) {
    if (!settings) return null;
    const s = { ...settings };

    if (s.smtpConfig) {
        const pass = s.smtpConfig.pass;
        s.smtpConfig = {
            ...s.smtpConfig,
            pass: null,
            hasPass: !!pass,
            passMasked: maskSecret(pass),
        };
    }

    if (s.aiConfig) {
        const apiKey = s.aiConfig.apiKey;
        s.aiConfig = { ...s.aiConfig, apiKey: null, hasApiKey: !!apiKey, apiKeyMasked: maskSecret(apiKey) };
    }

    if (s.mapsConfig) {
        const apiKey = s.mapsConfig.apiKey;
        s.mapsConfig = { ...s.mapsConfig, apiKey: null, hasApiKey: !!apiKey, apiKeyMasked: maskSecret(apiKey) };
    }

    if (s.storageConfig) {
        const secretKey = s.storageConfig.secretKey;
        s.storageConfig = {
            ...s.storageConfig,
            secretKey: null,
            hasSecretKey: !!secretKey,
            secretKeyMasked: maskSecret(secretKey),
        };
    }

    return s;
}

/**
 * Reserved system roles that cannot be assigned as customRole
 */
const RESERVED_SYSTEM_ROLES = new Set(["owner", "admin", "supervisor", "agent", "viewer"]);

/**
 * Validate customRole assignment
 * Blocks reserved roles and validates against permissions matrix
 */
export function validateCustomRole(customRole: string | null, permissionsMatrix: Record<string, string[]>): { valid: boolean; error?: string } {
    if (!customRole) {
        return { valid: true }; // null/empty is valid (clears customRole)
    }

    const trimmed = customRole.trim();

    // Block reserved system roles
    if (RESERVED_SYSTEM_ROLES.has(trimmed)) {
        return {
            valid: false,
            error: "Cannot assign reserved system roles (owner, admin, supervisor, agent, viewer) as customRole"
        };
    }

    // Validate role exists in matrix
    if (!permissionsMatrix[trimmed]) {
        return {
            valid: false,
            error: `Invalid customRole: '${trimmed}' not found in permissions matrix`
        };
    }

    return { valid: true };
}

/**
 * Calculate effective role for RBAC
 * CRITICAL: Never allows customRole to escalate to owner
 */
export function getEffectiveRole(baseRole: string, customRole: string | undefined | null, permissionsMatrix: Record<string, string[]>): string {
    // Owner baseRole is immutable
    if (baseRole === "owner") {
        return "owner";
    }

    // If no customRole, use baseRole
    if (!customRole) {
        return baseRole;
    }

    // Validate customRole is not reserved and exists in matrix
    const validation = validateCustomRole(customRole, permissionsMatrix);
    if (!validation.valid) {
        // Invalid customRole, fallback to baseRole
        return baseRole;
    }

    return customRole;
}
