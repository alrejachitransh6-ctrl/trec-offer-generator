import { z } from "zod";

import {
  countyIdSchema,
  legalDescriptionSchema,
} from "@/lib/validations/legal-lookup";

const money = z.number().nonnegative().finite();

/**
 * The ask-every-time fields (spec §6 / §7). Every leaf has a default and every
 * object uses `.prefault({})` so a half-filled wizard (or a partial PATCH) still
 * coerces to a complete object for a draft save.
 */
export const dealTermsSchema = z
  .object({
    seller: z
      .object({
        // TREC §1 — Seller name / info
        nameInfo: z.string().default(""),
      })
      .prefault({}),
    salesPrice: z
      .object({
        // TREC §3A — cash portion. §3C (total) is computed = this. §3B blank.
        cashPortionUsd: money.default(0),
      })
      .prefault({}),
    earnestMoney: z
      .object({
        escrowAgentName: z.string().default(""), // §5
        escrowAgentAddress: z.string().default(""),
        earnestMoneyUsd: money.default(0),
        optionFeeUsd: money.default(0),
        optionPeriodDays: z.number().int().nonnegative().default(0), // §5B
      })
      .prefault({}),
    title: z
      .object({
        titleCompanyName: z.string().default(""), // §6
      })
      .prefault({}),
    closingDate: z
      .object({
        // §9A — an incomplete date defaults the year to the current year.
        day: z.number().int().min(0).max(31).default(0),
        month: z.number().int().min(0).max(12).default(0),
        year: z.number().int().min(0).max(9999).default(0),
      })
      .prefault({}),
    hoa: z
      .object({
        // §7 title notices item (2)
        mandatoryMembership: z
          .enum(["is", "is_not", "unknown"])
          .default("unknown"),
      })
      .prefault({}),
    // §11 — defaults to "n/a" when the user has nothing to add.
    specialProvisions: z.string().default("n/a"),
    signatories: z
      .object({
        // Actual signatory names, not the entity name.
        buyerNames: z.string().default(""),
        sellerNames: z.string().default(""),
      })
      .prefault({}),
  })
  .prefault({});

export type DealTerms = z.infer<typeof dealTermsSchema>;

/** One interpreted change to a standing default for this deal. */
export const overrideChangeSchema = z.object({
  targetId: z.string(),
  label: z.string(),
  newValue: z.string(),
  /** The phrase from the note this came from. */
  quote: z.string(),
  /** One-sentence plain-English reading of the change. */
  interpretation: z.string(),
});
export type OverrideChange = z.infer<typeof overrideChangeSchema>;

export const overrideInterpretationSchema = z.object({
  changes: z.array(overrideChangeSchema),
  /** Phrases the model could not map to an overridable point. */
  unmapped: z.array(z.string()),
});
export type OverrideInterpretation = z.infer<
  typeof overrideInterpretationSchema
>;

// ---- API payloads --------------------------------------------------------

export const dealCreateSchema = z.object({
  propertyAddress: z.string().trim().min(1).max(200),
  countyId: countyIdSchema,
  legalDescription: legalDescriptionSchema,
  /** Pre-fills §1 Seller + the signature line; from the CAD owner or manual. */
  sellerNameInfo: z.string().max(500).optional(),
});
export type DealCreate = z.infer<typeof dealCreateSchema>;

export const dealUpdateSchema = z.object({
  terms: dealTermsSchema.optional(),
  status: z.enum(["draft", "ready"]).optional(),
  overrideNote: z.string().max(4000).optional(),
  overrides: z.array(overrideChangeSchema).optional(),
  /** Buyer standing default (§1), snapshotted onto this deal's `defaults`. */
  buyerNameInfo: z.string().max(500).optional(),
});
export type DealUpdate = z.infer<typeof dealUpdateSchema>;

export const buyerDefaultSchema = z.object({
  buyerNameInfo: z.string().max(500),
});

export const interpretOverridesSchema = z.object({
  note: z.string().trim().min(1).max(4000),
});
