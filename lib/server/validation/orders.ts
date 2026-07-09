import { z } from "zod";
import {
  DeliveryStepKeySchema,
  OrderStatusSchema,
  PaginationQuerySchema,
  PaymentStatusSchema,
} from "@/lib/server/validation/common";

export const CreateOrderSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  customerEmail: z.string().email().optional(),
  companyName: z.string().optional(),
  pickupName: z.string().min(1),
  pickupAddress: z.string().min(1),
  deliveryAddress: z.string().min(1),
  deliveryUnit: z.string().optional(),
  deliveryArea: z.string().optional(),
  deliveryInstructions: z.string().optional(),
  deliveryWindow: z.string().optional(),
  externalOrderId: z.string().optional(),
  externalProvider: z.string().optional(),
  externalOrderNumber: z.string().optional(),
  externalOrderRef: z.string().optional(),
  promotedAt: z.string().optional(),
  trackingId: z.string().optional(),
  paymentStatus: PaymentStatusSchema.optional().default("Pending"),
  paymentMethod: z.string().optional(),
  subtotalCents: z.number().int().nonnegative().optional(),
  deliveryFeeCents: z.number().int().nonnegative().optional(),
  taxCents: z.number().int().nonnegative().optional(),
  totalCents: z.number().int().nonnegative(),
  eta: z.string().optional(),
  notes: z.string().optional(),
  scheduledFor: z.string().optional(),
  assignedDriverId: z.string().nullable().optional(),
  source: z.string().optional().default("manual"),
});

export const UpdateOrderSchema = CreateOrderSchema.partial().extend({
  status: OrderStatusSchema.optional(),
  completedSteps: z.array(DeliveryStepKeySchema).optional(),
});

export const ListOrdersQuerySchema = PaginationQuerySchema.extend({
  status: OrderStatusSchema.optional(),
  driverId: z.string().optional(),
  payment: PaymentStatusSchema.optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const DriverOrdersQuerySchema = PaginationQuerySchema.extend({
  scope: z.enum(["today", "active", "completed", "route"]).optional().default("active"),
});

export const AssignDriverSchema = z.object({
  driverId: z.string().min(1),
});

export const OrderStatusUpdateSchema = z.object({
  status: OrderStatusSchema,
  stepKey: DeliveryStepKeySchema.optional(),
  note: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderInput = z.infer<typeof UpdateOrderSchema>;
export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>;
export type DriverOrdersQuery = z.infer<typeof DriverOrdersQuerySchema>;
