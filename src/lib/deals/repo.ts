import { getUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PREFERENCES,
  type StandingDefaults,
} from "@/lib/deals/defaults";
import {
  dealTermsSchema,
  overrideChangeSchema,
  type DealCreate,
  type DealTerms,
  type DealUpdate,
  type OverrideChange,
} from "@/lib/validations/deal";
import {
  legalDescriptionSchema,
  type CountyId,
  type LegalDescription,
} from "@/lib/validations/legal-lookup";
import { z } from "zod";

import type { Database, Json } from "@/lib/supabase/database.types";

type DealInsert = Database["public"]["Tables"]["deals"]["Insert"];
type DealUpdateRow = Database["public"]["Tables"]["deals"]["Update"];

export interface Deal {
  id: string;
  status: string;
  propertyAddress: string;
  countyId: CountyId;
  legalDescription: LegalDescription;
  defaults: StandingDefaults;
  terms: DealTerms;
  overrideNote: string;
  overrides: OverrideChange[];
  createdAt: string;
  updatedAt: string;
}

const defaultsSchema = z
  .object({ buyerNameInfo: z.string().default("") })
  .transform((d) => ({ ...DEFAULT_PREFERENCES, ...d }));

type DealRow = {
  id: string;
  status: string;
  property_address: string;
  county_id: string;
  legal_description: unknown;
  defaults: unknown;
  terms: unknown;
  override_note: string;
  overrides: unknown;
  created_at: string;
  updated_at: string;
};

function rowToDeal(row: DealRow): Deal {
  return {
    id: row.id,
    status: row.status,
    propertyAddress: row.property_address,
    countyId: row.county_id as CountyId,
    legalDescription: legalDescriptionSchema.parse(row.legal_description),
    defaults: defaultsSchema.parse(row.defaults ?? {}),
    terms: dealTermsSchema.parse(row.terms ?? {}),
    overrideNote: row.override_note ?? "",
    overrides: z
      .array(overrideChangeSchema)
      .catch([])
      .parse(row.overrides ?? []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT =
  "id,status,property_address,county_id,legal_description,defaults,terms,override_note,overrides,created_at,updated_at";

export async function listDeals(): Promise<Deal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .select(SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => rowToDeal(r as DealRow));
}

export async function getDeal(id: string): Promise<Deal | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToDeal(data as DealRow) : null;
}

export async function createDeal(input: DealCreate): Promise<string> {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");

  const supabase = await createClient();
  const insert: DealInsert = {
    user_id: user.id,
    property_address: input.propertyAddress,
    county_id: input.countyId,
    legal_description: input.legalDescription as unknown as Json,
    defaults: { ...DEFAULT_PREFERENCES } as unknown as Json,
    terms: dealTermsSchema.parse({}) as unknown as Json,
  };
  const { data, error } = await supabase
    .from("deals")
    .insert(insert)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateDeal(
  id: string,
  patch: DealUpdate,
): Promise<Deal | null> {
  const supabase = await createClient();

  const row: DealUpdateRow = {};
  if (patch.terms !== undefined) {
    row.terms = dealTermsSchema.parse(patch.terms) as unknown as Json;
  }
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.overrideNote !== undefined) row.override_note = patch.overrideNote;
  if (patch.overrides !== undefined) {
    row.overrides = patch.overrides as unknown as Json;
  }

  if (Object.keys(row).length === 0) return getDeal(id);

  const { data, error } = await supabase
    .from("deals")
    .update(row)
    .eq("id", id)
    .select(SELECT)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToDeal(data as DealRow) : null;
}
