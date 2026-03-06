# Project Progress

## Status Legend
- 🟢 Complete
- 🟡 In Progress
- 🔴 Blocked
- ⚪ Not Started

---

## Current Sprint
**Sprint:** Freemium Launch Readiness
**Dates:** 2026-03-04 — ongoing
**Goal:** Enforce daily verdict cap for free users, add PaywallModal with waitlist CTA, anonymous auth for guest verdict flow, wire Tier 1 PostHog behavioural telemetry.

---

## Overall Progress

| Phase | Status | Progress | Notes |
|-------|--------|----------|-------|
| Project Setup | 🟢 | 95% | Monorepo, Supabase schema/RLS, auth routing, seed flow in place |
| Core Backend | 🟡 | 75% | API hardened; daily limit middleware + waitlist endpoint added |
| Core Frontend | 🟡 | 85% | Anonymous auth, paywall modal, account conversion done |
| Feature Completion | 🟡 | 70% | Core loop done; sharing done; freemium gate done |
| Polish & QA | 🟡 | 35% | PaywallModal CSS stub missing; no full NFR validation yet |
| Deployment & Launch | ⚪ | 15% | No launch pipeline or launch readiness checklist yet |

---

## Completed Tasks

- [x] Rewrote core project docs to reflect actual implementation: `TECH_STACK.md`, `FRONTEND_GUIDELINES.md`, `BACKEND_GUIDELINES.md`.
- [x] Updated product docs with concrete content and tables: `PRD.md` and `APP_FLOW.md`.
- [x] Updated `PRD.md`, `APP_FLOW.md` to reflect `feat/daily-limit` implementation (anonymous auth flow §3.0, daily cap enforcement §4.1, state table §6, API proxy architecture §7)
- [x] Implemented and lint-fixed major web flows in `apps/web`: Dashboard, Swipe, Profile, verdict detail modal, filters, and kinematics-related issues.
- [x] Added verdict algorithm option `llm_only` across UI/service/types/modal and DB schema constraint in initial migration.
- [x] Improved auth compatibility in `supabase/seed.sql` by making seed user creation auth-backed and cleaning orphan profile rows.
- [x] Fixed Profile empty-state alignment so verdict empty card aligns with purchase history cards.
- [x] Implement purchase import from email route/page — **Branch:** `feat/purchase-email-import-flow`
- [x] Tighten verdict evaluation path robustness and UX messaging for LLM failure/timeout cases — **Branch:** `fix/verdict-llm-timeout-handling`
- [x] Mobile viewing adaptation (swipeable queue cards, touch gestures, responsive layout) — **Branch:** `ui/mobile-adaptation`
- [x] Trimmed canonical docs: removed ~880 lines of redundant content from PRD.md, FRONTEND_GUIDELINES.md, APP_FLOW.md
- [x] Populated CLAUDE.md with project intelligence (architecture, patterns, gotchas, commands)
- [x] Integrated freemium tier model into APP_FLOW.md and README.md from `freemium_features.md`
- [x] Implement share verdict capability (image export to social media) — **Branch:** `feat/verdict-share-capability`
- [x] Settings route with theme, locale, currency, hold duration — **Branch:** `feat/settings-route-user-preferences`
- [x] Install PostHog alongside GA4 with autocapture, session replay, feature flags — **Branch:** `feat/posthog-analytics`
- [x] **Daily limit enforcement + Paywall + Anonymous Auth + Tier 1 telemetry** — **Branch:** `feat/daily-limit`
  - DB: `tier` column on `users`, `waitlist` table
  - API: `checkDailyVerdictLimit` middleware (429 `daily_limit_reached`), `/api/waitlist` endpoint
  - Analytics: `trackVerdictRequested`, `trackVerdictDelivered`, `trackVerdictOverride`, `trackPaywallHit`, `trackPaywallConversionStarted`, `trackShareCardGenerated`; `is_anonymous` on PostHog identify; `bucketPrice` exported
  - `VerdictRow` type: `confidence_score` field added (DB column already existed)
  - App: `signInAnonymously` on first visit; `updateUser` for anonymous → permanent conversion; "Guest" header display
  - `PaywallModal` component with waitlist form and anonymous sign-up CTA
  - Dashboard: paywall modal wired, `verdict_override` event, `verdict_delivered` event
  - Profile: `verdict_override` event mirrored
  - VerdictShareModal: `share_card_generated` event
