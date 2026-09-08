import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, MODELS } from "@/lib/ai/client";
import {
  legalDescriptionSchema,
  type LegalDescription,
} from "@/lib/validations/legal-lookup";

const TOOL_NAME = "legal_description";

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
    "confidence",
    "notes",
  ],
};

const SYSTEM = `You extract the legal description of a Texas real-estate parcel from the text of a county appraisal district (CAD) web page.

Rules:
- Extract only what is present in the text. Never infer or fabricate a lot, block, or subdivision.
- The legal description is the platted identifier, not the street address. CAD pages often print it across several numbered lines — combine them in order into one line.
- Break out the parts. Example: page text "WESTMORELAND HEIGHTS PH 1 / BLK B LT 22" →
  legalDescription "WESTMORELAND HEIGHTS PH 1, BLK B, LT 22", addition "WESTMORELAND HEIGHTS PH 1", block "B", lot "22".
  Leave a part as "" if it is not clearly present.
- If the page shows multiple candidate properties or no clear legal description, set confidence "low", leave legalDescription "", and say why in notes.
- Every field is required; use "" for anything you cannot fill.
- Always call the ${TOOL_NAME} tool. Reply with the tool call only — no other text.`;

export interface ExtractInput {
  address: string;
  county: string;
  /** Visible text of the CAD property page (already trimmed). */
  pageText: string;
}

/**
 * Ask Claude to pull the legal description out of a CAD page.
 * Throws on API/transport errors — callers (adapters) catch and convert.
 */
export async function extractLegalDescription({
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
        description: "Record the extracted legal description.",
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
    throw new Error("Model did not return a legal_description tool call");
  }

  const parsed = legalDescriptionSchema.parse(toolUse.input);

  // On confusing/empty pages the model can leak fragments of internal tool-call
  // markup into string fields. Strip it; if the core field is left junk, treat
  // the extraction as failed rather than surface garbage.
  const ARTIFACT = /<\/?\s*antml|<\/?\s*parameter|\bReport>\s*$|[<>]/gi;
  const clean = (v: string | undefined) =>
    v?.replace(ARTIFACT, "").replace(/\s+/g, " ").trim() || undefined;

  parsed.legalDescription = clean(parsed.legalDescription) ?? "";
  parsed.county = clean(parsed.county) ?? county;
  for (const key of ["lot", "block", "addition", "city", "notes"] as const) {
    parsed[key] = clean(parsed[key]);
  }

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
