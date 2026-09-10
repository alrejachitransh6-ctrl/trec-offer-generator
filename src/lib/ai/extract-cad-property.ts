import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, MODELS } from "@/lib/ai/client";
import {
  legalDescriptionSchema,
  type LegalDescription,
} from "@/lib/validations/legal-lookup";

const TOOL_NAME = "cad_property";

const INPUT_SCHEMA: Anthropic.Messages.Tool.InputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    legalDescription: {
      type: "string",
      description:
        'The complete legal description, normalised to one line (e.g. "WESTMORELAND HEIGHTS PH 1, BLK B, LT 22"). Empty string if none is present.',
    },
    lot: {
      type: "string",
      description:
        'Just the lot identifier if the description names one (e.g. "22", "1A"), else empty.',
    },
    block: {
      type: "string",
      description:
        'Just the block identifier if the description names one (e.g. "B", "13/10"), else empty.',
    },
    addition: {
      type: "string",
      description:
        'The subdivision / addition name only (e.g. "WESTMORELAND HEIGHTS PH 1"), else empty.',
    },
    city: {
      type: "string",
      description: "City from the property address on the page, else empty.",
    },
    county: { type: "string", description: "County name." },
    ownerName: {
      type: "string",
      description:
        'The current owner of record, in natural name order. Individuals: "First [Middle] Last" (CAD pages list them last-name-first, e.g. "SMITH JOHN Q" → "John Q Smith"). Two owners: join with " and " (e.g. "John Smith and Jane Smith"). Entities / trusts / estates: keep the name as written but Title Case it (e.g. "ABC PROPERTIES LLC" → "ABC Properties LLC", "SMITH FAMILY TRUST" → "Smith Family Trust"). Empty string if no owner is shown.',
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description:
        "high = legal description clearly labelled and unambiguous; medium = present but needs interpretation; low = not found or multiple unresolved matches.",
    },
    notes: {
      type: "string",
      description:
        "At most one plain-English sentence about anything ambiguous, or why confidence is not high. Use an empty string when there is nothing to say. Plain prose only.",
    },
  },
  required: [
    "legalDescription",
    "lot",
    "block",
    "addition",
    "city",
    "county",
    "ownerName",
    "confidence",
    "notes",
  ],
};

const SYSTEM = `You extract the legal description and current owner of a Texas real-estate parcel from the text of a county appraisal district (CAD) web page.

Rules:
- Extract only what is present in the text. Never infer or fabricate a lot, block, subdivision, or owner.
- The legal description is the platted identifier, not the street address. CAD pages often print it across several numbered lines — combine them in order into one line.
- Break out the parts. Example: page text "WESTMORELAND HEIGHTS PH 1 / BLK B LT 22" →
  legalDescription "WESTMORELAND HEIGHTS PH 1, BLK B, LT 22", addition "WESTMORELAND HEIGHTS PH 1", block "B", lot "22".
  Leave a part as "" if it is not clearly present.
- ownerName: normalise per the field description — natural order for people, Title Case for entities. Use "" if the page does not show an owner (some Texas owners have their name withheld from public records).
- If the page shows multiple candidate properties or no clear legal description, set confidence "low", leave legalDescription "", and say why in notes.
- Every field is required; use "" for anything you cannot fill — never a placeholder.
- Always call the ${TOOL_NAME} tool. Reply with the tool call only — no other text.`;

export interface ExtractInput {
  address: string;
  county: string;
  /** Visible text of the CAD property page (already trimmed). */
  pageText: string;
}

/**
 * Ask Claude to pull the legal description + owner out of a CAD page.
 * Throws on API/transport errors — callers (adapters) catch and convert.
 */
export async function extractCadProperty({
  address,
  county,
  pageText,
}: ExtractInput): Promise<LegalDescription> {
  const message = await anthropic().messages.create({
    model: MODELS.extraction,
    max_tokens: 2000,
    output_config: { effort: "low" },
    system: SYSTEM,
    tools: [
      {
        name: TOOL_NAME,
        description: "Record the extracted property data.",
        input_schema: INPUT_SCHEMA,
        strict: true,
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Property address: ${address}\nCounty: ${county}\n\n--- BEGIN CAD PAGE TEXT ---\n${pageText}\n--- END CAD PAGE TEXT ---`,
          },
        ],
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return a cad_property tool call");
  }

  const parsed = legalDescriptionSchema.parse(toolUse.input);

  // On confusing/empty pages the model can leak fragments of internal tool-call
  // markup into "should be empty" string fields. Strip it; drop what's left junk.
  const ARTIFACT =
    /<\/?\s*antml[^>]*>?|<\/?\s*parameter[^>]*>?|\bparameter\s+name\b|\bantml\b|\bReport>|[<>]/gi;
  const clean = (v: string | undefined) => {
    const s = v?.replace(ARTIFACT, "").replace(/\s+/g, " ").trim();
    return s && /[A-Za-z0-9]/.test(s) ? s : undefined;
  };

  parsed.legalDescription = clean(parsed.legalDescription) ?? "";
  parsed.county = clean(parsed.county) ?? county;
  for (const key of ["lot", "block", "addition", "city", "notes"] as const) {
    parsed[key] = clean(parsed[key]);
  }
  if (parsed.notes && !/[A-Za-z]{3,}/.test(parsed.notes))
    parsed.notes = undefined;

  // Owner name must look like a name — a leaked token here is worse than blank.
  const owner = clean(parsed.ownerName);
  const looksLikeName =
    !!owner &&
    /^[A-Za-z][A-Za-z0-9 .,'&\/-]{1,60}$/.test(owner) &&
    // reject a single all-lowercase word (schema-token leaks: "medium", "confidence")
    !/^[a-z]+$/.test(owner) &&
    !/^(high|medium|low|confidence|notes|ownername|legaldescription)$/i.test(
      owner,
    );
  parsed.ownerName = looksLikeName ? owner : undefined;

  const looksJunk =
    parsed.legalDescription.length > 0 &&
    !/[A-Za-z]{3,}/.test(parsed.legalDescription);
  if (looksJunk || parsed.legalDescription.length === 0) {
    return {
      ...parsed,
      legalDescription: "",
      lot: undefined,
      block: undefined,
      addition: undefined,
      confidence: "low",
      notes:
        parsed.notes ??
        "Could not read a legal description from the page — please check the source and enter it manually.",
    };
  }

  return parsed;
}
