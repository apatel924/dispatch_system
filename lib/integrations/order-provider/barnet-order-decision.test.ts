import { describe, expect, it } from "vitest";
import type { BarnetOrderRaw } from "@/lib/integrations/order-provider/barnet-client.server";
import {
  evaluateBarnetOrderDecision,
  evaluateNormalizedOrderReview,
} from "@/lib/integrations/order-provider/barnet-order-decision";
import { classifyBarnetOrder } from "@/lib/integrations/order-provider/classify-barnet-order";
import { normalizeBarnetOrder } from "@/lib/integrations/order-provider/normalize-barnet-order";

function deliveryRaw(overrides: Partial<BarnetOrderRaw> = {}): BarnetOrderRaw {
  return {
    id: 9001,
    number: 9001,
    is_delivery: true,
    total: 25,
    timestamp: "2026-07-14T12:00:00Z",
    address: "123 Main St",
    city: "Edmonton",
    state: "AB",
    zip: "T5J 0A1",
    customer_id: 42,
    items: [{ name: "Widget", quantity: 1, price: 25 }],
    ...overrides,
  };
}

describe("evaluateBarnetOrderDecision", () => {
  it("aligns preview and sync: delivery classification is shared", () => {
    const raw = deliveryRaw();
    const decision = evaluateBarnetOrderDecision(raw);
    expect(classifyBarnetOrder(raw)).toBe("delivery");
    expect(decision.classification).toBe("delivery");
    expect(decision.persistable).toBe(true);
    expect(decision.dispatchReady).toBe(true);
    expect(decision.needsReview).toBe(false);
  });

  it("excludes pickup orders from persistence", () => {
    const raw: BarnetOrderRaw = {
      id: 1,
      is_delivery: false,
      delivery_status: "Pickup at Store",
    };
    const decision = evaluateBarnetOrderDecision(raw);
    expect(decision.classification).toBe("pickup");
    expect(decision.persistable).toBe(false);
    expect(decision.exclusionReason).toBe("pickup");
  });

  it("marks missing-address delivery as persistable needs-review", () => {
    const raw = deliveryRaw({
      address: "",
      city: "",
      state: "",
      zip: "",
    });
    delete (raw as { address?: string }).address;
    delete (raw as { city?: string }).city;
    delete (raw as { state?: string }).state;
    delete (raw as { zip?: string }).zip;

    const decision = evaluateBarnetOrderDecision(raw);
    expect(decision.classification).toBe("delivery");
    expect(decision.persistable).toBe(true);
    expect(decision.dispatchReady).toBe(false);
    expect(decision.needsReview).toBe(true);
    expect(decision.reviewReasons).toContain("missing_address");
    expect(decision.exclusionReason).toBeNull();
  });

  it("rejects missing provider order id as invalid (not reviewable)", () => {
    const raw = deliveryRaw();
    delete (raw as { id?: number }).id;
    const decision = evaluateBarnetOrderDecision(raw);
    expect(decision.persistable).toBe(false);
    expect(decision.exclusionReason).toBe("missing_provider_order_id");
  });

  it("normalize + decision agree on needs-review for missing address", () => {
    const raw = deliveryRaw();
    delete (raw as { address?: string }).address;
    delete (raw as { city?: string }).city;
    delete (raw as { state?: string }).state;
    delete (raw as { zip?: string }).zip;

    const normalized = normalizeBarnetOrder(raw);
    const decision = evaluateBarnetOrderDecision(raw);
    const review = evaluateNormalizedOrderReview(normalized);

    expect(normalized.needsReview).toBe(true);
    expect(decision.needsReview).toBe(true);
    expect(review.needsReview).toBe(true);
    expect(normalized.reviewReasons).toContain("missing_address");
    expect(decision.reviewReasons).toContain("missing_address");
  });
});
