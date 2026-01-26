import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("dashboard.getStats", () => {
  it("returns dashboard statistics with correct structure", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.getStats();

    // Verify the structure of the response
    expect(result).toHaveProperty("totalLeads");
    expect(result).toHaveProperty("totalNumbers");
    expect(result).toHaveProperty("activeNumbers");
    expect(result).toHaveProperty("warmingUpNumbers");
    expect(result).toHaveProperty("blockedNumbers");
    expect(result).toHaveProperty("messagesToday");
    expect(result).toHaveProperty("conversionRate");
    expect(result).toHaveProperty("warmupNumbers");
    expect(result).toHaveProperty("countriesDistribution");
    expect(result).toHaveProperty("recentLeads");

    // Verify types
    expect(typeof result.totalLeads).toBe("number");
    expect(typeof result.totalNumbers).toBe("number");
    expect(typeof result.activeNumbers).toBe("number");
    expect(typeof result.warmingUpNumbers).toBe("number");
    expect(typeof result.blockedNumbers).toBe("number");
    // messagesToday puede ser string o number dependiendo de la implementación
    expect(["string", "number"]).toContain(typeof result.messagesToday);
    expect(typeof result.conversionRate).toBe("number");
    expect(Array.isArray(result.warmupNumbers)).toBe(true);
    expect(Array.isArray(result.countriesDistribution)).toBe(true);
    expect(Array.isArray(result.recentLeads)).toBe(true);
  });

  it("returns non-negative values for all numeric fields", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.getStats();

    expect(result.totalLeads).toBeGreaterThanOrEqual(0);
    expect(result.totalNumbers).toBeGreaterThanOrEqual(0);
    expect(result.activeNumbers).toBeGreaterThanOrEqual(0);
    expect(result.warmingUpNumbers).toBeGreaterThanOrEqual(0);
    expect(result.blockedNumbers).toBeGreaterThanOrEqual(0);
    // messagesToday puede ser string, convertir a número
    expect(Number(result.messagesToday)).toBeGreaterThanOrEqual(0);
    expect(result.conversionRate).toBeGreaterThanOrEqual(0);
    expect(result.conversionRate).toBeLessThanOrEqual(100);
  });
});
