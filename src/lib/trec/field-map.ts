/**
 * Field map for the blank TREC 20-19 PDF (`public/templates/trec-20-19.pdf`).
 *
 * The shipped form has 280 Acrobat auto-generated field names
 * (`undefined_N`, `Text3`, `Check Box2`, …) that carry no meaning, so fields are
 * addressed by their **index** in `form.getFields()` — a stable order for a
 * fixed file. The indices below were established by rendering the form with
 * every field's index overlaid (see `scripts/`), then reading each against the
 * fill spec (`docs/spec.md` §7).
 *
 * ⚠️ If `public/templates/trec-20-19.pdf` is ever replaced, this map must be
 * re-verified against a fresh overlay render.
 */

/** "Contract Concerning" / "Address of Property" header, one per page 2–12. */
export const HEADER_ADDRESS_FIELDS = [
  18, 30, 35, 43, 48, 53, 54, 55, 86, 242, 272,
];

export const F = {
  // §1 Parties
  sellerNameInfo: 0,
  buyerNameInfo: 1,

  // §2A Land
  lot: 2,
  block: 3,
  addition: 4,
  city: 5,
  county: 6,
  propertyAddress: 7,

  // §2D Exclusions (FIXED "n/a")
  exclusions1: 8,
  exclusions2: 9,

  // §3 Sales price
  cashPortion: 10, // §3A
  financingThirdPartyCb: 11, // §3B — unchecked
  financingSellerCb: 57,
  financingLoanAssumptionCb: 56,
  financingSum: 12, // §3B — blank
  salesPrice: 13, // §3C — = §3A

  // §5 Earnest money / escrow / option
  escrowAgentName: 58,
  escrowAgentAddress1: 91,
  escrowAgentAddress2: 59,
  earnestMoneyAmount: 92,
  optionFeeAmount: 93,
  additionalEarnestAmount: 60, // FIXED "n/a"
  additionalEarnestDays: 70, // FIXED "n/a"
  optionPeriodDays: 19, // §5B — ASK

  // §6A Title policy
  titlePolicySellerExpenseCb: 22,
  titlePolicyBuyerExpenseCb: 23, // FIXED — checked
  titleCompanyName: 61,
  // §6A(8) shortages clause (FIXED — check "(i) will not be amended")
  shortagesNotAmendedCb: 20,
  shortagesAmendedCb: 21,
  shortagesExpenseBuyerCb: 24,
  shortagesExpenseSellerCb: 25,

  // §6C Survey (FIXED — option (2), "0" days)
  surveyOpt1Cb: 72,
  surveyOpt2Cb: 80,
  surveyOpt3Cb: 81,
  surveyOpt1Days: 73,
  surveyOpt2Days: 89,
  surveyOpt3Days: 67,
  surveyOpt1SellerExpenseCb: 78,
  surveyOpt1BuyerExpenseCb: 79,

  // §6D Objections (FIXED)
  objectionsProhibitedUse: 68, // "none"
  objectionsDays: 69, // "N/A"

  // §6E(2) HOA mandatory membership (ASK)
  hoaIsCb: 74,
  hoaIsNotCb: 75,

  // §7B Seller's Disclosure (FIXED — option (2), "3" days)
  disclosureReceivedCb: 37,
  disclosureNotReceivedCb: 38,
  disclosureNotRequiredCb: 90,
  disclosureDays: 36,

  // §7D Acceptance (FIXED — option (1) As Is)
  acceptAsIsCb: 87,
  acceptAsIsWithRepairsCb: 88,
  repairs1: 76,
  repairs2: 77,

  // §7H Residential service contract (FIXED "n/a")
  serviceContractAmount: 247,

  // §7I Water Disclosure (FIXED — option (2), "3" days)
  waterReceivedCb: 248,
  waterNotReceivedCb: 249,
  waterDays: 250,
  waterSupplyCompany: 251,

  // §8 Broker disclosure (FIXED "n/a")
  brokerDisclosure: 252,

  // §9A Closing (ASK)
  closingDate: 101, // "Month DD"
  closingYear: 102, // "YY"

  // §10A Possession (FIXED — upon closing and funding)
  possessionUponClosingCb: 97,
  possessionTempLeaseCb: 98,

  // §11 Special provisions (ASK, default "n/a")
  specialProvisions1: 94,
  specialProvisions2: 95,
  specialProvisions3: 96,

  // §12A(1)(b) (FIXED "n/a")
  buyerExpensesLimit: 274,

  // §12B Brokerage compensation (FIXED — unchecked, "n/a")
  brokerComp1RowCb: 240,
  brokerComp1DollarCb: 273,
  brokerComp1PercentCb: 238,
  brokerComp1Dollar: 275,
  brokerComp1Percent: 276,
  brokerComp2RowCb: 253,
  brokerComp2DollarCb: 254,
  brokerComp2PercentCb: 237,
  brokerComp2Dollar: 277,
  brokerComp2Percent: 278,

  // §22 Addenda — "Other:" line
  addendaOther1: 271,
  addendaOther2: 279,

  // Execution / Effective Date (FIXED blank in v1)
  executedDay: 204,
  executedMonth: 205,
  executedYear: 206,

  // Signature lines (PDFSignature — drawn as text)
  buyerSignature1: 207,
  sellerSignature1: 208,
  buyerSignature2: 209,
  sellerSignature2: 210,
} as const;
