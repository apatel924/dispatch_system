import { z } from "zod";
import { DeliveryStepKeySchema } from "@/lib/server/validation/common";
import { proofMaxDataUrlChars } from "@/lib/server/proof-limits";

export const ProofTypeSchema = z.enum(["signature", "exteriorPhoto", "idVerification"]);

const maxDataUrlChars = proofMaxDataUrlChars();

/** Base64 data URL uploaded through a protected API route (never client Storage SDK). */
export const UploadProofSchema = z.object({
  type: ProofTypeSchema,
  stepKey: DeliveryStepKeySchema,
  dataUrl: z
    .string()
    .min(22)
    .max(maxDataUrlChars, {
      message: `dataUrl exceeds maximum encoded length of ${maxDataUrlChars} characters`,
    })
    .refine((value) => value.startsWith("data:") && value.includes(";base64,"), {
      message: "dataUrl must be a base64 data URL",
    }),
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
