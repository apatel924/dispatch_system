import { z } from "zod";
import {
  DRIVER_SELF_SERVICE_STATUSES,
  DRIVER_STATUSES,
} from "@/lib/driver-status";
import { PaginationQuerySchema } from "@/lib/server/validation/common";
import { validateDriverPassword } from "@/lib/server/validation/driver-account";

export const DriverIdParamSchema = z
  .string()
  .regex(/^DRV-\d+$/, "Invalid driver ID");

export const DriverStatusSchema = z.enum(DRIVER_STATUSES);

/** Status values a driver may set for themselves via the availability toggle. */
export const DriverSelfStatusSchema = z.enum(DRIVER_SELF_SERVICE_STATUSES);

const PHONE_DIGITS_MIN = 10;
const PHONE_DIGITS_MAX = 15;

export const DriverPhoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .refine(
    (value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length >= PHONE_DIGITS_MIN && digits.length <= PHONE_DIGITS_MAX;
    },
    { message: "Enter a valid phone number" },
  );

const clearableTrimmedString = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

export const CreateDriverSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(1),
  phone: DriverPhoneSchema,
  email: z.string().email(),
  vehicle: clearableTrimmedString,
  avatarColor: z.string().optional(),
  status: DriverStatusSchema.optional().default("Inactive"),
});

/** Admin/dispatcher profile updates — rejects unknown fields. */
export const AdminUpdateDriverSchema = z
  .object({
    name: z.string().trim().min(1, "Display name is required").optional(),
    phone: DriverPhoneSchema.optional(),
    vehicle: clearableTrimmedString,
    status: DriverStatusSchema.optional(),
    adminNote: clearableTrimmedString,
    acknowledgeActiveAssignments: z.boolean().optional(),
  })
  .strict();

/** Driver self-service profile updates — rejects unknown fields. */
export const DriverSelfUpdateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    phone: DriverPhoneSchema.optional(),
    email: z.string().email().optional(),
    vehicle: clearableTrimmedString,
    avatarColor: z.string().optional(),
    status: DriverSelfStatusSchema.optional(),
  })
  .strict();

export const ListDriversQuerySchema = PaginationQuerySchema.extend({
  status: DriverStatusSchema.optional(),
  search: z.string().optional(),
});

export type CreateDriverInput = z.infer<typeof CreateDriverSchema>;
export type AdminUpdateDriverInput = z.infer<typeof AdminUpdateDriverSchema>;
export type DriverSelfUpdateInput = z.infer<typeof DriverSelfUpdateSchema>;
export type ListDriversQuery = z.infer<typeof ListDriversQuerySchema>;

export const UpdateDriverCredentialsSchema = z
  .object({
    loginEmail: z.string().trim().toLowerCase().email().optional(),
    password: z
      .string()
      .optional()
      .superRefine((value, ctx) => {
        if (value === undefined) return;
        const message = validateDriverPassword(value);
        if (message) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message });
        }
      }),
  })
  .refine((data) => data.loginEmail !== undefined || data.password !== undefined, {
    message: "Provide loginEmail and/or password",
  });

export type UpdateDriverCredentialsInput = z.infer<typeof UpdateDriverCredentialsSchema>;