- [x] PaywallModal CSS — add styles for `.paywall-modal*` classes — **Branch:** `feat/paywall`
- [x] Add loading bar during evaluation/regeneration with generative loading words — **Branch:** `fix/[]`
- [x] Adapt for mobile web browser size and layout — **Branch:** `ui/mobile-adaptation`
- [x] Resend waitlist confirmation email — branded dark HTML email sent to user on signup; deduplication via `isDuplicate` flag — **Branch:** `feat/resend-waitlist`
- [x] Wire `verdicts_remaining` from API success response into Dashboard state and show counter UI — **Branch:** `feat/verdicts-remaining-counter`
- [x] Soft-delete verdicts — `deleted_at` column + migration; `deleteVerdict` now soft-deletes; daily limit count and history queries exclude soft-deleted rows — **Branch:** `feat/verdicts-remaining-counter`
- [x] Regeneration bypasses daily limit — `existingVerdictId` threaded from `handleVerdictRegenerate` through `evaluatePurchase` → `evaluateWithLlm` → request body; backend verifies ownership before skipping count — **Branch:** `feat/verdicts-remaining-counter`
- [x] Fluid typography system — replaced 40+ fixed `rem`/`px` font-size values with `clamp()`-based fluid sizes scaling 375px→1440px; removed redundant `@media(max-width:600px)` font-size overrides; added fluid rem anchor on `:root`; SI card classes left untouched — **Branch:** `ui/fluid-typography`
- [x] Mobile layout polish — Profile Verdicts button rows split into utility/decision/danger rows; Purchases and Resources cards use meta-chip pills instead of plain text; Swipe schedule queue moved below interaction; filter moved below heading with native `<select>` on mobile — **Branch:** `fix/mobile-layout-polish`

---

## In Progress

- [ ] Refine Profile and history UX polish after recent structural updates — **Branch:** `fix/profile-history-ux-polish`
- [ ] Implement user data deletion and data export (GDPR Art. 17, 20) — **Branch:** `feat/account-data-request-deletion`
- [ ] Implement SEO optimization for resources page (OG tags, metadata) — **Branch:** `feat/resources-page-seo-optimization`
- [ ] Refine prompt engineering `feat/refine-prompt`


---

## Blocked

_(none currently)_

---

## Upcoming

### Free Tier (Phase 1 — current)

- [ ] Add justification-length guidance flow in Dashboard (`<10` and `>100` words) — **Priority:** Medium
- [ ] Add warning modal if justification is too short — **Priority:** Medium
- [ ] Add confidence indicator in verdict cards/modal from stored `confidence_score` — **Priority:** Medium
- [ ] Implement `purchase_stats` aggregation population and surface segmented regret insights — **Priority:** High
- [ ] Add hold duration and email reminder for "hold" verdicts (4.5.5) — **Priority:** Medium
- [ ] Enable anonymous auth in Supabase dashboard: Authentication > Providers > Anonymous — **Priority:** High
- [ ] Wire real `user_tier` into `trackVerdictRequested` (currently hardcoded `'free'`) — **Priority:** Low
- [ ] Write content for About page — **Priority:** Low
- [ ] Write content for Support page — **Priority:** Low
- [ ] Community verdict stats ("85% of users who skipped were satisfied") — **Priority:** Low

### Premium Tier (Phase 2 — after web app traction)

