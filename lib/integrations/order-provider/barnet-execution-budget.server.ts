import {
  BARNET_SYNC_EXECUTION_CLEANUP_BUFFER_MS,
  BARNET_SYNC_EXECUTION_DEADLINE_MS,
  getBarnetUpstreamTimeoutMs,
} from "@/lib/integrations/order-provider/barnet-sync-config.server";
import { BarnetSyncFailureError } from "@/lib/integrations/order-provider/barnet-sync-errors.server";

export interface BarnetExecutionBudget {
  deadlineMs: number;
  cleanupBufferMs: number;
  startedAtMs: number;
}

export function createBarnetExecutionBudget(
  startedAtMs: number = Date.now(),
  deadlineMs: number = BARNET_SYNC_EXECUTION_DEADLINE_MS,
  cleanupBufferMs: number = BARNET_SYNC_EXECUTION_CLEANUP_BUFFER_MS,
): BarnetExecutionBudget {
  return { deadlineMs, cleanupBufferMs, startedAtMs };
}

export function getBarnetExecutionRemainingMs(
  budget: BarnetExecutionBudget,
  nowMs: number = Date.now(),
): number {
  return budget.deadlineMs - (nowMs - budget.startedAtMs);
}

/**
 * Minimum wall time required before starting another upstream attempt:
 * configured timeout plus cleanup buffer.
 */
export function getBarnetMinAttemptBudgetMs(
  budget: BarnetExecutionBudget,
): number {
  return getBarnetUpstreamTimeoutMs() + budget.cleanupBufferMs;
}

export function assertBarnetExecutionBudgetForAttempt(
  budget: BarnetExecutionBudget,
  nowMs: number = Date.now(),
): void {
  const remaining = getBarnetExecutionRemainingMs(budget, nowMs);
  const required = getBarnetMinAttemptBudgetMs(budget);
  if (remaining < required) {
    throw new BarnetSyncFailureError(
      "execution_budget_exhausted",
      "Insufficient execution time remaining for another Barnet page fetch.",
    );
  }
}

export function getBarnetRetryDelayCapMs(
  budget: BarnetExecutionBudget,
  nowMs: number = Date.now(),
): number {
  const remaining = getBarnetExecutionRemainingMs(budget, nowMs);
  const required = getBarnetMinAttemptBudgetMs(budget);
  return Math.max(0, remaining - required);
}
