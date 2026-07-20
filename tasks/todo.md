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

## Landing Page

### Plan

- [x] Move the existing role gateway to `/login` without changing auth or wallet behavior.
- [x] Build a responsive public landing page at `/` using the existing graphite and signal-red system.
- [x] Generate and integrate original landing visuals.
- [x] Update unauthenticated and role-mismatch redirects to `/login`.
- [x] Run the anti-slop pre-flight and visible-copy audit.

### Verification

- [x] Run web typecheck and production build.
- [x] Browser-check landing and login at desktop and mobile sizes.
- [x] Check reduced motion, keyboard focus, contrast, overflow, image loading, and route behavior.
- [x] Inspect the final diff for unrelated changes.

### Likely Files

- `apps/web/app/page.tsx`
- `apps/web/app/login/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/app/(app)/layout.tsx`
- `apps/web/components/api.ts`
- `apps/web/public/landing-*.png`

### Questions

- None.

### Review

#### Changed

- Added a public, responsive landing page with original authority and privacy imagery.
- Preserved the existing role gateway at `/login` and redirected unauthenticated sessions there.

#### Verified

- Typecheck and production build pass.
- Desktop and mobile browser checks pass with no overflow, broken images, or console errors.
- Landing pre-flight passes for theme, accent, shape, copy, motion, focus CSS, and reduced motion.

#### Risks

- None identified.

#### Follow-ups

- None.

## Hero Background Correction

### Plan

- [x] Reinspect reference frames for layout hierarchy.
- [x] Move gate video from side card to full-bleed hero background.
- [x] Verify full-viewport playback, readability, responsive crop, and reduced-motion fallback.

### Verification

- [x] Run typecheck and production build.
- [x] Browser-check desktop and mobile hero composition and playback.

### Likely Files

- `apps/web/app/page.tsx`
- `apps/web/app/globals.css`
- `tasks/lessons.md`

### Questions

- None.

### Review

#### Changed

- Moved looping gate video behind entire hero, navigation, and copy.
- Added full-bleed crop plus desktop/mobile readability scrims.

#### Verified

- Typecheck and production build pass.
- Desktop and mobile video autoplay, loop, fill viewport, and create no overflow.
- Reduced-motion CSS hides video while retaining poster image.

#### Risks

- Browser screenshot can show video-frame tearing during capture; live playback remains smooth.

#### Follow-ups

- None.

## Design System Image

### Plan

- [x] Inspect reference, current app tokens, logo, and product positioning.
- [ ] Generate one reference-format Cation design-system overview image.

### Verification

- [ ] Confirm image output is obtained and visually readable.

### Likely Files

- None.

## Landing Motion

### Plan

- [x] Add GSAP and its React integration.
- [x] Add scoped landing-page motion with ScrollTrigger cleanup.
- [x] Add subtle image scale/fade, scrubbed text, accordion, and marquee behavior.
- [x] Preserve mobile layout and reduced-motion behavior.

### Verification

- [x] Run typecheck and production build.
- [x] Browser-check motion at desktop and mobile sizes.
- [x] Verify ScrollTriggers, cleanup, reduced motion, overflow, and console output.

### Likely Files

- `apps/web/app/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/components/LandingMotion.tsx`
- `apps/web/package.json`
- `package-lock.json`

### Questions

- None.

### Review

#### Changed

- Added scoped GSAP entrances, scroll reveals, scrubbed word opacity, image scale/fade, metric motion, accordion hover, and a slow proof marquee.
- Added explicit reduced-motion handling and ScrollTrigger teardown.

#### Verified

- Typecheck and production build pass.
- Scroll-state inspection proves progressive word reveal and image entry, peak, and exit values.
- Desktop and mobile previews have no overflow, broken images, or console errors.

#### Risks

- The landing route adds about 45 kB of client JavaScript for GSAP.

#### Follow-ups

- None.

## Hero Gate Video

### Plan

- [x] Analyze the supplied motion reference and current hero composition.
- [x] Render a seamless five-second ray animation from the existing gate artwork.
- [x] Integrate the looping background video with poster and reduced-motion fallback.

### Verification

- [x] Inspect representative frames and loop continuity.
- [x] Run typecheck and production build.
- [x] Browser-check playback, fallback, overflow, and console output on desktop and mobile.

### Likely Files

- `apps/web/app/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/public/landing/authority-gate-loop.mp4`

### Questions

- None.

### Review

#### Changed

- Added a five-second H.264 hero loop with perspective-aligned red light packets flowing into the gate.
- Added autoplay, muted, inline playback with poster and reduced-motion fallbacks.

#### Verified

- Representative frames and the loop seam were visually inspected.
- Typecheck and production build pass.
- Desktop and mobile autoplay work with no overflow or console errors; desktop playback visibly wrapped.

#### Risks

- Browsers blocking autoplay show the still poster.

#### Follow-ups

- None.
