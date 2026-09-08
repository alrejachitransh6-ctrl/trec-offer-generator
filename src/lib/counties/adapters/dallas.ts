import * as cheerio from "cheerio";

import { extractLegalDescription } from "@/lib/ai/extract-legal-description";
import type { CadAdapter, CadLookupResult } from "@/lib/counties/types";

const BASE = "https://www.dallascad.org";
const SEARCH_URL = `${BASE}/SearchAddr.aspx`;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const TIMEOUT_MS = 15_000;

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
]);
const DIRECTIONS = new Set(["n", "s", "e", "w", "ne", "nw", "se", "sw"]);

interface ParsedAddress {
  number: string;
  direction: string;
  street: string;
}

/** Split "1121 N Angie Ln, Dallas TX 75211" into DCAD search fields. */
export function parseAddress(input: string): ParsedAddress | null {
  const firstPart = input.split(",")[0]!.trim();
  const tokens = firstPart.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  const number = tokens.shift()!;
  if (!/^\d+[A-Za-z]?$/.test(number)) return null;

  let direction = "";
  if (tokens.length > 1 && DIRECTIONS.has(tokens[0]!.toLowerCase())) {
    direction = tokens.shift()!.toUpperCase();
  }

  // Drop a trailing street-type suffix — DCAD matches on the base street name.
  if (
    tokens.length > 1 &&
    STREET_SUFFIXES.has(tokens[tokens.length - 1]!.toLowerCase())
  ) {
    tokens.pop();
  }

  const street = tokens.join(" ").slice(0, 23);
  if (!street) return null;
  return { number, direction, street };
}

async function fetchText(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { "user-agent": UA, ...(init?.headers ?? {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

function readHiddenFields($: cheerio.CheerioAPI): Record<string, string> {
  const out: Record<string, string> = {};
  $("input[type=hidden]").each((_, el) => {
    const name = $(el).attr("name");
    if (name) out[name] = $(el).attr("value") ?? "";
  });
  return out;
}

interface Candidate {
  id: string;
  detailUrl: string;
  label: string;
}

function parseCandidates($: cheerio.CheerioAPI): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  $("a[href*='ID=']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (!/AcctDetail\w*\.aspx\?ID=/i.test(href)) return;
    const id = new URL(href, `${BASE}/`).searchParams.get("ID") ?? "";
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      detailUrl: new URL(href, `${BASE}/`).toString(),
      label: $(el).text().replace(/\s+/g, " ").trim(),
    });
  });
  return out;
}

/** Visible text of a DCAD detail page, trimmed for the model. */
function detailPageText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, nav, header, footer, noscript").remove();
  return $("body")
    .text()
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, 8000);
}

export const dallasAdapter: CadAdapter = {
  id: "dallas",

  async lookup(address: string): Promise<CadLookupResult> {
    const parsed = parseAddress(address);
    if (!parsed) {
      return {
        sourceUrl: null,
        pageContext: "",
        error:
          "Could not read a street number and name from that address. " +
          'Try e.g. "1121 Angie Ln".',
        extracted: null,
      };
    }

    try {
      // 1. Prime the form (VIEWSTATE + session cookie).
      const formRes = await fetchText(SEARCH_URL);
      const cookie = (formRes.headers.getSetCookie?.() ?? [])
        .map((c) => c.split(";")[0])
        .join("; ");
      const hidden = readHiddenFields(cheerio.load(await formRes.text()));

      // 2. Post the search. `__EVENTTARGET=cmdSubmit` is required — without it
      //    the site just redisplays the form.
      const body = new URLSearchParams({
        __EVENTTARGET: "cmdSubmit",
        __EVENTARGUMENT: "",
        __VIEWSTATE: hidden.__VIEWSTATE ?? "",
        __VIEWSTATEGENERATOR: hidden.__VIEWSTATEGENERATOR ?? "",
        __EVENTVALIDATION: hidden.__EVENTVALIDATION ?? "",
        txtAddrNum: parsed.number,
        listStDir: parsed.direction,
        txtStName: parsed.street,
        txtBldgID: "",
        txtUnitID: "",
        listCity: "",
        txtAddrNum1: "",
        txtAddrNum2: "",
        "AcctTypeCheckList1:chkAcctType:0": "1",
        "AcctTypeCheckList1:chkAcctType:1": "2",
        "AcctTypeCheckList1:chkAcctType:2": "3",
        cmdSubmit: "Search",
      });

      const resultsRes = await fetchText(SEARCH_URL, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          origin: BASE,
          referer: SEARCH_URL,
          ...(cookie ? { cookie } : {}),
        },
        body: body.toString(),
      });
      const candidates = parseCandidates(cheerio.load(await resultsRes.text()));

      if (candidates.length === 0) {
        return {
          sourceUrl: `${BASE}/SearchAddr.aspx`,
          pageContext: "",
          error:
            "No matching property found on DallasCAD for that address. " +
            "Check the address, or enter the legal description manually.",
          extracted: null,
        };
      }

      // 3. Fetch the (best) detail page. If several matched, prefer an exact
      //    street-number match, else take the first and note the ambiguity.
      const exact = candidates.find((c) =>
        c.label.toLowerCase().startsWith(parsed.number.toLowerCase()),
      );
      const chosen = exact ?? candidates[0]!;
      const detailRes = await fetchText(chosen.detailUrl, {
        headers: cookie ? { cookie } : {},
      });
      const pageText = detailPageText(await detailRes.text());

      const ambiguityNote =
        candidates.length > 1
          ? `DallasCAD returned ${candidates.length} matches: ${candidates
              .map((c) => c.label)
              .join("; ")}. Showing "${chosen.label}".`
          : "";

      // 4. Extract with the model.
      try {
        const extracted = await extractLegalDescription({
          address,
          county: "Dallas",
          pageText,
        });
        return {
          sourceUrl: chosen.detailUrl,
          pageContext: pageText,
          extracted: ambiguityNote
            ? {
                ...extracted,
                notes: [ambiguityNote, extracted.notes]
                  .filter(Boolean)
                  .join(" "),
              }
            : extracted,
        };
      } catch (err) {
        return {
          sourceUrl: chosen.detailUrl,
          pageContext: pageText,
          error: `Found the property but couldn't extract the legal description automatically (${errMessage(
            err,
          )}). Review the page text and enter it manually.`,
          extracted: null,
        };
      }
    } catch (err) {
      return {
        sourceUrl: `${BASE}/SearchAddr.aspx`,
        pageContext: "",
        error: `DallasCAD lookup failed (${errMessage(
          err,
        )}). Enter the legal description manually.`,
        extracted: null,
      };
    }
  },
};

function errMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.name === "AbortError" ? "timed out" : err.message;
  }
  return "unknown error";
}
