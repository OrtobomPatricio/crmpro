import { Request, Response, NextFunction } from "express";
import { createContext } from "../context";

/**
 * Middleware to protect routes that require authentication.
 * Uses the same context creation logic as tRPC to verify sessions.
 */
export const requireAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Create context using the same method as tRPC
        const ctx = await createContext({ req, res } as any);

        if (!ctx.user) {
            return res.status(401).json({
                error: "Unauthorized",
                message: "You must be logged in to access this resource"
            });
        }

        // User is authenticated, allow access
        // We can attach the user to the request if needed for downstream handlers, 
        // although typically they might re-create context or use this check solely for gating.
        (req as any).user = ctx.user;

        next();
    } catch (err) {
        console.error("[Auth] Authentication middleware failed:", err);
        return res.status(401).json({
            error: "Authentication failed",
            message: "Invalid or expired session"
        });
    }
};
