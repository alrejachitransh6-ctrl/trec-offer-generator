# TREC 1-4 Offer Generator — Master Project Spec

This is the single source of truth for this project. Everything needed to
build the feature is in this one file, plus the blank TREC 1-4 PDF handed
alongside it.

---

## 1. Goal
A web application for a Texas real estate wholesaler (DFW market) to
quickly generate a filled-out TREC 1-4 (One to Four Family Residential
Contract, Resale) for a property. The user provides an address and a
handful of deal-specific terms; the app looks up the property's legal
description automatically and fills the rest from the user's saved default
preferences.

Built multi-user from day one — starts with 2 users (owner + one friend
testing), designed so adding more users later requires no rebuild.

## 2. Current status (infrastructure — already built and verified)
- Staging and production environments are both built and confirmed
  working.
- Two isolated Supabase projects exist (staging, production), each with
  their own credentials, correctly scoped in Vercel (Production scope vs.
  Preview scope pinned to the `staging` branch).
- Vercel Custom Environments are explicitly NOT used — this project stays
  on the free Hobby plan. Do not reintroduce Custom Environments.
- Both `main` and `staging` branches are pushed to GitHub and deploying
  successfully. `staging` confirmed live and correct via `/api/health`.
- No contract-generation feature code exists yet — everything so far is
  environment/infrastructure only. This document defines the feature to
  build next.

## 3. Multi-user requirements
- Each user has their own account and authentication.
- Each user has their own independently editable set of default contract
  preferences (see Section 5).
- Users' data (contracts generated, saved defaults) is fully isolated
  from each other — one user must never see or access another's data.

## 4. Recommended stack
- **Next.js** — app framework (frontend + backend API routes together)
- **Supabase** — Postgres database + built-in authentication
- **pdf-lib** — fills the actual TREC 1-4 PDF form fields
- **Vercel** — hosting/deployment (already connected, see Section 2)

## 5. AI architecture — where AI lives in the running app vs. plain code
This app should have AI genuinely embedded at runtime, not just used to
build it. The split below is deliberate and should guide the whole build.

**AI-driven at runtime:**
- Interpreting the user's natural-language overrides to standing defaults
  for a single deal (e.g. "seller pays for the survey this time") — map
  plain language to the correct field(s) and value(s) without changing
  the user's saved account default.
- Reading the county appraisal district page for a given address and
  extracting the legal description. County sites are inconsistently
  structured and can change layout over time — AI reading actual page
  content is more resilient than hardcoded scraping logic tied to a
  specific page structure.

**Deliberately NOT AI — plain, deterministic code:**
- Writing values into the TREC 1-4 PDF form fields once data is gathered
  (via pdf-lib). No ambiguity in this step; it's mechanical.
- Storing/retrieving saved defaults, user accounts, and generated
  contracts (via Supabase). Plain database reads/writes.
- Navigating to the correct county appraisal site for a given county — a
  lookup table of URLs, not an AI decision.

**Hard rule:** the auto-looked-up legal description must always be shown
back to the user for explicit confirmation before it's used in a
generated contract — never inserted silently, AI-read or not.

## 6. Core user flow
1. User logs into their account.
2. User provides a property address + county.
3. App kicks off the appraisal district lookup (AI-assisted page reading,
   see Section 5) in the background.
4. In the same turn, app asks for every ASK field from Section 7, grouped
   logically (Seller info → Sales Price → Earnest money/Escrow/Title →
   Option Period → Closing Date → HOA → Special Provisions → Signatory
   names).
5. App presents the looked-up legal description for explicit user
   confirmation/edit before it can be used.
6. App fills all FIXED and DEFAULT fields automatically, applies any
   natural-language override the user states for this specific deal
   (without changing their saved account default, using AI per Section
   5), and generates the PDF via pdf-lib.

## 7. TREC 1-4 field-by-field fill specification
Three categories apply to every field below:
- **DEFAULT** — pulled from the logged-in user's saved account settings.
  Editable in account settings; used automatically unless overridden for
  a single deal.
- **ASK** — prompted fresh for every single contract generated.
- **FIXED** — always the same value, not user-editable, not asked.

### Default fallback rule
Any fillable field, checkbox, or blank on the form not explicitly listed
below defaults to blank/n-a and must never be auto-filled or auto-checked
without first being added to this spec. Hard rule — when in doubt, leave
blank rather than guess.

### 1. Parties
- Buyer name/info — **DEFAULT**
- Seller name/info — **ASK**

### 2. Property
- A. Land (Lot, Block, Addition, City, County, address/zip) — auto-
  populated via the live appraisal district lookup (Section 5), always
  shown back to the user for confirmation before use
