# AGENTS.md — Cation

Guidance for AI coding agents working in this repository.

## What this project is

**Cation** — a private authorization layer for agentic finance on Canton Network.
Organizations issue revocable on-ledger Daml mandates defining exactly what an AI agent can
access, who it can transact with, how much it can move, and when human approval is required.

Core principle: **The AI proposes. The mandate decides.** The LLM never holds ledger
authority; Daml contracts enforce authorization deterministically.

Read `plan.md` before making changes — it is the source of truth for architecture, contract
model, and current status. The project is functionally complete and verified end-to-end
against real Canton DevNet transactions; remaining work is deployment and polish.

## Stack

- **Daml SDK 3.5.2** — smart contracts in `/daml`, built via `dpm`
- **Next.js (App Router)** — single app, frontend + API routes, deployed on **Vercel**
- **No self-hosted validator, no EC2.** Ledger access is entirely outbound HTTPS (Seaport
  proxy + Mongo + Groq), so the backend runs as ordinary Vercel serverless functions
- **MongoDB Atlas** — auth users only. Ledger is the sole source of truth for all mandate
  and business state
- **JWT auth (jose)** — real tokens; each user maps to a Canton party server-side
- **Groq** (`meta-llama/llama-4-scout-17b-16e-instruct`, tool-calling) — agent runtime
- **Zod** — intent schema validation in `/packages/agent`

### Ledger transport — read this before touching `lib/ledger.ts` or `lib/seaportTransport.ts`

The validator's own OIDC client-credentials path (`validator-devnet-m2m`) 403s on command
submission (confirmed platform-wide, not our bug). Live traffic goes through
`lib/seaportTransport.ts`, which reverse-engineers Seaport's own backend API
(`app.devnet.seaport.to/api/orgs/{org}/contracts/{create,exercise-choice,active-contracts}`),
authenticated with the org admin's Seaport session cookie (`SEAPORT_SESSION_COOKIE` in env
— sensitive, backend-only, never log or expose to the frontend).

`lib/ledger.ts` dispatches between this and the direct JSON API v2 client based on
`LEDGER_AUTH_MODE`. If a working OIDC credential ever becomes available, switching to
`LEDGER_AUTH_MODE=oidc` reverts to direct calls with zero route-level changes — both
transports implement the same `createContract` / `exerciseChoice` / `queryAcs` surface.

Two non-obvious things learned empirically, both handled in `seaportTransport.ts`:
- The `party` passed to Seaport must be the actual **choice controller**, not any default
  party — a wrong party produces a misleading generic `"Authentication failed"` error.
- **Daml nullary variants (enums) are JSON strings**, not `{tag, value}` objects, over this
  API — e.g. `ActionCategory` values are `"OperationalPayment"`, plain. Both call sites that
  build these (`app/api/mandate/route.ts`, `app/api/agent/chat/route.ts`) already do this
  correctly; don't reintroduce `{tag, value}` encoding.

## Repository layout

```
/daml               Daml templates + Daml Script tests (17/17 passing)
/apps/web           Next.js app: UI (app/(app)/**) + API routes (app/api/**) + lib/**
  lib/ledger.ts           dispatches to direct JSON API or Seaport proxy
  lib/seaportTransport.ts Seaport proxy transport (see above)
  lib/ledgerAuth.ts       direct-OIDC token fetch (currently unused, kept for fallback)
  lib/mandateUtils.ts     getMandateView — selects the CURRENT mandate; see invariant below
  lib/partyMap.ts         counterparty label ↔ party ID, role ↔ party ID
/packages/agent     prompt, Zod intent schema, Groq tool adapter — requestId generation
                    lives in the API route, NOT here (see invariant below)
/scripts            seed-users.ts (idempotent, re-runnable)
```

## Commands

```bash
# Daml (needs dpm on PATH: export PATH="$HOME/.dpm/bin:$PATH")
cd daml && dpm build             # clean DAR build required before any deploy
cd daml && dpm test              # Daml Script test suite — must stay green

# App (monorepo root)
npm install
npx tsx scripts/seed-users.ts    # seed Mongo users + treasury deposit (idempotent)
cd apps/web && npm run dev       # local dev — copy root .env to apps/web/.env.local first
npx tsc --noEmit                 # typecheck (in apps/web)
npm run build                    # next build
```

## Hard invariants — never violate

1. **LLM never gets ledger access.** The agent runtime has exactly one financial tool:
   `propose_financial_action`. Never give it raw keys, generic command submission, contract
   ids, party selection, admin credentials, or package upload. The backend maps validated
   intent to a fixed Daml choice deterministically.
