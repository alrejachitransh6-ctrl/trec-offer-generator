# CAD lookup — per-county recon

How each DFW county appraisal district exposes property data, for the
`src/lib/counties/adapters/` work.

## Dallas — **live** (`dallas.ts`)

- `dallascad.org`, a classic ASP.NET WebForms site (server-rendered HTML).
- Address search needs `__EVENTTARGET=cmdSubmit` in the postback or it just
  redisplays the form. Then follow the `AcctDetail*.aspx?ID=…` link.
- Legal description + owner are in the page HTML → `extractCadProperty` (AI).

## Tarrant / Denton / Collin — **one shared platform (TrueProdigy)**

All three moved to **TrueProdigy / ProdigyCAD**:

| County  | Portal                   | `office`  |
| ------- | ------------------------ | --------- |
| Tarrant | `tarrant.prodigycad.com` | `Tarrant` |
| Denton  | `denton.prodigycad.com`  | `Denton`  |
| Collin  | `collin.prodigycad.com`  | `Collin`  |

(`www.dentoncad.com` / `www.collincad.org` / `www.tad.org` are just marketing
shells that link to the portal.) `dallas.prodigycad.com` also exists — Dallas
could migrate to this API later for consistency, but the `dallascad.org` scraper
works, so leave it.

### API — `https://prod-container.trueprodigyapi.com`

Server-to-server (no CORS). No API key; an anonymous JWT is issued on demand.

1. `GET /trueprodigy/officelookup/<county>.prodigycad.com`
   → `{ "results": { "office": "Tarrant" } }`
2. `GET /trueprodigy/cadpublic/auth/token`
   → `{ "user": { "token": "<JWT>" } }` — anonymous, ~5-minute expiry.
3. `POST /public/property/searchfulltext?page=1&pageSize=N`
   - Header: `Authorization: <bare JWT>` (**no** `Bearer ` prefix),
     `Content-Type: application/json`
   - Body:
     ```json
     {
       "pYear": { "operator": "=", "value": "<year>" },
       "fullTextSearch": { "operator": "match", "value": "<address or owner>" }
     }
     ```
   - Result rows carry structured fields — no HTML scraping, no AI needed for
     these: `pid`, `pYear`, `name` (owner), `streetPrimary` (address),
     `legalDescription`, `lot`, `tract`, `block`, `legalAcreage`, `marketValue`.
     Confirmed via `GET /public/config/propertysearchresults`.
4. Property-detail endpoint (`/public/property/<pid>` shape) — **not captured
   yet**; the search rows may already carry everything. Verify when their
   backend is up.

### Blocker (2026-09-09)

TrueProdigy's backend DB is down for all counties:
`2005 (HY000): Unknown MySQL server host 'prod-trueprodigy-rds…rds.amazonaws.com'`.
The counties' own public search pages also return "No Rows To Show". Resume the
adapter build (finish the response mapping + a detail call if needed, then test
against real addresses) when `tad.org` property search works again.

### Adapter shape when built

One `prodigyCadAdapter(office: "Tarrant" | "Denton" | "Collin")` factory in
`adapters/prodigy-cad.ts`; the registry maps each county id to it. Owner name
still runs through the same normalisation as Dallas (CAD `name` is
`LAST FIRST`). Because results are structured, the AI extractor is only needed
on the Dallas HTML path.
