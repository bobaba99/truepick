# Project Progress

## Status Legend
- 🟢 Complete
- 🟡 In Progress
- 🔴 Blocked
- ⚪ Not Started

---

## Current Sprint
**Sprint:** Final Polish & Launch
**Dates:** 2026-03-07 — ongoing
**Goal:** Complete legal pages, enable anonymous auth, finish Profile UX polish, and ship soft launch.

---

## Overall Progress

| Phase | Status | Progress | Notes |
|-------|--------|----------|-------|
| Project Setup | 🟢 | 95% | Monorepo, Supabase schema/RLS, auth routing, seed flow in place |
| Core Backend | 🟢 | 90% | API proxy, waitlist email, hold reminder runner, daily limit — all in place |
| Core Frontend | 🟢 | 90% | Anonymous auth, paywall modal, account conversion, dashboard guidance, fluid typography done |
| Feature Completion | 🟡 | 85% | Core loop, sharing, hold reminders, freemium gate done; remaining items are nice-to-haves |
| Polish & QA | 🟡 | 50% | Legal pages need real content; Profile UX polish in progress |
| Deployment & Launch | ⚪ | 15% | No launch pipeline or launch readiness checklist yet |

---

## In Progress

- [ ] Refine Profile and history UX polish after recent structural updates — **Branch:** `fix/profile-history-ux-polish`
- [ ] PostHog behavioural telemetry — **Branch:** `feat/posthog-behavioural-telemetry`

---

## MVP Launch Board

### 1. Go / No-Go (must complete before launch)

- [x] Enable anonymous auth in Supabase dashboard: Authentication > Providers > Anonymous
  Why: The guest verdict flow depends on `signInAnonymously`; without this toggle, first-visit onboarding is broken. (5 min, zero code)
- [ ] Google OAuth
- [ ] Apple OAuth
- [x] Onboarding tutorial `feat/onboarding-tutorial`
- [x] Landing / home page with product explanation, psychology stats, premium waitlist — **Branch:** `feat/posthog-behavioural-telemetry`
- [ ] Replace Privacy Policy boilerplate with real content — `Privacy.tsx` lines 37, 48, 51
  Why: Legal requirement per PRD 5.2; needed for OAuth verification and user trust.
- [ ] Replace Terms of Service boilerplate with real content — `Terms.tsx` line 43
  Why: Legal requirement per PRD 5.2; liability coverage.
- [ ] Complete Profile and history UX polish — **Branch:** `fix/profile-history-ux-polish`
  Why: Core user-facing screen; rough UX harms first impressions and retention. Already in progress.

### 2. Nice-to-Have (ship without; add in weeks 1-2 post-launch)

- [ ] Add warning modal for short/long justification — **Priority:** Medium
  Why: Inline word-count guidance already nudges users; LLM handles short input. Not a blocker.
- [ ] Add confidence indicator in verdict cards/modal from stored `confidence_score` — **Priority:** Medium
  Why: Data is stored and tracked in PostHog. Purely a UI display enhancement.
- [ ] Implement SEO optimization for resources page (OG tags, metadata) — **Priority:** Medium
  Why: No organic search traffic on day 1; growth lever to activate in weeks 2-4.
- [ ] Write About page content — **Priority:** Low
  Why: Page exists with boilerplate. Users rarely visit About on first session.
- [ ] Write Support page content — **Priority:** Low
  Why: Page exists with FAQ link and Contact Us. Functional enough for soft launch.
- [ ] Wire real `user_tier` into `trackVerdictRequested` instead of hardcoded `'free'` — **Priority:** Low
  Why: Technically correct at launch since all users ARE free tier. Only matters when premium exists.
- [ ] Update landing page stats and product description with real/current data — **Priority:** Low
  Why: Current stats ($3,400/yr, 90%, 44%) are sourced from PRD; update with verified citations or real user data post-launch.

### 3. Deferred Post-Launch

- [ ] Implement user data deletion and data export (GDPR Art. 17, 20)
  Why deferred: GDPR requires honoring requests within 30 days, not a self-service UI. FAQ documents the manual email process. Standard for early-stage solo dev.
