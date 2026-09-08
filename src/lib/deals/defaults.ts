/**
 * Standing defaults (spec §7 "DEFAULT" category).
 *
 * For this slice these live in code and are **snapshotted onto each deal** at
 * creation (`deals.defaults`), so a deal stays self-contained even after the
 * defaults change. Slice 4 replaces this constant with an editable
 * `user_preferences` table + Settings UI; the deal snapshot mechanism stays.
 */
export interface StandingDefaults {
  /** TREC §1 — the buyer (the wholesaler's entity), name + info block. */
  buyerNameInfo: string;
}

export const DEFAULT_PREFERENCES: StandingDefaults = {
  buyerNameInfo: "",
};
