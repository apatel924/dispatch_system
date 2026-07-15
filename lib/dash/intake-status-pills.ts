/**
 * Deduplicate Live Intake summary StatusPills by normalized semantic label.
 * Per-row pills are unchanged; this is for footer/summary aggregation only.
 */

export type IntakeStatusPillTone = "success" | "warning" | "muted" | "info" | "primary";

export interface IntakeStatusPill {
  label: string;
  tone: IntakeStatusPillTone;
}

export interface AggregatedIntakeStatusPill extends IntakeStatusPill {
  count: number;
  /** Display label with optional count, e.g. "Ready to Dispatch · 4" */
  displayLabel: string;
}

function normalizePillLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Aggregate pills across rows: same label (case/whitespace-insensitive) merges,
 * preferred casing is the first seen label, with an accurate count.
 */
export function aggregateIntakeStatusPills(
  pills: ReadonlyArray<IntakeStatusPill>,
): AggregatedIntakeStatusPill[] {
  const order: string[] = [];
  const byKey = new Map<
    string,
    { label: string; tone: IntakeStatusPillTone; count: number }
  >();

  for (const pill of pills) {
    const key = normalizePillLabel(pill.label);
    if (!key) continue;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    byKey.set(key, {
      label: pill.label.trim().replace(/\s+/g, " "),
      tone: pill.tone,
      count: 1,
    });
    order.push(key);
  }

  return order.map((key) => {
    const entry = byKey.get(key)!;
    return {
      label: entry.label,
      tone: entry.tone,
      count: entry.count,
      displayLabel:
        entry.count > 1 ? `${entry.label} · ${entry.count}` : entry.label,
    };
  });
}

/** Build deduped summary pills from per-row pill lists. */
export function summarizeRowPillLists(
  rowPillLists: ReadonlyArray<ReadonlyArray<IntakeStatusPill>>,
): AggregatedIntakeStatusPill[] {
  return aggregateIntakeStatusPills(rowPillLists.flat());
}
