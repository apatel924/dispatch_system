import { describe, expect, it } from "vitest";
import { maskPhoneE164, normalizeNorthAmericanPhone } from "@/lib/server/notifications/phone";

describe("normalizeNorthAmericanPhone", () => {
  it("normalizes 10-digit numbers to E.164", () => {
    expect(normalizeNorthAmericanPhone("4035551234")).toEqual({
      ok: true,
      e164: "+14035551234",
    });
  });

  it("normalizes formatted Canadian numbers", () => {
    expect(normalizeNorthAmericanPhone("(403) 555-1234")).toEqual({
      ok: true,
      e164: "+14035551234",
    });
  });

  it("accepts +1 prefixed numbers", () => {
    expect(normalizeNorthAmericanPhone("+1 403-555-1234")).toEqual({
      ok: true,
      e164: "+14035551234",
    });
  });

  it("accepts 11-digit numbers starting with 1", () => {
    expect(normalizeNorthAmericanPhone("14035551234")).toEqual({
      ok: true,
      e164: "+14035551234",
    });
  });

  it("rejects clearly invalid numbers", () => {
    expect(normalizeNorthAmericanPhone("123")).toEqual({ ok: false });
    expect(normalizeNorthAmericanPhone("")).toEqual({ ok: false });
    expect(normalizeNorthAmericanPhone("0005551234")).toEqual({ ok: false });
    expect(normalizeNorthAmericanPhone("4030551234")).toEqual({ ok: false });
  });

  it("masks phone numbers without exposing full digits", () => {
    expect(maskPhoneE164("+14035551234")).toBe("+1 ***-***-1234");
  });
});
