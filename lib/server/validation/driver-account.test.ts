import { describe, expect, it } from "vitest";
import {
  UpdateDriverAccountSchema,
  validateDriverPassword,
} from "@/lib/server/validation/driver-account";

describe("validateDriverPassword", () => {
  it("requires minimum length and character classes", () => {
    expect(validateDriverPassword("short")).toMatch(/at least 8/);
    expect(validateDriverPassword("allletters")).toMatch(/number/);
    expect(validateDriverPassword("12345678")).toMatch(/letter/);
    expect(validateDriverPassword(" Secret1a")).toMatch(/spaces/);
    expect(validateDriverPassword("Secret1a ")).toMatch(/spaces/);
  });

  it("accepts strong passwords", () => {
    expect(validateDriverPassword("Secret1a")).toBeNull();
  });
});

describe("UpdateDriverAccountSchema", () => {
  it("rejects unknown authUid field from client", () => {
    const result = UpdateDriverAccountSchema.safeParse({
      authUid: "evil-uid",
      password: "Secret1a",
    });
    expect(result.success).toBe(false);
  });

  it("requires password confirmation to match", () => {
    const result = UpdateDriverAccountSchema.safeParse({
      password: "Secret1a",
      confirmPassword: "Secret1b",
    });
    expect(result.success).toBe(false);
  });

  it("normalizes login email", () => {
    const result = UpdateDriverAccountSchema.parse({
      loginEmail: "  Driver@Example.COM  ",
    });
    expect(result.loginEmail).toBe("driver@example.com");
  });
});