- [ ] Premium tier billing/upgrade flow (Stripe or equivalent) — **Priority:** High
- [ ] Stripe webhook for `paywall_conversion_completed` PostHog event — **Priority:** High
- [ ] Unlimited verdicts with full rationale for premium users — **Priority:** High
- [ ] Chrome Extension: session awareness on e-commerce domains — **Priority:** Medium
- [ ] Chrome Extension: checkout interstitial friction with verdict routing — **Priority:** Medium
- [ ] Chrome Extension: opt-in website blocking (soft/hard modes) — **Priority:** Low

### Premium Analytics (Phase 3 — requires purchase history data)

- [ ] Weekly/monthly spending pattern reports with charts and trend lines — **Priority:** Medium
- [ ] Personalized LLM-generated spending insights (override rates, timing patterns) — **Priority:** Medium
- [ ] Ongoing email syncing with post-purchase satisfaction tracking (7/14/30-day check-ins) — **Priority:** Medium
- [ ] Conversational agent for querying purchase history (gated behind 10+ verdicts) — **Priority:** Low

---

## Change Log

| Date | Change | Reason | Impact |
|------|--------|--------|--------|
| 2026-03-05 | Mobile layout polish — Profile, Purchases, Resources, Swipe | Cards showed raw label:value text; buttons overflowed on mobile; swipe queue and filter were above the interaction | Meta-chip cards, clean button rows, and swipe UI reordered for natural mobile scroll flow |
| 2026-03-05 | Fluid typography — clamp()-based font sizes across all major text elements | Text felt too small on desktop and cramped on mobile; fluid scaling eliminates single-breakpoint jumps | Smooth text scaling 375px→1440px with no manual mobile overrides needed |
| 2026-03-05 | Soft-delete verdicts, regeneration limit bypass, verdicts remaining counter, Resend waitlist email | Prevent daily limit bypass via deletion; exempt regeneration; surface remaining count to user | Daily limit integrity enforced end-to-end; UX counter visible after first verdict |
| 2026-03-04 | Daily limit enforcement, PaywallModal, anonymous auth, Tier 1 PostHog telemetry | Freemium launch readiness — enforce 3/day cap, capture conversion funnel | Verdict gate live; 6 new PostHog events; guest users tracked |
| 2026-02-25 | Integrated freemium tier model into APP_FLOW.md, README.md, progress.md | Align docs with `freemium_features.md` product strategy | State transitions, verdict flow, and roadmap now reflect free/premium split |
| 2026-02-25 | Trimmed ~880 lines from PRD.md, FRONTEND_GUIDELINES.md, APP_FLOW.md | Remove redundant content duplicating source code or backend docs | Leaner, more maintainable canonical docs |
| 2026-02-25 | Populated CLAUDE.md with project intelligence | Give AI assistants concrete project context | Faster onboarding, fewer repeated questions |
| 2026-02-09 | Added `llm_only` verdict algorithm mode | Support LLM-direct recommendation mode without score computation | New product option in Dashboard and persisted scoring model |
| 2026-02-09 | Consolidated scoring model constraint into initial schema migration | Keep one source of truth for local reset flow | Simplifies migration chain for new environments |
| 2026-02-09 | Updated seed strategy to require auth-backed user | Prevent signup conflict and manual DB cleanup | Smoother local auth/signup testing |

---

## Notes & Decisions
- Freemium model: free tier = 3 verdicts/day (enforced server-side). Anonymous users get the full verdict experience via `signInAnonymously`. Account conversion preserves user_id and verdict history.
- `user_tier` in `trackVerdictRequested` is hardcoded `'free'` until the API response includes real tier data.
- Highest-risk gap resolved: LLM calls now go through authenticated API proxy, not direct from frontend.
- `purchase_stats` table exists in schema but app still derives headline stats mostly from `swipes`; aggregation job remains pending.
- Chrome Extension and premium analytics are Phase 2/3 — not started until free tier web app shows returning user growth.
