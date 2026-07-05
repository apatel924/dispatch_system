import { z } from "zod";
import { PaginationQuerySchema } from "@/lib/server/validation/common";

export const DriverStatusSchema = z.enum([
  "Available",
  "Busy",
  "Inactive",
  "Suspended",
]);

export const CreateDriverSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  vehicle: z.string().optional(),
  avatarColor: z.string().optional(),
  status: DriverStatusSchema.optional().default("Inactive"),
});

export const UpdateDriverSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional(),
  vehicle: z.string().optional(),
  avatarColor: z.string().optional(),
  status: DriverStatusSchema.optional(),
  activeDeliveries: z.number().int().nonnegative().optional(),
  completedToday: z.number().int().nonnegative().optional(),
  failedToday: z.number().int().nonnegative().optional(),
});

export const ListDriversQuerySchema = PaginationQuerySchema.extend({
  status: DriverStatusSchema.optional(),
  search: z.string().optional(),
});

export type CreateDriverInput = z.infer<typeof CreateDriverSchema>;
export type UpdateDriverInput = z.infer<typeof UpdateDriverSchema>;
export type ListDriversQuery = z.infer<typeof ListDriversQuerySchema>;
