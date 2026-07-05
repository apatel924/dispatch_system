import { z } from "zod";

export const OrderStatusSchema = z.enum([
  "New",
  "Assigned",
  "Picked Up",
  "En Route",
  "Out for Delivery",
  "Delivered",
  "Failed",
  "Returned",
  "Scheduled",
]);

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
