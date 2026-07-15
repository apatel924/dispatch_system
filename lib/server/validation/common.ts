import { z } from "zod";
import {
  CANONICAL_ORDER_STATUSES,
  tryNormalizeOrderStatus,
} from "@/lib/order-status";

/** Accepts canonical statuses and legacy aliases; outputs canonical. */
export const OrderStatusSchema = z.string().transform((raw, ctx) => {
  const normalized = tryNormalizeOrderStatus(raw);
  if (!normalized) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid order status: ${raw}`,
    });
    return z.NEVER;
  }
  return normalized;
});

export const CanonicalOrderStatusSchema = z.enum(
  CANONICAL_ORDER_STATUSES as unknown as [string, ...string[]],
);

export const PaymentStatusSchema = z.enum(["Paid", "Pending", "Unpaid"]);

export const DeliveryStepKeySchema = z.enum([
  "arrivedPickup",
  "pickedUp",
  "outForDelivery",
  "arrivedDestination",
  "verifyId",
  "signature",
  "exteriorPhoto",
]);

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  cursor: z.string().optional(),
});

export const IsoDateQuerySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, "Expected ISO date string")
  .optional();
