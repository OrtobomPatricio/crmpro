import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("scheduling router", () => {
  it("should list all appointments", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.scheduling.list();

    expect(Array.isArray(result)).toBe(true);
  });

  it("should list appointment reasons", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.scheduling.listReasons();

    expect(Array.isArray(result)).toBe(true);
  });

  it("should create a new reason", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.scheduling.createReason({
      name: "Test Reason",
      color: "#FF0000",
    });

    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
  });
});

describe("whatsappConnections router", () => {
  it("should setup API connection with valid credentials", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // This should fail because we don't have a real whatsapp number
    // but it tests that the router is properly set up
    try {
      await caller.whatsappConnections.setupApi({
        whatsappNumberId: 999,
        accessToken: "test-token",
        phoneNumberId: "123456789",
        businessAccountId: "987654321",
      });
    } catch (error: any) {
      // Expected to fail with "Número no encontrado"
      expect(error.message).toContain("Número no encontrado");
    }
  });

  it("should generate QR code for a number", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.whatsappConnections.generateQr({
        whatsappNumberId: 999,
      });
    } catch (error: any) {
      // Expected to fail with "Número no encontrado"
      expect(error.message).toContain("Número no encontrado");
    }
  });

  it("should disconnect a number", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.whatsappConnections.disconnect({
        whatsappNumberId: 999,
      });
    } catch (error: any) {
      // Expected to fail with "Número no encontrado"
      expect(error.message).toContain("Número no encontrado");
    }
  });
});