2. **`requestId` is generated server-side, never trusted from the LLM.** Groq/Llama
   reliably copies the example ID from the system prompt verbatim instead of randomizing —
   confirmed empirically, not a hypothetical. `app/api/agent/chat/route.ts` overwrites
   `proposedAction.requestId` with a fresh `crypto.randomUUID()`-derived value before
   submission. Do not remove this override or trust the model's ID for anything.
3. **Policy denial = successful transaction.** `RequestAction` always succeeds and branches
   internally (execute / approval / denial). Denials create `PolicyViolation` records;
   never use `abort`/failed asserts for policy outcomes.
4. **No contract keys.** Daml 3.x removed them. Dedup via bounded `recentRequestIds` on
   `AgentMandateState`. This also means **multiple independent mandate chains can coexist**
   for the same party — `getMandateView` must select by status (prefer Active, then Paused,
   then highest version overall) and never by raw version number across different
   mandateIds. This caused a real bug once (an old revoked test mandate with a higher
   version number shadowed a fresh active one) — the fix is in `lib/mandateUtils.ts`, do
   not regress it.
5. **Consuming-choice serialization is the concurrency guard.** `RequestAction` and
   `ExecuteApprovedAction` consume `AgentMandateState` and recreate it. Never move spend
   accounting to an off-chain counter. Backend retries once on contention (`isContentionError`).
6. **Approval is not a bypass.** `ApproveRequest` → `ExecuteApprovedAction` re-evaluates the
   *current* mandate state (limits, expiry, status) before executing — verified: approving
   a pending request that would now exceed the daily cap correctly denies it.
7. **Never trust a ledger-write call's success/failure signal alone.** Seaport's proxy can
   return misleading responses (observed: 200-with-error-body on one call that actually
   committed). Every route re-verifies outcome via a follow-up ACS query
   (`detectOutcome` in the chat route is the reference pattern).
8. **Privacy by contract decomposition.** Never merge data for different audiences into one
   contract. Terms, usage state, approvals, violations, receipts are separate templates
   with minimal stakeholders each (see privacy matrix in `plan.md` §3). Verified live: a
   compliance-role query returns only violations, a recipient-role query returns only its
   own receipts.
9. **Per-role credentials.** Separate JWTs for CFO / agent / compliance / recipient. The
   browser never receives a ledger token. Role views are separate party-scoped ACS queries,
   never client-side filtering.
10. **No LLM conversation on-ledger.** Store structured intent only (no free-text prompts).
11. **Scope discipline.** 7 templates, no more (`plan.md` §4). Do not add bank APIs, KYC,
    bridging, FX, reputation, NL policy generation, or a requester role.

## Daml conventions

- Signatories/observers per template exactly as the table in `plan.md` §4.
- `MandateTerms` includes `compliance : Party` — violation records need it.
- `DemoDeposit` includes a `delegates : [Party]` observer field — the mandated agent must be
  a delegate on the treasury deposit it references as `RequestAction` input, or the ledger
  rejects the submission as an invisible-input-contract error. Recipient-owned deposits
  created by `Debit` get `delegates = []` automatically.
- Delegation pattern: `RequestAction` controller = agent, signatory = principal → choice
  body carries both authorities and atomically spends principal-owned `DemoDeposit`.
- Denial codes are SCREAMING_SNAKE_CASE machine-readable constants defined once in
  `Cation.Types`.
- Every new choice or rule branch needs a Daml Script test, including the negative case.
  Current suite: `daml/src/Cation/Tests.daml`, 17 tests, must stay green.

## Backend conventions

- Validate that the party in any submission matches the authenticated user.
- Handle state-cid contention: on archived-contract/contention errors, fetch latest
  `AgentMandateState` and retry once (`isContentionError` + retry wrapper, see
  `app/api/agent/chat/route.ts` and the approve route for the reference pattern).
- Error mapping: ledger denial codes → user-readable explanations (`lib/denials.ts`); never
  swallow the machine-readable code.
- Amounts travel as decimal strings end-to-end, never parsed to floating point for ledger
  submission.

## Workflow

- After any user correction, record the pattern here or in `plan.md`, not just in the
  moment's fix.
- Never mark a task done without proving it against the real ledger (a passing `daml test`
  is necessary but not sufficient — the Seaport-proxy integration bugs in this project were
  only caught by live HTTP testing against the actual devnet transport).
- Commits: concise messages; code/comments in normal professional style.
