import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, MODELS } from "@/lib/ai/client";
import {
  OVERRIDE_TARGETS,
  OVERRIDE_TARGET_IDS,
} from "@/lib/deals/override-catalog";
import {
  overrideInterpretationSchema,
  type OverrideInterpretation,
} from "@/lib/validations/deal";

const TOOL_NAME = "interpret";

const INPUT_SCHEMA: Anthropic.Messages.Tool.InputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    changes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          targetId: {
            type: "string",
            enum: OVERRIDE_TARGET_IDS,
            description: "The overridable point this change applies to.",
          },
          label: { type: "string", description: "The point's label." },
          newValue: {
            type: "string",
            description:
              'The new value, concise and specific (e.g. "seller", "$5,000", "seller furnishes new survey").',
          },
          quote: {
            type: "string",
            description: "The exact phrase from the note this came from.",
          },
          interpretation: {
            type: "string",
            description: "One plain-English sentence describing the change.",
          },
        },
        required: ["targetId", "label", "newValue", "quote", "interpretation"],
      },
    },
    unmapped: {
      type: "array",
      items: { type: "string" },
      description:
        "Phrases from the note that do not correspond to any overridable point (e.g. they belong in an ask-every-time field, or aren't a contract change).",
    },
  },
  required: ["changes", "unmapped"],
};

function catalogText(): string {
  return OVERRIDE_TARGETS.map(
    (t) =>
      `- ${t.id} — ${t.label} (TREC ${t.ref}). Default: ${t.specDefault}. Value: ${t.valueHint}. e.g. ${t.examples
        .map((e) => `"${e}"`)
        .join(", ")}`,
  ).join("\n");
}

const SYSTEM = `You translate a real-estate wholesaler's free-form notes about "what's different on this deal" into structured changes to a TREC 1-4 contract.

You may ONLY map to these overridable points:
${catalogText()}

Rules:
- Map a phrase to a point only when it clearly corresponds. When unsure, put the phrase in "unmapped" rather than guessing.
- Ask-every-time fields — sales price, earnest money amount, option fee, option period days, closing date, escrow agent, title company, seller name, HOA status, special provisions, signatory names — are entered elsewhere. If the note mentions one of those, add it to "unmapped" with a short note like "set this in the Option Period section".
- "newValue" must be concrete and short. Preserve dollar amounts and day counts exactly as written.
- Do not invent changes the note doesn't state.
- Always call the ${TOOL_NAME} tool and nothing else.`;

/**
 * Interpret the "anything different about this deal" note.
 * Throws on API errors; the route converts to a 502.
 */
export async function interpretOverrides(
  note: string,
): Promise<OverrideInterpretation> {
  const message = await anthropic().messages.create({
    model: MODELS.extraction,
    max_tokens: 2000,
    output_config: { effort: "medium" },
    system: SYSTEM,
    tools: [
      {
        name: TOOL_NAME,
        description: "Record the interpreted changes.",
        input_schema: INPUT_SCHEMA,
        strict: true,
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: `Deal note:\n--- BEGIN ---\n${note}\n--- END ---`,
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return an interpretation");
  }

  const parsed = overrideInterpretationSchema.parse(toolUse.input);

  // Strip any leaked markup, and drop changes with an unknown target.
  const artifact = /<\/?\s*antml[^>]*>?|<\/?\s*parameter[^>]*>?|[<>]/gi;
  const clean = (s: string) =>
    s.replace(artifact, "").replace(/\s+/g, " ").trim();
  return {
    changes: parsed.changes
      .filter((c) => OVERRIDE_TARGET_IDS.includes(c.targetId))
      .map((c) => ({
        targetId: c.targetId,
        label: clean(c.label),
        newValue: clean(c.newValue),
        quote: clean(c.quote),
        interpretation: clean(c.interpretation),
      })),
    unmapped: parsed.unmapped.map(clean).filter(Boolean),
  };
}
