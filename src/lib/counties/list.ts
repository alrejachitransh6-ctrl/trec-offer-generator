import type { CountyId } from "@/lib/validations/legal-lookup";

/**
 * Plain, client-safe county metadata (no adapter code). Import this in UI;
 * import `registry.ts` only on the server.
 */
export interface CountyMeta {
  id: CountyId;
  label: string;
  cadName: string;
  cadUrl: string;
  /** Whether an automatic lookup adapter exists yet (spec §10 — Dallas first). */
  autoLookup: boolean;
}

export const COUNTY_META: CountyMeta[] = [
  {
    id: "dallas",
    label: "Dallas",
    cadName: "Dallas Central Appraisal District (DCAD)",
    cadUrl: "https://www.dallascad.org/SearchAddr.aspx",
    autoLookup: true,
  },
  {
    id: "tarrant",
    label: "Tarrant",
    cadName: "Tarrant Appraisal District (TAD)",
    cadUrl: "https://www.tad.org/property-search/",
    autoLookup: false,
  },
  {
    id: "denton",
    label: "Denton",
    cadName: "Denton Central Appraisal District",
    cadUrl: "https://www.dentoncad.com/property-search",
    autoLookup: false,
  },
  {
    id: "collin",
    label: "Collin",
    cadName: "Collin Central Appraisal District (CCAD)",
    cadUrl: "https://www.collincad.org/property-search",
    autoLookup: false,
  },
];

export function countyMeta(id: CountyId): CountyMeta {
  const found = COUNTY_META.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown county: ${id}`);
  return found;
}
