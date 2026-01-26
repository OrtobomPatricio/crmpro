import { getDb } from "../db";
import { accessLogs } from "../../drizzle/schema";

interface LogAccessParams {
    userId?: number;
    action: string;
    entityType?: string;
    entityId?: number;
    ipAddress?: string;
    userAgent?: string;
    success?: boolean;
    errorMessage?: string;
    metadata?: any;
}

/**
 * Log an access event for security audit
 */
export async function logAccess(params: LogAccessParams) {
    const db = await getDb();
    if (!db) {
        console.warn("[Security] Cannot log access: database not available");
        return;
    }

    try {
        await db.insert(accessLogs).values({
            userId: params.userId ?? null,
            action: params.action,
            entityType: params.entityType ?? null,
            entityId: params.entityId ?? null,
            ipAddress: params.ipAddress ?? null,
            userAgent: params.userAgent ?? null,
            success: params.success ?? true,
            errorMessage: params.errorMessage ?? null,
            metadata: params.metadata ?? null,
        } as any);
    } catch (error) {
        console.error("[Security] Failed to log access:", error);
    }
}

/**
 * Extract IP address from request
 */
export function getClientIp(req: any): string | undefined {
    return (
        req.headers['x-forwarded-for']?.split(',')[0] ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress
    );
}
