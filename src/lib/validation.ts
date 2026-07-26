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

const price4dp = z
  .string()
  .trim()
  .regex(/^\d{1,8}(\.\d{1,4})?$/, "Enter a price like 2.75");

export const gridInput = z.object({
  name: z.string().trim().min(1, "Grid name is required"),
  tierLabel: z.string().trim().min(1).default("Colors"),
  notes: optionalTrimmed,
  cells: z
    .array(
      z.object({
        minQuantity: z.number().int().min(1),
        tier: z.number().int().min(1),
        unitPrice: price4dp,
      }),
    )
    .min(1, "Add at least one price cell"),
});

export type GridInput = z.infer<typeof gridInput>;

export const markupRulesInput = z.object({
  rules: z.array(
    z.object({
      minCost: z
        .string()
        .trim()
        .regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter a cost like 5.00"),
      multiplier: z
        .string()
        .trim()
        .regex(/^\d{1,3}(\.\d{1,3})?$/, "Enter a multiplier like 2.5"),
    }),
  ),
});

export type MarkupRulesInput = z.infer<typeof markupRulesInput>;

export const calcInput = z.object({
  gridId: z.string().min(1, "Pick a price grid"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  tier: z.number().int().min(1),
  garmentCost: z
    .string()
    .trim()
    .regex(/^$|^\d{1,8}(\.\d{1,2})?$/, "Enter a cost like 3.20")
    .default(""),
});

export type CalcInput = z.infer<typeof calcInput>;

export const jobScheduleInput = z.object({
  priority: z.enum(["LOW", "NORMAL", "HIGH", "RUSH"]),
  assignee: optionalTrimmed,
  dueDate: optionalTrimmed, // yyyy-mm-dd or empty
  notes: optionalTrimmed,
});

export type JobScheduleInput = z.infer<typeof jobScheduleInput>;

const cost4dp = z
  .string()
  .trim()
  .regex(/^\d{1,8}(\.\d{1,4})?$/, "Enter a cost like 3.50");

export const supplierInput = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: optionalTrimmed,
  phone: optionalTrimmed,
  website: optionalTrimmed,
  account: optionalTrimmed,
  notes: optionalTrimmed,
});

export type SupplierInput = z.infer<typeof supplierInput>;

export const inventoryItemInput = z.object({
  sku: z.string().trim().min(1, "SKU is required"),
  name: z.string().trim().min(1, "Name is required"),
  unit: z.string().trim().min(1).default("each"),
  reorderPoint: z.number().int().min(0),
  unitCost: cost4dp,
  supplierId: optionalTrimmed,
});

export type InventoryItemInput = z.infer<typeof inventoryItemInput>;

export const stockAdjustInput = z.object({
  // Signed whole number: positive adds, negative removes.
  delta: z
    .string()
    .trim()
    .regex(/^-?\d{1,9}$/, "Enter a whole number, e.g. 12 or -3"),
  reason: z.enum(["RECEIVED", "CONSUMED", "ADJUSTMENT"]),
  note: optionalTrimmed,
  jobId: optionalTrimmed,
});

export type StockAdjustInput = z.infer<typeof stockAdjustInput>;

export const poLineInput = z.object({
  itemId: optionalTrimmed,
  description: z.string().trim().min(1, "Description is required"),
  quantity: z.number().int().min(1),
  unitCost: cost4dp,
});

export const purchaseOrderInput = z.object({
  supplierId: z.string().min(1, "Pick a supplier"),
  expectedAt: optionalTrimmed,
  notes: optionalTrimmed,
  lines: z.array(poLineInput).min(1, "Add at least one line"),
});

export type PurchaseOrderInput = z.infer<typeof purchaseOrderInput>;

export const receiveInput = z.object({
  // How many of each line are being received now, keyed by line id.
  receipts: z.array(
    z.object({
      lineId: z.string().min(1),
      quantity: z.number().int().min(0),
    }),
  ),
});

export type ReceiveInput = z.infer<typeof receiveInput>;
