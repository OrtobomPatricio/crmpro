import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { getDb } from "../db";
import { appSettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getEffectiveRole } from "./security-helpers";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  // If user is disabled, treat as logged out
  if ((ctx.user as any).isActive === false) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

// --- Pro RBAC / Permissions ---

export type Role = "owner" | "admin" | "supervisor" | "agent" | "viewer";

const DEFAULT_PERMISSIONS_MATRIX: Record<Role, string[]> = {
  owner: ["*"],
  admin: [
    "dashboard.*",
    "leads.*",
    "kanban.*",
    "campaigns.*",
    "chat.*",
    "scheduling.*",
    "monitoring.*",
    "analytics.*",
    "reports.*",
    "integrations.*",
    "settings.*",
    "users.*",
  ],
  supervisor: [
    "dashboard.view",
    "leads.view",
    "kanban.view",
    "chat.*",
    "monitoring.*",
    "analytics.view",
    "reports.view",
  ],
  agent: ["dashboard.view", "leads.*", "kanban.*", "chat.*", "scheduling.*"],
  viewer: ["dashboard.view", "leads.view", "kanban.view", "analytics.view", "reports.view"],
};

function matchPermission(granted: string, required: string): boolean {
  if (granted === "*") return true;
  if (granted === required) return true;
  if (granted.endsWith(".*")) {
    const base = granted.slice(0, -2);
    return required.startsWith(base + ".");
  }
  return false;
}

async function loadPermissionsMatrix(): Promise<Record<string, string[]>> {
  const db = await getDb();
  if (!db) return DEFAULT_PERMISSIONS_MATRIX;

  const existing = await db.select().from(appSettings).limit(1);
  if (existing.length === 0) {
    await db.insert(appSettings).values({
      companyName: "Imagine Lab CRM",
      timezone: "America/Asuncion",
      language: "es",
      currency: "PYG",
      permissionsMatrix: DEFAULT_PERMISSIONS_MATRIX,
      scheduling: { slotMinutes: 15, maxPerSlot: 6, allowCustomTime: true },
    });
    return DEFAULT_PERMISSIONS_MATRIX;
  }

  return existing[0]?.permissionsMatrix ?? DEFAULT_PERMISSIONS_MATRIX;
}

async function hasPermission(role: string, required: string): Promise<boolean> {
  // Owner is god mode
  if (role === "owner") return true;
  const matrix = await loadPermissionsMatrix();
  const grantedList = matrix[role] ?? [];
  return grantedList.some(p => matchPermission(p, required));
}

export const permissionProcedure = (permission: string) =>
  protectedProcedure.use(
    t.middleware(async opts => {
      const { ctx, next } = opts;

      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      }

      // Disabled user cannot access anything
      if ((ctx.user as any).isActive === false) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      }

      const baseRole = (ctx.user as any).role ?? "agent";
      const customRole = (ctx.user as any).customRole as string | undefined;

      // Load permissions matrix for validation
      const matrix = await loadPermissionsMatrix();

      // CRITICAL: Use helper to prevent owner escalation via customRole
      const effectiveRole = getEffectiveRole(baseRole, customRole, matrix);

      const allowed = await hasPermission(effectiveRole, permission);
      if (!allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
      }

      return next({
        ctx: {
          ...ctx,
          user: ctx.user,
        },
      });
    })
  );

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || (ctx.user.role !== 'admin' && (ctx.user as any).role !== 'owner')) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
