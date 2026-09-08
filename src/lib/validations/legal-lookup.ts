import { z } from "zod";

/** The four DFW counties supported in v1 (spec §8). */
export const COUNTY_IDS = ["dallas", "tarrant", "denton", "collin"] as const;
export const countyIdSchema = z.enum(COUNTY_IDS);
export type CountyId = z.infer<typeof countyIdSchema>;

/**
 * A property's legal description as extracted from a county appraisal district
 * page. Mirrors TREC 1-4 §2A (Land): Lot / Block / Addition / City / County.
 * `legalDescription` is the full verbatim string; the parts are best-effort.
 */
export const legalDescriptionSchema = z.object({
  legalDescription: z.string(),
  lot: z.string().optional(),
  block: z.string().optional(),
  addition: z.string().optional(),
  city: z.string().optional(),
  county: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  notes: z.string().optional(),
});
export type LegalDescription = z.infer<typeof legalDescriptionSchema>;

/** Request body for `POST /api/legal-lookup`. */
export const legalLookupRequestSchema = z.object({
  address: z.string().trim().min(3).max(200),
  countyId: countyIdSchema,
});
export type LegalLookupRequest = z.infer<typeof legalLookupRequestSchema>;

/** Response shape from `POST /api/legal-lookup`. */
export interface LegalLookupResponse {
  /** false = no automatic adapter for this county yet; user enters manually. */
  supported: boolean;
  sourceUrl: string | null;
  /** The page text handed to the model — shown to the user for transparency. */
  pageContext: string;
  extracted: LegalDescription | null;
  /** Present when the lookup ran but could not complete. */
  error?: string;
}