- D. Exclusions — **FIXED**: "n/a"
- E. Reservations — leave as-is (unused unless told otherwise)

### 3. Sales Price
- A. Cash portion — **ASK**
- B. Sum of financing — **FIXED**: leave blank
- C. Sales Price (sum of A and B) — **FIXED logic**: always equal to line
  A, computed automatically, not asked separately
- Financing addendum checkboxes (Third Party Financing / Loan Assumption
  / Seller Financing) — inferred **FIXED**: all unchecked (logical
  consequence of an all-cash deal; not explicitly confirmed, verify if
  in doubt)

### 4. Leases
- All of A/B/C and sub-items — **FIXED**: left entirely blank/unchecked

### 5. Earnest Money and Termination Option
- Escrow Agent name — **ASK**
- Escrow Agent address — **ASK**
- Earnest money amount — **ASK**
- Option fee amount — **ASK**
- Additional earnest money amount and days (5A(1)) — **FIXED**: "n/a" in
  both blanks
- Option Period days (5B) — **ASK**

### 6. Title Policy and Survey
- A. Title Policy expense — **FIXED**: Buyer's expense box checked
- Title Company name — **ASK**
- A(8) discrepancies/shortages clause — **FIXED**: "(i) will not be
  amended or deleted from the title policy"
- C. Survey — **FIXED**: option (2) selected, "0" days
- D. Objections — **FIXED**: prohibited-use blank = "none"; the "(ii)
  ___ days after Buyer receives the Commitment..." blank = "N/A"

### 7. Property Condition
- B. Seller's Disclosure Notice — **FIXED**: option (2) — "Buyer has not
  received the Seller's Disclosure Notice" — with "3" in the days blank
- D. Acceptance of Property Condition — **FIXED**: option (1) — "Buyer
  accepts the Property As Is"
- H. Residential Service Contracts reimbursement amount — **FIXED**:
  "n/a"
- I. Seller's Disclosure About Groundwater and Surface Water Rights —
  **FIXED**: option (2) — "Buyer has not received the Seller's Water
  Disclosure" — with "3" in the days blank

### 8. Broker or Sales Agent Disclosure
- Disclosure blank — **FIXED**: "n/a"

### 9. Closing
- A. Closing Date — **ASK** (day/month/year). If given an incomplete
  date, default the year to the current contract year unless told
  otherwise.

### 10. Possession
- A. Buyer's Possession — **FIXED**: "upon closing and funding"

### 11. Special Provisions
- Blank — **ASK**, defaulting to "n/a" if the user has nothing to add

### 12. Settlement and Other Expenses
- A(1)(b) amount to Buyer's Expenses — **FIXED**: "n/a"
- B. Brokerage Compensation — **FIXED**: neither checkbox checked, "n/a"
  — Buyer pays no contribution toward Seller's broker, unless overridden
  for a specific deal. (The Seller-side checkbox being off too is
  inferred by extension, not stated outright — verify if in doubt.)

### Sections requiring no fill (leave entirely blank)
- 21. Notices (all address/phone/email blocks)
- 22. Agreement of Parties addenda checklist — every box unchecked,
  "Other" line blank, unless explicitly told to check a specific
  addendum for a specific deal
- 23. Consult an Attorney (all blocks)
- Broker Contact Information page

### HOA (Section 7, Title Notices item (2))
- **ASK**: is the property subject to mandatory HOA membership? Select
  "is" or "is not" accordingly.

### Effective Date (top of signature page)
- **FIXED for v1**: left blank — filled at actual signing, not at
  generation time. Out of scope for auto-fill in this version.

### Signature page
- Buyer signature line(s) — **ASK**: actual signatory name(s), not the
  business entity name
- Seller signature line(s) — **ASK**: actual signatory name(s)

## 8. Explicitly out of scope for v1
- Counties beyond the DFW four (Dallas, Tarrant, Denton, Collin)
- Any contract type other than TREC 1-4
- Payment/billing (pre-product-validation, not for sale yet)
- Whether this tool is legally permissible to resell to other real estate
  professionals under Texas real estate commission rules — a legal
  question being researched separately, not a build task

## 9. What "done" looks like for v1
Two accounts (owner + one friend) can each log in, generate a TREC 1-4
for a real DFW property in one of the four supported counties, see the
looked-up legal description and confirm it, get their own standing
defaults applied automatically, override any field for a single deal
without changing their saved default, and download a correctly filled
PDF at the end.

## 10. Suggested build order (open to adjustment)
1. Address input + county appraisal lookup and confirmation flow (the
   riskiest, least-proven piece — build and prove this first)
2. Ask-every-time field collection flow
3. PDF generation via pdf-lib
4. Account/login and saved-defaults management
