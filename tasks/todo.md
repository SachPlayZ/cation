# Todo

## Plan

- [x] Audit current brand tokens, routes, interaction states, and information architecture.
- [x] Define a single trust-first product design system: typography, color, spacing, shapes, focus, motion, and responsive rules.
- [x] Redesign login and authenticated shell without changing routes, auth, or role behavior.
- [x] Redesign CFO, agent, compliance, and recipient views end to end.
- [x] Add complete accessible loading, empty, error, destructive-confirmation, and action-feedback states.
- [x] Run anti-slop pre-flight and visible-copy audit.

## Verification

- [x] Run web typecheck.
- [x] Run production build.
- [x] Visually inspect all routes at desktop and mobile sizes.
- [x] Check keyboard focus, reduced motion, contrast, overflow, and responsive collapse.
- [x] Inspect final UI diff; verify endpoint shapes, decimal submission strings, routes, and role behavior remain intact.

## Likely Files

- `apps/web/app/globals.css`
- `apps/web/app/layout.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/(app)/layout.tsx`
- `apps/web/app/(app)/dashboard/page.tsx`
- `apps/web/app/(app)/agent/page.tsx`
- `apps/web/app/(app)/compliance/page.tsx`
- `apps/web/app/(app)/recipient/page.tsx`
- `apps/web/components/Toast.tsx`
- `apps/web/components/api.ts`
- `apps/web/components/ui.tsx`
- `apps/web/tailwind.config.ts`
- `apps/web/package.json`

## Questions

- None.

## OG Image

- [x] Inspect logo, project positioning, and metadata.
- [x] Generate and finish a 1200×630 branded image.
- [x] Wire Open Graph and Twitter metadata.
- [x] Verify dimensions, typecheck, build, and diff.

## README

- [x] Review project docs, source, assets, and reference README patterns.
- [x] Write a concise, comprehensive root `README.md` with setup, architecture, usage, and security notes.
- [x] Verify commands, links, Markdown structure, and final diff.

## Review

### Changed

- Added branded OG image and social metadata.
- Added root `README.md`: overview, architecture, privacy and contract model, setup, demo, commands, and repository map.
- Rebuilt all frontend surfaces around a graphite and signal-red product system with Geist typography and Phosphor icons.
- Redesigned login, app shell, CFO controls, agent console, compliance, and recipient views for desktop and mobile.
- Added persistent fetch failures, retry paths, accessible dialogs/toasts/forms, reduced-motion handling, and honest empty/loading states.
- Fixed the mandate form's stale `treasury-reserve` default to canonical `reserve-account`.

### Verified

- OG/Twitter tags rendered; 1200×630 PNG; typecheck and build pass.
- Web and agent TypeScript checks pass.
- Daml build passes; all 17 Script declarations pass.
- README paths, links, commands, and whitespace checked.
- Frontend typecheck and production build pass.
- Browser-checked all five routes; desktop/mobile layouts have no horizontal overflow or console errors.
- Anti-slop source check passes: no visible em dashes, dot-grid, `h-screen`, decorative status dots, or scroll listeners.

### Risks

- Production URL relies on Vercel URL env or optional `NEXT_PUBLIC_SITE_URL`.
- Daml build emits the existing non-failing `daml-script` package dependency warning.
- Approval result matching remains a backend concern outside this frontend redesign.

### Follow-ups

- None for README.
