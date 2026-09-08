import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  PDFCheckBox,
  PDFDocument,
  PDFTextField,
  StandardFonts,
  rgb,
} from "pdf-lib";

import type { Deal } from "@/lib/deals/repo";
import { F, HEADER_ADDRESS_FIELDS } from "@/lib/trec/field-map";
import { dealWarnings } from "@/lib/trec/readiness";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "public/templates/trec-20-19.pdf",
);

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export interface FillResult {
  bytes: Uint8Array;
  /** Things a human must check or complete on the generated PDF. */
  warnings: string[];
}

/**
 * Fill the TREC 20-19 form from a deal. Deterministic (spec §5): no AI here.
 * FIXED values come straight from `docs/spec.md` §7; ASK values from the deal
 * terms; per-deal overrides adjust the safe text fields and raise a warning for
 * anything that needs a manual checkbox change.
 */
export async function fillTrec20_19(deal: Deal): Promise<FillResult> {
  const templateBytes = await readFile(TEMPLATE_PATH);
  const pdf = await PDFDocument.load(templateBytes);
  const form = pdf.getForm();
  const fields = form.getFields();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const warnings: string[] = dealWarnings(deal);

  const text = (
    idx: number,
    value: string | number | null | undefined,
    size = 8,
  ) => {
    if (value === null || value === undefined || value === "") return;
    const field = fields[idx];
    if (!(field instanceof PDFTextField)) {
      warnings.push(`Internal: field ${idx} is not a text field.`);
      return;
    }
    // Many blanks on this form are narrow; a smaller fixed size clips less.
    field.setFontSize(size);
    field.setText(String(value));
  };
  const check = (idx: number) => {
    const field = fields[idx];
    if (field instanceof PDFCheckBox) field.check();
    else warnings.push(`Internal: field ${idx} is not a checkbox.`);
  };
  const drawAt = (idx: number, value: string) => {
    if (!value.trim()) return;
    const widget = fields[idx]?.acroField.getWidgets()[0];
    if (!widget) return;
    const rect = widget.getRectangle();
    const pageRef = widget.P();
    const page = pdf.getPages().find((p) => p.ref === pageRef);
    if (!page) return;
    page.drawText(value, {
      x: rect.x + 2,
      y: rect.y + 4,
      size: 9,
      font,
      color: rgb(0, 0, 0.55),
    });
  };

  const ld = deal.legalDescription;
  const t = deal.terms;
  const overrides = new Map(
    deal.overrides.map((o) => [o.targetId, o.newValue]),
  );
  const ov = (id: string) => overrides.get(id);

  // Page headers (property address)
  for (const idx of HEADER_ADDRESS_FIELDS) text(idx, deal.propertyAddress);

  // §1 Parties
  text(F.sellerNameInfo, t.seller.nameInfo);
  const buyer = ov("buyer_name_info") ?? deal.defaults.buyerNameInfo;
  text(F.buyerNameInfo, buyer);
  if (!buyer.trim()) warnings.push("Buyer name/info (§1) is blank.");

  // §2A Land
  text(F.lot, ld.lot);
  text(F.block, ld.block);
  text(F.addition, ld.addition || ld.legalDescription);
  text(F.city, ld.city);
  text(F.county, ld.county);
  text(F.propertyAddress, deal.propertyAddress);

  // §2D Exclusions — FIXED "n/a" (override: excluded items)
  text(F.exclusions1, ov("exclusions") ?? "n/a");

  // §3 Sales price — all cash: §3C = §3A, §3B blank + unchecked
  text(F.cashPortion, money(t.salesPrice.cashPortionUsd));
  text(F.salesPrice, money(t.salesPrice.cashPortionUsd));

  // §5 Earnest money / escrow / option
  text(F.escrowAgentName, t.earnestMoney.escrowAgentName);
  {
    // The escrow-agent address spans a short field then a full line; split it.
    const [line1, line2] = splitAt(t.earnestMoney.escrowAgentAddress, 26);
    text(F.escrowAgentAddress1, line1);
    text(F.escrowAgentAddress2, line2);
  }
  text(F.earnestMoneyAmount, money(t.earnestMoney.earnestMoneyUsd));
  text(F.optionFeeAmount, money(t.earnestMoney.optionFeeUsd));
  // §5A(1) additional earnest money — FIXED "n/a" unless overridden (in which
  // case it's left blank for a human to complete; see dealWarnings).
  const hasAddlEarnest = Boolean(ov("additional_earnest_money"));
  text(F.additionalEarnestAmount, hasAddlEarnest ? null : "n/a");
  text(F.additionalEarnestDays, hasAddlEarnest ? null : "n/a");
  if (t.earnestMoney.optionPeriodDays > 0)
    text(F.optionPeriodDays, t.earnestMoney.optionPeriodDays);

  // §6A Title policy — Buyer's expense (override: seller)
  if (/seller/i.test(ov("title_policy_expense") ?? ""))
    check(F.titlePolicySellerExpenseCb);
  else check(F.titlePolicyBuyerExpenseCb);
  text(F.titleCompanyName, t.title.titleCompanyName);
  check(F.shortagesNotAmendedCb); // §6A(8)(i) will not be amended

  // §6C Survey — FIXED option (2), "0" days
  check(F.surveyOpt2Cb);
  text(F.surveyOpt2Days, "0");

  // §6D Objections — FIXED
  text(F.objectionsProhibitedUse, "none");
  text(F.objectionsDays, "N/A");

  // §6E(2) HOA mandatory membership — ASK
  if (t.hoa.mandatoryMembership === "is") check(F.hoaIsCb);
  else if (t.hoa.mandatoryMembership === "is_not") check(F.hoaIsNotCb);

  // §7B Seller's Disclosure — FIXED option (2), "3" days
  check(F.disclosureNotReceivedCb);
  text(F.disclosureDays, "3");

  // §7D Acceptance — FIXED option (1) As Is
  check(F.acceptAsIsCb);

  // §7H Residential service contract — FIXED "n/a"
  text(F.serviceContractAmount, ov("residential_service_contract") ?? "n/a");

  // §7I Water Disclosure — FIXED option (2), "3" days
  check(F.waterNotReceivedCb);
  text(F.waterDays, "3");

  // §8 Broker disclosure — FIXED "n/a"
  text(F.brokerDisclosure, "n/a");

  // §9A Closing — ASK
  const cd = t.closingDate;
  if (cd.day > 0 && cd.month >= 1 && cd.month <= 12 && cd.year > 0) {
    text(F.closingDate, `${MONTHS[cd.month - 1]} ${cd.day}`);
    text(F.closingYear, String(cd.year).slice(-2));
  }

  // §10A Possession — FIXED "upon closing and funding"
  check(F.possessionUponClosingCb);

  // §11 Special provisions — ASK, default "n/a"
  const sp = t.specialProvisions.trim() || "n/a";
  text(F.specialProvisions1, sp.slice(0, 95));
  text(F.specialProvisions2, sp.slice(95, 215));
  text(F.specialProvisions3, sp.slice(215, 335));
  if (sp.length > 335)
    warnings.push("Special provisions text was truncated to fit §11.");

  // §12A(1)(b) — FIXED "n/a" (override: seller credit)
  text(F.buyerExpensesLimit, ov("seller_contribution_buyer_expenses") ?? "n/a");

  // §12B Brokerage compensation — FIXED unchecked, "n/a"
  text(F.brokerComp1Dollar, "n/a");
  text(F.brokerComp2Dollar, "n/a");

  // Signature lines (drawn — these are signature fields, not text)
  drawAt(F.buyerSignature1, t.signatories.buyerNames);
  drawAt(F.sellerSignature1, t.signatories.sellerNames);

  // Addenda override → recorded on the §22 "Other" line (boxes left for a human;
  // dealWarnings() carries the reminder).
  const addenda = ov("addenda");
  if (addenda) text(F.addendaOther1, addenda);

  form.updateFieldAppearances(font);
  const bytes = await pdf.save();
  return { bytes, warnings };
}

/** Split a string near `max` chars on a word boundary. */
function splitAt(s: string, max: number): [string, string] {
  const str = s.trim();
  if (str.length <= max) return [str, ""];
  let cut = str.lastIndexOf(" ", max);
  if (cut < max * 0.5) cut = max;
  return [str.slice(0, cut).trim(), str.slice(cut).trim()];
}

function money(n: number): string {
  if (!n || n <= 0) return "";
  return Number.isInteger(n)
    ? n.toLocaleString("en-US")
    : n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
}