- [ ] Implement `purchase_stats` aggregation and surface segmented regret insights
  Why deferred: Requires critical mass of swipe data. Zero users = empty charts.
- [ ] Add community/social-proof verdict stats
  Why deferred: Requires hundreds of verdicts to be statistically meaningful.
- [ ] Google OAuth sign-in
  Why deferred: Email/password + anonymous auth covers launch. OAuth reduces friction at scale.
- [ ] CI/CD pipeline and error monitoring/alerting
  Why deferred: Deploy manually for soft launch. Set up when deployment cadence justifies it.
- [ ] Account management (email change, password change)
  Why deferred: Supabase forgot-password flow exists. Email change is rare at launch.
- [ ] Offline detection, session expiry handling, fallback verdict message
  Why deferred: LLM errors already handled with status banners. Resilience polish.
- [ ] Refine prompt engineering — **Branch:** `feat/refine-prompt`

### Premium Tier (Phase 2 — after web app traction)

- [ ] Premium tier billing/upgrade flow (Stripe or equivalent)
- [ ] Stripe webhook for `paywall_conversion_completed` PostHog event
- [ ] Unlimited verdicts with full rationale for premium users
- [ ] Chrome Extension: session awareness on e-commerce domains
- [ ] Chrome Extension: checkout interstitial friction with verdict routing
- [ ] Chrome Extension: opt-in website blocking (soft/hard modes)

### Premium Analytics (Phase 3 — requires purchase history data)

- [ ] Weekly/monthly spending pattern reports with charts and trend lines
- [ ] Personalized LLM-generated spending insights (override rates, timing patterns)
- [ ] Ongoing email syncing with post-purchase satisfaction tracking (7/14/30-day check-ins)
- [ ] Conversational agent for querying purchase history (gated behind 10+ verdicts)

---

## Change Log

| Date | Change | Reason | Impact |
|------|--------|--------|--------|
| 2026-03-09 | Landing page + routing restructure | No public-facing page explaining the product; `/` went straight to auth-gated Dashboard | `/` is now a public landing with hero, how-it-works, psychology stats, premium waitlist; Dashboard moved to `/dashboard`; brand logo links to landing; onboarding tutorial completed |
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
- `user_tier` in `trackVerdictRequested` is hardcoded `'free'` — technically correct at launch since all users are free tier; wire real value when premium exists.
- Highest-risk gap resolved: LLM calls now go through authenticated API proxy, not direct from frontend.
- GDPR self-service deletion deferred: FAQ documents the manual email process (contact within 30 days). Build automated UI when user volume justifies it.
- `purchase_stats` table exists in schema but is not populated — deferred until users generate enough swipe data to make insights meaningful.
- Chrome Extension and premium analytics are Phase 2/3 — not started until free tier web app shows returning user growth.

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
- [x] Dashboard justification guidance polish — restored `Brand` input, added `10-30 words` guidance, and animated rotating probing questions under the justification textarea — **Branch:** `feature/justification-length-guidance`
- [x] Hold reminder emails — added Resend-powered `/api/hold-reminders/run` scheduler endpoint to send due hold reminders and mark `hold_timers.notified` after delivery — **Branch:** `feat/hold-email-reminder`
- [x] Onboarding tutorial — 5-step modal wizard (Welcome, Verdicts, Quiz CTA, Email Import CTA, Privacy), localStorage completion tracking, slide transitions, accessible focus management, 5 analytics events — **Branch:** `feat/onboarding-tutorial`
- [x] Landing page — public home page at `/` with hero, 3-step "How It Works", psychology stats ($3,400/yr, 90% impulse, 44% no-buy), premium waitlist form (reuses `/api/waitlist`), footer CTA. Session-aware CTAs. Dashboard moved to `/dashboard`. Brand logo now links to landing. Responsive at all breakpoints — **Branch:** `feat/posthog-behavioural-telemetry`
- [x] Nav bar auth buttons — Sign In / Sign Up buttons visible for anonymous users with active-state highlighting, press animation, responsive layout — **Branch:** `feat/posthog-behavioural-telemetry`
