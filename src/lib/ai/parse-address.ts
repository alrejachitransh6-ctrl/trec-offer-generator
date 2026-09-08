import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, MODELS } from "@/lib/ai/client";

/**
 * The parts of a free-form street address that appraisal-district searches
 * need. Users type addresses however they like — "9820 ash creek dr dallas
 * texas 75228", "9820 Ash Creek Drive", "9820 N Ash Creek Dr #4" — and CAD
 * search forms want the house number plus the *base* street name (no suffix,
 * no city/state/zip).
 */
export interface ParsedStreetAddress {
  /** House / building number, e.g. "9820", "9820A". */
  streetNumber: string;
  /** Street name only — uppercase, no number/directional/suffix ("ASH CREEK"). */
  streetName: string;
  /** Pre-directional if the street has one ("N", "SW"). "" otherwise. */
  direction: string;
  /** Unit / apt / suite, e.g. "4", "APT 2". "" otherwise. */
  unit: string;
}

const TOOL_NAME = "address";

const INPUT_SCHEMA: Anthropic.Messages.Tool.InputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    streetNumber: {
      type: "string",
      description: 'House/building number only, e.g. "9820".',
    },
    streetName: {
      type: "string",
      description:
        'Street name ONLY, uppercase — no house number, no directional, no street type. Examples: "9820 N Ash Creek Dr" -> "ASH CREEK"; "411 Elm St" -> "ELM".',
    },
    direction: {
      type: "string",
      description:
        "The pre-directional (N, S, E, W, NE, NW, SE, SW) only if the street name has one. Empty string if not.",
    },
    unit: {
      type: "string",
      description: "Unit / apartment / suite if present, else empty string.",
    },
  },
  // Only the two we actually use are required — leaving direction/unit optional
  // lets the model omit them cleanly instead of emitting filler.
  required: ["streetNumber", "streetName"],
};

const SYSTEM = `You extract the house number and street name from a free-form US street address. Fix obvious typos. Uppercase the street name and drop the street type (St, Dr, Ln, Ave, Blvd, ...). Ignore city, state, and ZIP. Do not invent anything not in the input. Always call the ${TOOL_NAME} tool and nothing else.`;

// Models sometimes leak fragments of internal tool-call markup into string
// fields. Strip anything that isn't plain address text.
const ARTIFACT = /<\/?\s*antml[^>]*>?|<\/?\s*parameter[^>]*>?|[<>]/gi;
const cleanField = (v: unknown): string =>
  typeof v === "string"
    ? v.replace(ARTIFACT, "").replace(/\s+/g, " ").trim()
    : "";

const STREET_SUFFIXES = new Set([
  "st",
  "street",
  "ave",
  "avenue",
  "rd",
  "road",
  "dr",
  "drive",
  "ln",
  "lane",
  "blvd",
  "boulevard",
  "ct",
  "court",
  "cir",
  "circle",
  "pl",
  "place",
  "way",
  "ter",
  "terrace",
  "pkwy",
  "parkway",
  "trl",
  "trail",
  "hwy",
  "highway",
  "loop",
  "pass",
  "path",
  "run",
  "cv",
  "cove",
  "xing",
  "crossing",
  "sq",
  "square",
  "expy",
  "expressway",
  "frwy",
  "fwy",
]);

/**
 * Drop a trailing street-type suffix from a street name. CAD search forms match
 * on the base name, and the address parser is not always consistent about
 * excluding it.
 */
function stripSuffix(name: string): string {
  const tokens = name.split(" ").filter(Boolean);
  while (
    tokens.length > 1 &&
    STREET_SUFFIXES.has(tokens[tokens.length - 1]!.toLowerCase())
  ) {
    tokens.pop();
  }
  return tokens.join(" ");
}

/** Deterministic fallback for when the model call fails. */
export function parseStreetAddressHeuristic(raw: string): ParsedStreetAddress {
  const result: ParsedStreetAddress = {
    streetNumber: "",
    streetName: "",
    direction: "",
    unit: "",
  };

  let s = raw.trim().replace(/\s+/g, " ");
  s = s.replace(/\b\d{5}(?:-\d{4})?\b/g, ""); // drop ZIP
  const streetLine = s.split(",")[0]!.trim();
  const tokens = streetLine.split(" ").filter(Boolean);

  if (tokens.length && /^\d+[A-Za-z]?$/.test(tokens[0]!)) {
    result.streetNumber = tokens.shift()!;
  }

  const DIRS = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);
  if (tokens.length > 1 && DIRS.has(tokens[0]!.toUpperCase())) {
    result.direction = tokens.shift()!.toUpperCase();
  }

  const unitIdx = tokens.findIndex((t) => /^(#|apt|unit|ste|suite)$/i.test(t));
  if (unitIdx >= 0) {
    result.unit = tokens.slice(unitIdx).join(" ").replace(/^#\s*/, "");
    tokens.length = unitIdx;
  } else if (tokens.length && /^#/.test(tokens[tokens.length - 1]!)) {
    result.unit = tokens.pop()!.replace(/^#/, "");
  }

  const SUFFIXES = new Set([
    "st",
    "street",
    "ave",
    "avenue",
    "rd",
    "road",
    "dr",
    "drive",
    "ln",
    "lane",
    "blvd",
    "boulevard",
    "ct",
    "court",
    "cir",
    "circle",
    "pl",
    "place",
    "way",
    "ter",
    "terrace",
    "pkwy",
    "parkway",
    "trl",
    "trail",
    "hwy",
    "highway",
    "loop",
    "pass",
    "path",
    "run",
    "cv",
    "cove",
    "xing",
    "crossing",
    "sq",
    "square",
  ]);
  // strip trailing suffix, and anything after it (likely city/state)
  for (let i = 0; i < tokens.length; i++) {
    if (SUFFIXES.has(tokens[i]!.toLowerCase())) {
      tokens.length = i;
      break;
    }
  }
  result.streetName = tokens.join(" ").toUpperCase();
  return result;
}

/** Parse via the model, falling back to the heuristic on any error. */
export async function parseStreetAddress(
  raw: string,
): Promise<ParsedStreetAddress> {
  try {
    const message = await anthropic().messages.create({
      model: MODELS.cheap,
      max_tokens: 300,
      system: SYSTEM,
      tools: [
        {
          name: TOOL_NAME,
          description: "Record the house number and street name.",
          input_schema: INPUT_SCHEMA,
          strict: true,
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: raw }],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use")
      throw new Error("no tool call");

    const p = toolUse.input as Record<string, unknown>;
    const result: ParsedStreetAddress = {
      streetNumber: cleanField(p.streetNumber),
      streetName: stripSuffix(cleanField(p.streetName).toUpperCase()),
      direction: cleanField(p.direction).toUpperCase(),
      unit: cleanField(p.unit),
    };
    if (!/^[NSEW]{1,2}$/.test(result.direction)) result.direction = "";
    // A leading directional the model left on the name.
    const lead = result.streetName.match(/^(N|S|E|W|NE|NW|SE|SW)\s+(.+)/);
    if (lead && !result.direction) {
      result.direction = lead[1]!;
      result.streetName = lead[2]!;
    }

    if (!result.streetNumber || !result.streetName) {
      return parseStreetAddressHeuristic(raw);
    }
    return result;
  } catch {
    return parseStreetAddressHeuristic(raw);
  }
}
