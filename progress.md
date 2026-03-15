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
| Feature Completion | 🟡 | 90% | Core loop, sharing, hold reminders, freemium gate, verdict feedback done; remaining items are nice-to-haves |
| Polish & QA | 🟡 | 75% | Legal content, UI animation polish (6 phases) complete; Profile UX polish in progress |
| Deployment & Launch | ⚪ | 15% | No launch pipeline or launch readiness checklist yet |

---

## In Progress

- [ ] Refine Profile and history UX polish after recent structural updates — **Branch:** `fix/profile-history-ux-polish`
- [x] Fix OAuth & guest sign-in failures (Google, Apple, anonymous) — **Branch:** `main`
- [x] Codebase modularization — critical/high/medium priority refactoring — **Branch:** `refactor/modularize-codebase`

---

## MVP Launch Board

### 1. Go / No-Go (must complete before launch)

- [x] Enable anonymous auth in Supabase dashboard: Authentication > Providers > Anonymous
  Why: The guest verdict flow depends on `signInAnonymously`; without this toggle, first-visit onboarding is broken. (5 min, zero code)
- [x] Google OAuth
- [x] Apple OAuth [for generation JWT from .p8 file](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- [x] Onboarding tutorial `feat/onboarding-tutorial`
- [x] Landing / home page with product explanation, psychology stats, premium waitlist — **Branch:** `feat/posthog-behavioural-telemetry`
- [x] Replace Privacy Policy boilerplate with real content — `Privacy.tsx` lines 37, 48, 51
  Why: Legal requirement per PRD 5.2; needed for OAuth verification and user trust.
- [x] Replace Terms of Service boilerplate with real content — `Terms.tsx` line 43
  Why: Legal requirement per PRD 5.2; liability coverage.
- [ ] Complete Profile and history UX polish — **Branch:** `fix/profile-history-ux-polish`
  Why: Core user-facing screen; rough UX harms first impressions and retention. Already in progress.
- [ ] 10 articles in Resources for TruePick, putting the SEO and web search indexes as early as possible
  - [x] Markdown seed pipeline: `content/resources/*.md` + `temp/seed-resources.ts` + `npm run seed:resources` — parses frontmatter, converts MD→HTML via `marked`, upserts to Supabase `resources` table on slug conflict. Dry-run mode available. 1 sample article included.
- [x] Premium demo on Premium page
- [ ] Polish verdict quality, to make it more acceptable and people are willing to sign up
- [x] Add verdict feedback (i.e., thumbs up and down) in the verdict cards
- [x] Fix Profile verdict and purchase UI layout
  Why: Card layouts, spacing, and responsiveness need polish to match the quality bar set by Landing/Premium pages. Visual inconsistencies hurt perceived product quality.
- [x] Mass uploading workflow for resource articles — implemented as `npm run seed:resources` (markdown-to-Supabase pipeline)

### 1b. Immediately After Launch (test on production)

- [ ] Test Apple OAuth on production — cannot be tested locally (requires HTTPS + registered domain). Verify: sign-in works, identity linking toast shows when same email used with Google, provider badges display on auth card.
- [ ] Test Google + Apple same-email identity linking — sign in with Google, then Apple with same email, confirm both providers show as linked and user data is preserved.

### 2. Nice-to-Have (ship without; add in weeks 1-2 post-launch)

- [ ] Cute mascot to keep user engaged
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
- [ ] Finalize Premium page content with real feature details, pricing, and launch timeline — **Priority:** Low
  Why: Current content is sourced from PRD/freemium_features.md; refine copy and visuals once premium features are closer to implementation.

### 3. Deferred Post-Launch

- [ ] Implement user data deletion and data export (GDPR Art. 17, 20)
  Why deferred: GDPR requires honoring requests within 30 days, not a self-service UI. FAQ documents the manual email process. Standard for early-stage solo dev.
- [ ] Implement `purchase_stats` aggregation and surface segmented regret insights
  Why deferred: Requires critical mass of swipe data. Zero users = empty charts.
- [ ] Add community/social-proof verdict stats
  Why deferred: Requires hundreds of verdicts to be statistically meaningful.
- [x] Google OAuth sign-in — completed 2026-03-11
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
| 2026-03-15 | Markdown seed pipeline for resource articles | Need to author 10 articles locally in git-tracked markdown and bulk-publish to Supabase without using the admin UI one-by-one | `content/resources/` directory with YAML frontmatter template; `temp/seed-resources.ts` script (gray-matter + marked); `npm run seed:resources` and `seed:resources:dry` commands; idempotent upsert on slug; 1 sample article included |
| 2026-03-13 | UI Animation Polish — 6-phase scroll/entrance animations across all pages | Static content felt flat; no progressive reveals, no premium feel | Landing/Premium hero cascades, scroll-triggered card staggers, $3.4K/90%/44% counter animations, SplitText word reveals, modal exit animations (5 modals), Dashboard verdict stagger, Profile tab fade, HowItWorks ScrollReveal. All respect `prefers-reduced-motion`. Tuning guide at `docs/ui-animation-tuning-guide.md` |
| 2026-03-13 | Verdict feedback (thumbs up/down) + daily limit fix + GuestPromptModal | Users had no way to signal verdict quality; heuristic fallback verdicts incorrectly counted toward daily limit; anonymous users could navigate to profile without prompt | Feedback buttons on Dashboard/VerdictsTab/VerdictDetailModal with `verdict_feedback` column and analytics event; `heuristic_fallback` excluded from daily count (server + client); GuestPromptModal intercepts guest navigation to gated views |
| 2026-03-13 | Replace legal page boilerplate with real content from legal docs | Privacy and Terms pages had placeholder (Boilerplate) text; legal requirement per PRD 5.2 | Privacy.tsx: data retention, cookie policy (3 categories), CCPA disclosures, enriched data types/processors/legal basis, children's privacy. Terms.tsx: Quebec/Canada governing law, service description, subscription/payment, AI limitations, liability caps, entire agreement, physical address. Sourced from legal_docs/*.docx |
| 2026-03-11 | Codebase modularization — split monolithic files into focused modules | App.css (5,833 lines), Profile.tsx (2,084 lines), API index.ts (1,185 lines) exceeded maintainability limits | CSS split into 6 domain files; Profile split into 4 tab components + constants; API split into 12 files (routes/middleware/emails) with factory DI; auth middleware deduplicated; Dashboard constants extracted. All builds pass, zero behavior changes |
| 2026-03-11 | Fix OAuth & guest sign-in failures | `handle_new_user()` trigger failed on NULL email (anon/Apple) and UNIQUE(email) conflict (returning Google users with new auth UUID); captcha blocked anonymous sign-in; nav bar didn't show app links for guests | Google, Apple, and guest sign-in all working; guest Profile shows sign-up CTA; nav shows app links for all sessions |
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
- **Apple OAuth client secret JWT expires 2026-09-01** — regenerate from `.p8` key before then. Apple secrets are max 6 months.
- Apple OAuth does not work on localhost — requires HTTPS + registered domain. Test only on hosted Supabase project after deployment.

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
- [x] Premium features page — public `/premium` page with Chrome extension features, unlimited verdicts, analytics/intelligence section, free vs premium comparison table, and waitlist signup — **Branch:** `feat/premium-page`
- [x] Anonymous nav links — Home, How It Works, Premium links visible for non-logged-in users; `isSignedIn` variable extracted for cleaner session-aware rendering — **Branch:** `feat/posthog-behavioural-telemetry`
- [x] Fixed nav bar visibility on landing and premium pages — disabled auto-hide scroll behavior on marketing pages — **Branch:** `fix/landing-nav-visible`
- [x] **Codebase modularization** — **Branch:** `refactor/modularize-codebase`
  - CSS: App.css 5,833 → 7 lines (6 `@import`s): tokens.css, layout.css, auth.css, components.css, modals.css, responsive.css
  - Web: Profile.tsx 2,084 → 1,546 lines: ProfileTabContent, VerdictsTab, PurchasesTab, SettingsTab components + profileConstants.ts
  - Web: Dashboard.tsx 868 → 835 lines: dashboardConstants.ts (DAILY_LIMIT, countWords, formatCountdown, outcomeLabel)
  - API: index.ts 1,185 → 106 lines: 5 route modules (admin, verdict, waitlist, holdReminders, openai), 3 middleware (auth, rateLimit, dailyLimit), 2 email templates, shared types
  - API: auth middleware deduplicated — extractBearerToken + validateSupabaseConfig shared helpers
  - Remaining low-priority items tracked in DEBT.md
- [x] Replace Privacy + Terms boilerplate with real legal content — Privacy.tsx: data retention periods, cookie policy (3 categories with specific cookie names), CCPA disclosures, enriched data types/legal basis/processors, children's privacy. Terms.tsx: Quebec/Canada governing law, service description, subscription/payment, AI limitations, liability caps (12-month or CAD $100), entire agreement clause, Resila physical address. All content sourced from `legal_docs/*.docx` — **Branch:** `feat/legal-content-replace`
- [x] Fix OAuth & guest sign-in — 2 new migrations (`handle_new_user()` NULL email skip + UNIQUE email conflict handler), `OAuthRedirector` component for programmatic post-OAuth navigation, nav bar shows app links for all sessions (not just signed-in), guest Profile CTA card replaces error message — **Branch:** `main`
- [x] **UI Animation Polish** — 6-phase scroll and entrance animations for premium feel — **Branch:** `feat/ui-animation-polish`
  - Phase 0: Foundation — `prefersReducedMotion()`, `useScrollReveal`, `ScrollReveal`, `useStaggerReveal`, `useCountUp`, `useModalAnimation` hooks in Kinematics.tsx. GSAP migrated from CDN to npm. Global CSS reduced-motion safety net.
  - Phase 1: Landing page — hero cascading entrance (40% faster delays on mobile ≤600px), How It Works card stagger, $3,400/90%/44% counter animations, SplitText section titles, ScrollReveal on waitlist + footer CTA
  - Phase 2: Premium page — hero entrance, 3 feature card grids with independent stagger refs, SplitText titles, ScrollReveal comparison table + waitlist
  - Phase 3: Modal exit animations — `useModalAnimation` applied to PaywallModal, VerdictDetailModal, VerdictShareModal, GuestPromptModal, EvaluatingModal (200ms exit: backdrop fade + content slide/scale)
  - Phase 4: Dashboard — verdict card stagger on data load (0.08s interval), form section fade-in on mount
  - Phase 5: Profile tab transitions — CSS `@keyframes tabFadeIn` with `key={activeTab}` remount trigger
  - Phase 6: HowItWorks — ScrollReveal + SplitText wrappers
  - All animations respect `prefers-reduced-motion` (JS early returns + CSS overrides)
  - Tuning guide: `docs/ui-animation-tuning-guide.md`
- [x] **Verdict feedback (thumbs up/down)** — `verdict_feedback` column (smallint, 1/-1) on `verdicts` table, `updateVerdictFeedback` service with optimistic UI, `trackVerdictFeedback` analytics event. Circular feedback buttons (inline SVG) added to Dashboard, VerdictsTab, VerdictDetailModal. Glass-token styling with green/red active states. Responsive sizing at all breakpoints — **Commit:** `2a29134`
- [x] **Daily limit fix** — exclude `heuristic_fallback` verdicts from daily count in API middleware (`dailyLimit.ts`) and align client-side count in Dashboard/Profile to match server filter — **Commit:** `2a29134`
- [x] **GuestPromptModal** — intercepts "More"/"View all verdicts" clicks for anonymous users with "Create account" / "Stay as guest" actions. Glassmorphism styling with slideUp animation. Separate component extracted in `9a09889`; API middleware also excludes fallback from daily limit — **Commits:** `2a29134`, `9a09889`
