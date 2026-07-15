import { describe, expect, it } from "vitest";
import {
  aggregateIntakeStatusPills,
  summarizeRowPillLists,
} from "@/lib/dash/intake-status-pills";

describe("aggregateIntakeStatusPills", () => {
  it("deduplicates repeated labels", () => {
    const result = aggregateIntakeStatusPills([
      { label: "Needs Review", tone: "warning" },
      { label: "Needs Review", tone: "warning" },
      { label: "Needs Review", tone: "warning" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.displayLabel).toBe("Needs Review · 3");
    expect(result[0]?.count).toBe(3);
  });

  it("keeps different labels visible", () => {
    const result = aggregateIntakeStatusPills([
      { label: "Ready to Dispatch", tone: "success" },
      { label: "Needs Review", tone: "warning" },
    ]);
    expect(result.map((p) => p.label)).toEqual([
      "Ready to Dispatch",
      "Needs Review",
    ]);
  });

  it("deduplicates casing variants and preserves first casing", () => {
    const result = aggregateIntakeStatusPills([
      { label: "Ready to Dispatch", tone: "success" },
      { label: " ready to dispatch ", tone: "success" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.label).toBe("Ready to Dispatch");
    expect(result[0]?.count).toBe(2);
  });

  it("returns empty for empty input (no empty footer)", () => {
    expect(aggregateIntakeStatusPills([])).toEqual([]);
    expect(summarizeRowPillLists([])).toEqual([]);
  });

  it("counts accurately across row pill lists", () => {
    const result = summarizeRowPillLists([
      [{ label: "Ready to Dispatch", tone: "success" }],
      [{ label: "Ready to Dispatch", tone: "success" }],
      [{ label: "Ready to Dispatch", tone: "success" }],
      [{ label: "Needs Review", tone: "warning" }],
    ]);
    expect(result.find((p) => p.label === "Ready to Dispatch")?.count).toBe(3);
    expect(result.find((p) => p.label === "Needs Review")?.count).toBe(1);
    expect(result.filter((p) => p.label === "Ready to Dispatch")).toHaveLength(1);
  });
});
