import { z } from "zod";

const normalizedEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email address");

/** Server-side password policy for administrator-set driver passwords. */
export function validateDriverPassword(password: string): string | null {
  if (password !== password.trim()) {
    return "Password must not have leading or trailing spaces";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }
  if (password.length > 128) {
    return "Password must be at most 128 characters";
  }
  if (!/[a-zA-Z]/.test(password)) {
    return "Password must include at least one letter";
  }
  if (!/\d/.test(password)) {
    return "Password must include at least one number";
  }
  return null;
}

const passwordField = z
  .string()
  .min(1, "Password is required")
  .superRefine((value, ctx) => {
    const message = validateDriverPassword(value);
    if (message) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    }
  });

export const UpdateDriverAccountSchema = z
  .object({
    loginEmail: normalizedEmail.optional(),
    password: passwordField.optional(),
    confirmPassword: z.string().optional(),
    displayName: z.string().trim().min(1).max(128).optional(),
    disabled: z.boolean().optional(),
    /** Explicit one-time link when the driver document has no authUid yet. */
    linkAuthUid: z.string().trim().min(1).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.password !== undefined && data.confirmPassword !== data.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Password confirmation does not match",
        path: ["confirmPassword"],
      });
    }
    const hasCredentialChange =
      data.loginEmail !== undefined ||
      data.password !== undefined ||
      data.displayName !== undefined ||
      data.disabled !== undefined;
    if (!hasCredentialChange && data.linkAuthUid === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one account field to update",
      });
    }
    if (data.linkAuthUid !== undefined && hasCredentialChange) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "linkAuthUid cannot be combined with other account updates",
        path: ["linkAuthUid"],
      });
    }
  });

export type UpdateDriverAccountInput = z.infer<typeof UpdateDriverAccountSchema>;
