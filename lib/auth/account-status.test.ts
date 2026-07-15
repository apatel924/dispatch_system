import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DISABLED_CODE,
  ACCOUNT_DISABLED_MESSAGE,
  isAccountActive,
} from "@/lib/auth/account-status";

describe("isAccountActive", () => {
  it("allows active: true", () => {
    expect(isAccountActive(true)).toBe(true);
  });

  it("allows missing active for legacy accounts", () => {
    expect(isAccountActive(undefined)).toBe(true);
    expect(isAccountActive(null)).toBe(true);
  });

  it("rejects active: false", () => {
    expect(isAccountActive(false)).toBe(false);
  });

  it("fails closed on malformed activation values", () => {
    expect(isAccountActive("false")).toBe(false);
    expect(isAccountActive(0)).toBe(false);
    expect(isAccountActive({})).toBe(false);
  });

  it("exports stable disabled response constants", () => {
    expect(ACCOUNT_DISABLED_CODE).toBe("ACCOUNT_DISABLED");
    expect(ACCOUNT_DISABLED_MESSAGE).toContain("disabled");
  });
});
