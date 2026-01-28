/**
 * Normalizes a phone number to E.164 format.
 * - Removes non-digit characters.
 * - If it starts with '0', it removes it (assuming local format).
 * - If no country code is detected (length <= 10), it defaults to Paraguay (+595).
 * - Otherwise, it ensures it starts with '+'.
 */
export function normalizePhone(phone: string): string {
    if (!phone) return "";

    // 1. Remove all non-digit characters (keep + if at start, but we'll re-add it manually to be safe)
    let cleaned = phone.replace(/\D/g, "");

    // 2. Heuristic for local Paraguay numbers (Example: 0981... -> 981...)
    if (cleaned.startsWith("0")) {
        cleaned = cleaned.substring(1);
    }

    // 3. Heuristic: If length is 9 digits (typical PY mobile without 0), assume PY (+595)
    //    If length is less than 10, it's likely a local number without country code.
    //    NOTE: This is a simplified heuristic for this specific CRM context.
    if (cleaned.length === 9) {
        return `+595${cleaned}`;
    }

    // 4. If it already seems to have a country code (length > 10, e.g. 54911...), prepend +
    if (cleaned.length > 9) {
        return `+${cleaned}`;
    }

    // Fallback: return as is with +
    return `+${cleaned}`;
}

/**
 * Validates if a string looks like a valid E.164 phone number.
 * Must start with + and have at least 10 digits total.
 */
export function isValidE164(phone: string): boolean {
    const re = /^\+[1-9]\d{9,14}$/;
    return re.test(phone);
}
