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
        "The full legal description exactly as written on the page. Empty string if none is present.",
    },
    lot: { type: "string", description: "Lot, if stated separately." },
    block: { type: "string", description: "Block, if stated separately." },
    addition: {
      type: "string",
      description: "Subdivision / addition name, if stated separately.",
    },
    city: { type: "string", description: "City, if stated." },
    county: { type: "string", description: "County name." },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description:
        "high = legal description clearly labelled and unambiguous; medium = inferred from context; low = not found or very uncertain.",
    },
    notes: {
      type: "string",
      description:
        "Brief note on anything ambiguous, multiple matches, or why confidence is not high.",
    },
  },
  required: ["legalDescription", "county", "confidence"],
};

const SYSTEM = `You extract the legal description of a Texas real-estate parcel from the text of a county appraisal district (CAD) web page.

Rules:
- Extract only what is present in the text. Never infer or fabricate a lot, block, or subdivision.
- The legal description is the platted identifier (e.g. "LOT 7 BLK C/5821 WESTWOOD PARK ADDN"), not the street address.
- If the page shows multiple candidate properties or no clear match, set confidence "low", leave legalDescription "", and explain in notes.
- Always call the ${TOOL_NAME} tool. Do not reply with prose.`;

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
            text: `Property address: ${address}\nCounty: ${county}\n\nCAD page text:\n"""\n${pageText}\n"""`,
          },
        ],
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return a legal_description tool call");
  }

  return legalDescriptionSchema.parse(toolUse.input);
}
