import type {
  CountyId,
  LegalDescription,
} from "@/lib/validations/legal-lookup";

export type { CountyId };

export interface CadLookupResult {
  /** URL of the CAD page the data came from, for the user to verify. */
  sourceUrl: string | null;
  /** Trimmed page text that was handed to the extractor. */
  pageContext: string;
  extracted: LegalDescription | null;
  /** Set when the lookup ran but could not complete (never thrown). */
  error?: string;
}

export interface CadAdapter {
  id: CountyId;
  /**
   * Resolve `address` to a property on this county's appraisal district site
   * and extract its legal description. Must never throw — all failure paths
   * return a `CadLookupResult` with `error` set and `extracted: null`.
   */
  lookup(address: string): Promise<CadLookupResult>;
}
