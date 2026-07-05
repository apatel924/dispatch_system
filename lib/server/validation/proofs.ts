import { z } from "zod";
import { DeliveryStepKeySchema } from "@/lib/server/validation/common";

export const ProofTypeSchema = z.enum(["signature", "exteriorPhoto", "idVerification"]);

export const UploadProofSchema = z.object({
  type: ProofTypeSchema,
  storagePath: z.string().min(1),
  mimeType: z.string().min(1),
  stepKey: DeliveryStepKeySchema,
  fileSizeBytes: z.number().int().positive().optional(),
});

export const ReviewProofSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewNote: z.string().optional(),
});

export const ReviewProofQuerySchema = z.object({
  orderId: z.string().min(1),
});

export type UploadProofInput = z.infer<typeof UploadProofSchema>;
export type ReviewProofInput = z.infer<typeof ReviewProofSchema>;
