/**
 * The set of normally-FIXED / DEFAULT points on the TREC 1-4 that a per-deal
 * natural-language instruction ("seller pays for the survey this time") is
 * allowed to change. The interpreter maps free text onto these ids only;
 * ask-every-time fields (sales price, option period, closing date, …) are
 * entered in the wizard, not here.
 *
 * `specDefault` is the value the spec pins when nothing overrides it — shown to
 * the user so they can see what they're changing.
 */
export interface OverrideTarget {
  id: string;
  label: string;
  /** TREC paragraph, for the reviewer. */
  ref: string;
  specDefault: string;
  /** What kind of value `newValue` should hold, guidance for the model. */
  valueHint: string;
  examples: string[];
}

export const OVERRIDE_TARGETS: OverrideTarget[] = [
  {
    id: "buyer_name_info",
    label: "Buyer name / info",
    ref: "§1",
    specDefault: "your standing default",
    valueHint: "the buyer entity name and any info block text",
    examples: ["buyer is Blue Sky Holdings LLC on this one"],
  },
  {
    id: "survey_responsibility",
    label: "Survey",
    ref: "§6C",
    specDefault: "existing survey furnished, 0 days (option 2)",
    valueHint:
      'one of: "seller furnishes new survey", "buyer obtains new survey", "existing survey"',
    examples: [
      "seller pays for the survey this time",
      "buyer will get a new survey",
    ],
  },
  {
    id: "title_policy_expense",
    label: "Title policy expense",
    ref: "§6A",
    specDefault: "Buyer's expense",
    valueHint: 'one of: "buyer", "seller"',
    examples: ["seller pays for the owner's title policy"],
  },
  {
    id: "residential_service_contract",
    label: "Residential service contract reimbursement",
    ref: "§7H",
    specDefault: "n/a",
    valueHint: "a dollar amount, or n/a",
    examples: ["seller to cover a home warranty up to $600"],
  },
  {
    id: "seller_contribution_buyer_expenses",
    label: "Seller contribution to Buyer's expenses",
    ref: "§12A(1)(b)",
    specDefault: "n/a",
    valueHint: "a dollar amount, or n/a",
    examples: ["seller credits buyer $5,000 toward closing costs"],
  },
  {
    id: "buyer_broker_contribution",
    label: "Buyer contribution to Seller's broker",
    ref: "§12B",
    specDefault: "none (n/a)",
    valueHint: "a dollar amount or percentage, or none",
    examples: ["we'll pay the listing broker 1%"],
  },
  {
    id: "exclusions",
    label: "Exclusions from the sale",
    ref: "§2D",
    specDefault: "n/a",
    valueHint: "free text listing excluded items",
    examples: ["seller keeps the refrigerator and the shed"],
  },
  {
    id: "possession",
    label: "Possession",
    ref: "§10A",
    specDefault: "upon closing and funding",
    valueHint: "free text",
    examples: ["seller stays 3 days after closing under a leaseback"],
  },
  {
    id: "additional_earnest_money",
    label: "Additional earnest money (5A(1))",
    ref: "§5A(1)",
    specDefault: "n/a / n/a",
    valueHint: "an amount and a number of days",
    examples: ["extra $10k earnest money due 15 days after effective date"],
  },
  {
    id: "addenda",
    label: "Addenda to attach",
    ref: "§22",
    specDefault: "none checked",
    valueHint: "the name(s) of TREC addenda to check",
    examples: [
      "attach the third-party financing addendum",
      "add the HOA addendum",
    ],
  },
];

export const OVERRIDE_TARGET_IDS = OVERRIDE_TARGETS.map((t) => t.id);

export function overrideTarget(id: string): OverrideTarget | undefined {
  return OVERRIDE_TARGETS.find((t) => t.id === id);
}
