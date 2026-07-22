import { z } from "zod";

const optionalTrimmed = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .nullable()
  .optional();

export const addressInput = z.object({
  line1: z.string().trim().min(1, "Street address is required"),
  line2: optionalTrimmed,
  city: z.string().trim().min(1, "City is required"),
  state: optionalTrimmed,
  postalCode: optionalTrimmed,
  country: z.string().trim().min(1).default("US"),
});

export const customerInput = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: optionalTrimmed,
  phone: optionalTrimmed,
  website: optionalTrimmed,
  taxExempt: z.boolean().default(false),
  notes: optionalTrimmed,
  billingAddress: addressInput.nullable().optional(),
  shippingAddress: addressInput.nullable().optional(),
});

export type CustomerInput = z.infer<typeof customerInput>;

export const lineItemInput = z.object({
  description: z.string().trim().min(1, "Description is required"),
  quantity: z.number().int().min(0),
  // Kept as a string end-to-end so we never pass money through a float.
  unitPrice: z
    .string()
    .trim()
    .regex(/^\d{1,8}(\.\d{1,4})?$/, "Enter a price like 12.50"),
  taxable: z.boolean().default(true),
});

export const documentInput = z.object({
  customerId: z.string().min(1, "Pick a customer"),
  title: optionalTrimmed,
  issueDate: z.string().trim().min(1, "Issue date is required"), // yyyy-mm-dd
  // validUntil for quotes, dueDate for invoices
  secondaryDate: optionalTrimmed,
  taxPercent: z
    .string()
    .trim()
    .regex(/^\d{0,3}(\.\d{1,3})?$/, "Enter a percent like 8.25")
    .default(""),
  terms: optionalTrimmed,
  notes: optionalTrimmed,
  lineItems: z.array(lineItemInput).min(1, "Add at least one line item"),
});

export type DocumentInput = z.infer<typeof documentInput>;
export type LineItemInput = z.infer<typeof lineItemInput>;

export const paymentInput = z.object({
  // String end-to-end; whole cents only.
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter an amount like 100.00"),
  method: z.enum(["CASH", "CHECK", "CARD", "ACH", "OTHER"]),
  reference: optionalTrimmed,
  receivedAt: z.string().trim().min(1, "Date received is required"), // yyyy-mm-dd
  notes: optionalTrimmed,
});

export type PaymentInput = z.infer<typeof paymentInput>;
