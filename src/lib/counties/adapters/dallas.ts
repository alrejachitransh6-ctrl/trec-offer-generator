import * as cheerio from "cheerio";

import { extractCadProperty } from "@/lib/ai/extract-cad-property";
import { parseStreetAddress } from "@/lib/ai/parse-address";
import type { CadAdapter, CadLookupResult } from "@/lib/counties/types";

const BASE = "https://www.dallascad.org";
const SEARCH_URL = `${BASE}/SearchAddr.aspx`;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const TIMEOUT_MS = 15_000;

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

/**
 * Run one DallasCAD address search. `__EVENTTARGET=cmdSubmit` is required —
 * without it the site just redisplays the empty form. DCAD matches on the base
 * street name (no suffix), case-insensitively.
 */
async function runSearch(
  cookie: string,
  hidden: Record<string, string>,
  number: string,
  streetName: string,
  direction: string,
): Promise<Candidate[]> {
  const body = new URLSearchParams({
    __EVENTTARGET: "cmdSubmit",
    __EVENTARGUMENT: "",
    __VIEWSTATE: hidden.__VIEWSTATE ?? "",
    __VIEWSTATEGENERATOR: hidden.__VIEWSTATEGENERATOR ?? "",
    __EVENTVALIDATION: hidden.__EVENTVALIDATION ?? "",
    txtAddrNum: number,
    listStDir: direction,
    txtStName: streetName.slice(0, 23),
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

  const res = await fetchText(SEARCH_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: BASE,
      referer: SEARCH_URL,
      ...(cookie ? { cookie } : {}),
    },
    body: body.toString(),
  });
  return parseCandidates(cheerio.load(await res.text()));
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

/**
 * A real DCAD detail page has a "Legal Desc" section with actual values.
 * Invalid / "No Data" accounts return a shell page — don't feed that to the
 * model (it hallucinates on empty pages).
 */
function looksLikePropertyPage(text: string): boolean {
  if (/could not be (shown|displayed)/i.test(text)) return false;
  const m = text.match(
    /Legal Desc\s*\(Current[^)]*\)([\s\S]*?)(?:Deed Transfer Date|Value|Main Improvement)/i,
  );
  if (!m) return false;
  const section = m[1]!
    .replace(/\bNo Data\b/gi, "")
    .replace(/\d+\s*:/g, "")
    .trim();
  return /[A-Za-z]{3,}/.test(section);
}

export const dallasAdapter: CadAdapter = {
  id: "dallas",

  async lookup(address: string): Promise<CadLookupResult> {
    const parsed = await parseStreetAddress(address);
    if (!parsed.streetNumber || !parsed.streetName) {
      return {
        sourceUrl: null,
        pageContext: "",
        error:
          "Could not read a street number and name from that address. " +
          'Try including both, e.g. "9820 Ash Creek Dr".',
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

      // 2. Search on the plain street name first (the address parser
      //    occasionally invents a directional). Only retry *with* the
      //    directional if the plain search finds nothing.
      let candidates = await runSearch(
        cookie,
        hidden,
        parsed.streetNumber,
        parsed.streetName,
        "",
      );
      if (candidates.length === 0 && parsed.direction) {
        candidates = await runSearch(
          cookie,
          hidden,
          parsed.streetNumber,
          parsed.streetName,
          parsed.direction,
        );
      }

      if (candidates.length === 0) {
        return {
          sourceUrl: SEARCH_URL,
          pageContext: "",
          error:
            `No match on DallasCAD for "${parsed.streetNumber} ${parsed.streetName}". ` +
            "Check the address, or enter the legal description manually.",
          extracted: null,
        };
      }

      // 3. Fetch the best detail page. If several matched, prefer one whose
      //    label starts with the street number (and matches the directional
      //    when we have one), else take the first and note the ambiguity.
      const numMatch = (c: Candidate) =>
        c.label.toLowerCase().startsWith(parsed.streetNumber.toLowerCase());
      const dirRe = parsed.direction
        ? new RegExp(`\\b${parsed.direction}\\b`, "i")
        : null;
      const chosen =
        (dirRe && candidates.find((c) => numMatch(c) && dirRe.test(c.label))) ||
        candidates.find(numMatch) ||
        candidates[0]!;
      const detailRes = await fetchText(chosen.detailUrl, {
        headers: cookie ? { cookie } : {},
      });
      const pageText = detailPageText(await detailRes.text());

      if (!looksLikePropertyPage(pageText)) {
        return {
          sourceUrl: chosen.detailUrl,
          pageContext: pageText,
          error:
            "DallasCAD returned a page without a legal description for that " +
            "match. Open the source page to check, or enter it manually.",
          extracted: null,
        };
      }

      const ambiguityNote =
        candidates.length > 1
          ? `DallasCAD returned ${candidates.length} matches: ${candidates
              .map((c) => c.label)
              .join("; ")}. Showing "${chosen.label}".`
          : "";

      // 4. Extract with the model.
      try {
        const extracted = await extractCadProperty({
          address,
          county: "Dallas",
          pageText,
        });
        return {
          sourceUrl: chosen.detailUrl,
          pageContext: pageText,
          extracted: {
            ...extracted,
            sourceUrl: chosen.detailUrl,
            notes: ambiguityNote
              ? [ambiguityNote, extracted.notes].filter(Boolean).join(" ")
              : extracted.notes,
          },
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
        sourceUrl: SEARCH_URL,
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
