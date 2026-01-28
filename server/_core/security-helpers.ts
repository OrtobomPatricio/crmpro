/**
 * Security helpers for sanitizing API responses and validating roles
 */

/**
 * Sanitize app settings before returning to client
 * CRITICAL: Don't return fake values that could be re-saved to DB
 * Instead, return metadata indicating a secret exists
 */
export function sanitizeAppSettings(settings: any) {
    if (!settings) return null;

    const sanitized = { ...settings };

    // SMTP: Remove password, indicate it exists
    if (sanitized.smtpConfig?.pass) {
        const { pass, ...rest } = sanitized.smtpConfig;
        sanitized.smtpConfig = { ...rest, hasPassword: true };
    }

    // AI: Remove API key, indicate it exists
    if (sanitized.aiConfig?.apiKey) {
        const { apiKey, ...rest } = sanitized.aiConfig;
        sanitized.aiConfig = { ...rest, hasApiKey: true };
    }

    // Maps: Remove API key, indicate it exists
    if (sanitized.mapsConfig?.apiKey) {
        const { apiKey, ...rest } = sanitized.mapsConfig;
        sanitized.mapsConfig = { ...rest, hasApiKey: true };
    }

    // Storage: Remove secret key, indicate it exists
    if (sanitized.storageConfig?.secretKey) {
        const { secretKey, ...rest } = sanitized.storageConfig;
        sanitized.storageConfig = { ...rest, hasSecretKey: true };
    }

    return sanitized;
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
