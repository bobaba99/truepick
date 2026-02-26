# Project Progress

## Status Legend
- 🟢 Complete
- 🟡 In Progress
- 🔴 Blocked
- ⚪ Not Started

---

## Current Sprint
**Sprint:** MVP Stabilization + PRD Alignment  
**Dates:** 2026-02-03 — 2026-02-16  
**Goal:** Keep core web flows stable, align implementation/docs, and close the highest-risk product/security gaps before feature expansion.

---

## Overall Progress

| Phase | Status | Progress | Notes |
|-------|--------|----------|-------|
| Project Setup | 🟢 | 95% | Monorepo, Supabase schema/RLS, auth routing, seed flow in place |
| Core Backend | 🟡 | 65% | Supabase-first backend works; missing API hardening and analytics logging |
| Core Frontend | 🟡 | 75% | Auth, Dashboard, Profile, Swipe are functional |
| Feature Completion | 🟡 | 55% | Core loop done; sharing/resources/guest flow not done |
| Polish & QA | 🟡 | 35% | Linting improved; no full NFR validation yet |
| Deployment & Launch | ⚪ | 15% | No launch pipeline or launch readiness checklist yet |

---

## Completed Tasks

- [x] Rewrote core project docs to reflect actual implementation: `TECH_STACK.md`, `FRONTEND_GUIDELINES.md`, `BACKEND_GUIDELINES.md`.
- [x] Updated product docs with concrete content and tables: `PRD.md` and `APP_FLOW.md`.
- [x] Implemented and lint-fixed major web flows in `apps/web`: Dashboard, Swipe, Profile, verdict detail modal, filters, and kinematics-related issues.
- [x] Added verdict algorithm option `llm_only` across UI/service/types/modal and DB schema constraint in initial migration.
- [x] Improved auth compatibility in `supabase/seed.sql` by making seed user creation auth-backed and cleaning orphan profile rows.
- [x] Fixed Profile empty-state alignment so verdict empty card aligns with purchase history cards.
- [x] Implement purchase import from email route/page — **Branch:** `feat/purchase-email-import-flow`
- [x] Tighten verdict evaluation path robustness and UX messaging for LLM failure/timeout cases — **Branch:** `fix/verdict-llm-timeout-handling`

---

## In Progress

- [ ] Refine Profile and history UX polish after recent structural updates — **Branch:** `fix/profile-history-ux-polish`
- [ ] Mobile viewing adaptation `ui/mobile-adaptation`
- [ ] Implement settings route/page with language, theme, currency, etc. — **Branch:** `feat/settings-route-user-preferences`
- [ ] Implement share verdict capability (link/card) — **Branch:** `feat/verdict-share-capability`
- [ ] Implement swiping if alternative solution is selected and add branching logic to alternatives based on justification (budget or emotional alternative) `feat/alternative-solution`
- [ ] Implement behavioural responses telemetry and analytics — **Branch:** `feat/behavioral-telemetry-analytics`
- [ ] Implement user data deletion and data request `feat/account-data-request-deletion`
- [ ] Implement educational content route/page — **Branch:** `feat/resources-page`
- [ ] Implement SEO optimization for resources page — **Branch:** `feat/resources-page-seo-optimization`


---

## Blocked

- [ ] Guest verdict flow (PRD FR-001) — **Blocker:** Current app architecture enforces authenticated routes for verdict creation — **Status:** 🔴
- [ ] Secure OpenAI key handling — **Blocker:** LLM calls currently executed from frontend with env exposure risk — **Status:** 🔴

---

## Upcoming

- [ ] Move OpenAI verdict generation to backend/API layer and remove frontend key usage — **Priority:** High
- [ ] Implement guest verdict path with upgrade prompt after repeated usage — **Priority:** High
- [ ] Add confidence indicator in verdict cards/modal from stored `confidence_score` — **Priority:** High
- [ ] Implement `purchase_stats` aggregation population and surface segmented regret insights — **Priority:** High
- [ ] Implement share verdict capability (link/card) — **Priority:** Medium
- [ ] Build initial Resources route/page with verdict CTA — **Priority:** Medium
- [ ] Add justification-length guidance flow in Dashboard (`<10` and `>100` words) — **Priority:** Medium
- [ ] Add SEO baseline: OG tags, metadata hygiene, and route-level metadata plan — **Priority:** Medium

---

## Change Log

| Date | Change | Reason | Impact |
|------|--------|--------|--------|
| 2026-02-09 | Added `llm_only` verdict algorithm mode | Support LLM-direct recommendation mode without score computation | New product option in Dashboard and persisted scoring model |
| 2026-02-09 | Consolidated scoring model constraint into initial schema migration | Keep one source of truth for local reset flow | Simplifies migration chain for new environments |
| 2026-02-09 | Updated seed strategy to require auth-backed user | Prevent signup conflict and manual DB cleanup | Smoother local auth/signup testing |
| 2026-02-09 | Updated APP_FLOW/PRD implementation detail coverage | Improve delivery visibility and planning accuracy | Clearer done/partial/not-yet tracking |

---

## Notes & Decisions
- Current MVP strengths: authenticated purchase-verdict loop, swipe feedback loop, profile-driven personalization, history CRUD.
- Highest-risk gap: frontend LLM key exposure and missing guest flow relative to PRD acquisition strategy.
- `purchase_stats` table exists in schema but app still derives headline stats mostly from `swipes`; aggregation job remains pending.
- `Resources` and sharing flows remain expansion items and should be scheduled after security and core funnel alignment.
