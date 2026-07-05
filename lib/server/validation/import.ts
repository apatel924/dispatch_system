import { z } from "zod";
import { PaginationQuerySchema } from "@/lib/server/validation/common";

export const MOCK_IMPORT_SOURCES = ["mock-uber", "mock-doordash", "mock-amazon"] as const;

export const MockUberPayloadSchema = z.object({
  externalId: z.string().min(1),
  customer: z.string().min(1),
  phone: z.string().min(1),
  address: z.string().min(1),
  pickupName: z.string().min(1),
  pickupAddress: z.string().min(1),
  totalCents: z.number().int().nonnegative(),
  notes: z.string().optional(),
});

export const MockDoorDashPayloadSchema = MockUberPayloadSchema;
export const MockAmazonPayloadSchema = MockUberPayloadSchema;

export const OrderImportSchema = z.object({
  source: z.enum(MOCK_IMPORT_SOURCES),
  payload: z.unknown(),
});

export const ListImportLogsQuerySchema = PaginationQuerySchema.extend({
  source: z.string().optional(),
});

export type OrderImportInput = z.infer<typeof OrderImportSchema>;
export type MockProviderPayload = z.infer<typeof MockUberPayloadSchema>;
