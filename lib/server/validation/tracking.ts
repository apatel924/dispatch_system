import { z } from "zod";
import { CONSUMER_NOTE_MAX_LENGTH } from "@/lib/consumer-text";

export const ConsumerNoteBodySchema = z.object({
  text: z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(1, "Delivery instructions cannot be empty")
        .max(
          CONSUMER_NOTE_MAX_LENGTH,
          `Delivery instructions must be ${CONSUMER_NOTE_MAX_LENGTH} characters or fewer`,
        ),
    ),
});

export type ConsumerNoteBody = z.infer<typeof ConsumerNoteBodySchema>;
