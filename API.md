# Cation API Contract

Shared contract between backend and frontend. Both sides implement exactly this.
Base: Next.js App Router, all routes under `/app/api`. JSON everywhere.
Auth: `Authorization: Bearer <jwt>` (our own JWT, jose-signed, from /api/auth/login).

## Roles

`cfo` | `agent` | `compliance` | `recipient` — one demo user per role, seeded in Mongo.
JWT payload: `{ sub, role, party }` where `party` = Canton party ID (env-mapped).

## Routes

### POST /api/auth/login
Body: `{ "username": string, "password": string }`
200: `{ "token": string, "role": Role, "displayName": string }`
401 on bad creds.

### GET /api/me
200: `{ "role": Role, "party": string, "displayName": string }`

### GET /api/mandate            (cfo, agent)
Current mandate view (from ACS: MandateTerms + AgentMandateState).
200: `{
  "mandateId": string, "status": "Active"|"Paused"|"Revoked",
  "autoApproveLimit": string, "perActionMaximum": string,
  "dailyMaximum": string, "monthlyMaximum": string,
  "dailySpent": string, "monthlySpent": string,
  "currency": string, "expiresAt": string,
  "permittedCategories": string[],
  "counterparties": [{ "party": string, "label": string }],
  "version": number
}`
404 if no active mandate.

### POST /api/mandate           (cfo)
Create MandateOffer (then backend auto-accepts as agent for demo flow).
Body: `{ "autoApproveLimit": string, "perActionMaximum": string, "dailyMaximum": string,
  "monthlyMaximum": string, "expiresAt": string, "counterpartyIds": string[],
  "categories": string[] }`
200: mandate view (as GET).

### POST /api/mandate/pause     (cfo)  → 200 mandate view
### POST /api/mandate/resume    (cfo)  → 200 mandate view
### POST /api/mandate/revoke    (cfo)  → 200 mandate view

### POST /api/agent/chat        (agent)
NL message to Groq agent. Agent may call propose_financial_action.
Body: `{ "message": string }`
200: `{
  "reply": string,
  "action": null | {
    "requestId": string, "category": string, "amount": string,
    "counterpartyId": string, "purpose": string,
    "outcome": "executed" | "pending" | "denied",
    "denialCode": string | null,
    "receiptId": string | null
  }
}`

### GET /api/activity           (role-scoped — THE privacy demo endpoint)
Returns only what the caller's party can see on ledger.
200: `{ "items": ActivityItem[] }`
ActivityItem: `{
  "type": "receipt" | "violation" | "pending" | "mandate-event",
  "requestId": string, "amount": string?, "currency": string?,
  "counterpartyLabel": string?, "code": string?, "category": string?,
  "at": string, "detail": string
}`
- cfo: everything
- agent: its requests/receipts/violations/pendings
- compliance: violations only
- recipient: its receipts only

### GET /api/approvals          (cfo)
200: `{ "items": [{ "pendingId": string, "requestId": string, "amount": string,
  "currency": string, "counterpartyLabel": string, "category": string,
  "purpose": string, "createdAt": string }] }`

### POST /api/approvals/:pendingId/approve   (cfo)
200: `{ "outcome": "executed" | "denied", "denialCode": string | null }`

### POST /api/approvals/:pendingId/reject    (cfo)
200: `{ "ok": true }`

### GET /api/treasury           (cfo)
200: `{ "balance": string, "currency": string }`  (sum of cfo-owned DemoDeposits)

## Error shape

Non-200: `{ "error": string, "code": string }`. 401 unauthenticated, 403 wrong role,
409 ledger contention (after retry exhausted), 502 ledger unreachable.

## Env (.env / Vercel)

```
LEDGER_API_URL=https://ledger-api.validator.devnet.sandbox.fivenorth.io
LEDGER_AUTH_MODE=oidc|token|external-party
LEDGER_OIDC_ISSUER=, LEDGER_OIDC_CLIENT_ID=, LEDGER_OIDC_CLIENT_SECRET=
LEDGER_STATIC_TOKEN=            # if token mode
CANTON_PRIVATE_KEY=             # already present; external-party signing if used
PARTY_CFO=, PARTY_AGENT=, PARTY_COMPLIANCE=, PARTY_OPS=, PARTY_RESERVE=
MONGODB_URI=, JWT_SECRET=, GROQ_API_KEY=
```

Ledger auth is pluggable behind one `getLedgerToken(party)` function — mode chosen by env.
All ledger calls go through `lib/ledger.ts`: `create`, `exercise`, `queryAcs(party, templateId)`
against JSON Ledger API v2 (`/v2/commands/submit-and-wait`, `/v2/state/active-contracts`).
Retry once on archived-contract/contention errors after re-fetching latest state cid.
