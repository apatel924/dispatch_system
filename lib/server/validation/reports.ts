import { z } from "zod";
import { IsoDateQuerySchema, PaginationQuerySchema } from "@/lib/server/validation/common";
import { OrderStatusSchema } from "@/lib/server/validation/common";

export const ReportsOverviewQuerySchema = PaginationQuerySchema.extend({
  dateFrom: IsoDateQuerySchema,
  dateTo: IsoDateQuerySchema,
  compareFrom: IsoDateQuerySchema,
  compareTo: IsoDateQuerySchema,
  driverId: z.string().optional(),
  status: OrderStatusSchema.optional(),
});

export type ReportsOverviewQuery = z.infer<typeof ReportsOverviewQuerySchema>;
