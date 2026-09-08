import Anthropic from "@anthropic-ai/sdk";

import { serverEnv } from "@/lib/env";

let client: Anthropic | null = null;

/** Lazily-constructed Anthropic client. Server-only. */
export function anthropic(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: serverEnv.ANTHROPIC_API_KEY });
  }
  return client;
}

/**
 * Model IDs used at runtime. Kept here so swapping a model is a one-line change.
 * - `extraction`: reading messy CAD HTML and pulling out the legal description.
 * - `cheap`: bounded, low-stakes mapping (e.g. NL override → field, later slice).
 */
export const MODELS = {
  extraction: "claude-sonnet-5",
  cheap: "claude-haiku-4-5",
} as const;
