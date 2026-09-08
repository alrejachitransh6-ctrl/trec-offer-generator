import type { Deal } from "@/lib/deals/repo";

/**
 * Things a human must complete or check before the generated TREC 20-19 is
 * usable. Pure — no PDF work — so the deal page can show it cheaply. The PDF
 * fill (`fillTrec20_19`) appends the same list to its result.
 */
export function dealWarnings(deal: Deal): string[] {
  const t = deal.terms;
  const w: string[] = [];

  const buyer =
    deal.overrides.find((o) => o.targetId === "buyer_name_info")?.newValue ??
    deal.defaults.buyerNameInfo;
  if (!buyer.trim()) w.push("Buyer name/info (§1) is blank.");
  if (!t.seller.nameInfo.trim()) w.push("Seller name/info (§1) is blank.");
  if (t.salesPrice.cashPortionUsd <= 0) w.push("Sales price (§3A) is not set.");
  if (!t.earnestMoney.escrowAgentName.trim())
    w.push("Escrow agent (§5) is not set.");
  if (t.earnestMoney.earnestMoneyUsd <= 0)
    w.push("Earnest money amount (§5) is not set.");
  if (t.earnestMoney.optionFeeUsd <= 0) w.push("Option fee (§5) is not set.");
  if (t.earnestMoney.optionPeriodDays <= 0)
    w.push("Option period days (§5B) is not set.");
  if (!t.title.titleCompanyName.trim())
    w.push("Title company (§6) is not set.");
  const cd = t.closingDate;
  if (!(cd.day > 0 && cd.month >= 1 && cd.month <= 12 && cd.year > 0))
    w.push("Closing date (§9A) is incomplete.");
  if (t.hoa.mandatoryMembership === "unknown")
    w.push("HOA mandatory-membership status not set (§7 item 2).");
  if (!t.signatories.buyerNames.trim())
    w.push("Buyer signatory name(s) not set.");
  if (!t.signatories.sellerNames.trim())
    w.push("Seller signatory name(s) not set.");

  for (const o of deal.overrides) {
    if (o.targetId === "survey_responsibility")
      w.push(
        `Override "${o.newValue}": adjust §6C (survey) on page 3 manually.`,
      );
    if (o.targetId === "possession")
      w.push(
        `Override "${o.newValue}": adjust §10A / attach a temporary lease manually.`,
      );
    if (o.targetId === "additional_earnest_money")
      w.push(
        `Override "${o.newValue}": enter the amount and days in §5A(1) manually.`,
      );
    if (
      o.targetId === "buyer_broker_contribution" &&
      !/^none/i.test(o.newValue)
    )
      w.push(
        `Override "${o.newValue}": enter the §12B amount and check the box on page 7 manually.`,
      );
    if (o.targetId === "addenda")
      w.push(
        `Addenda "${o.newValue}": check the matching §22 boxes on page 9 and attach them.`,
      );
  }

  return w;
}
