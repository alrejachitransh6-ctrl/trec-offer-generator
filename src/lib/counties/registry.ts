import { dallasAdapter } from "@/lib/counties/adapters/dallas";
import { countyMeta, type CountyMeta } from "@/lib/counties/list";
import type { CadAdapter, CountyId } from "@/lib/counties/types";

export interface CountyEntry extends CountyMeta {
  /** Automatic lookup adapter, or `null` when only manual entry is supported. */
  adapter: CadAdapter | null;
}

const ADAPTERS: Partial<Record<CountyId, CadAdapter>> = {
  dallas: dallasAdapter,
};

export function getCounty(id: CountyId): CountyEntry {
  return { ...countyMeta(id), adapter: ADAPTERS[id] ?? null };
}
