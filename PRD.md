# Product Requirements Document (PRD)

## 1. Overview

Last Updated: 2026-02-20

TruePick is not a budgeting app, not a no-buy tool, not a review aggregator. It is a purchase decision therapist, it intervenes at the moment of deliberation, processes your reasoning, identifies whether the motivation is rational or emotional, and routes you to the appropriate resolution path.

---

## 2. Problem Statement

Helps 18-40 year old North American adults make better purchase decisions to reduce regret and increase satisfaction. The app intervenes at the moment of deliberation, processes reasoning, identifies whether motivation is rational or emotional, and routes to the appropriate resolution path.

**Key market signals:** ~$3,400/year spent on impulse buys per person, 90% of Gen Z/Millennials impulse buy, 44% of Americans considering no-buy challenges (2025). No existing app delivers personalized, AI-powered buy/skip verdicts at point of purchase.

### 2.1 Competitors

| Competitor | What they do | Gap vs TruePick |
|-----------|-------------|-----------------|
| Stop Impulse Buying (SIB) | Generic reflective questionnaire, no-spend tracker | No AI, no personalization, no values-based analysis |
| SpendPause | AI photo analysis for need vs want | No personality-driven personalization, minimal traction |
| Cleo AI | AI budgeting/savings with personality | Retrospective, not point-of-purchase |

---

## 3. Goals & Success Metrics

| Domain | Goal | Metric | Target (First 6 Months) |
|--------|------|--------|--------------------------|
| Engagement | Users find value in verdicts and return | DAU/MAU ratio | 8-12% (consumer finance app median ~10%) |
| Engagement | Users complete the core action | Verdict completion rate (% of sessions with a verdict requested) | 60-70% |
| Engagement | Users return after first visit | D7 retention | 8-12% (finance app D7 avg ~10%; D30 drops to 4-5%) |
| Engagement | Users build profiles for personalization | Optional profile completion rate | 15-25% of verdict users |
| Acquisition | Organic search drives traffic | Monthly organic sessions (from SEO-indexed verdicts + blog) | 500-2,000 by month 6 |
| Acquisition | Social sharing generates referrals | Verdict share rate (% of verdicts shared) | 3-5% |
| Conversion | Web users convert to iOS app | Web-to-App Store click-through rate | 2-5% of web visitors |
| Conversion | Free users convert to premium (iOS) | Freemium conversion rate | 2-4% (consumer finance app median ~3%) |
| Performance | Fast, frictionless verdict experience | Largest Contentful Paint (LCP) | < 2.5s |
| Performance | Verdict loads quickly | Time from submit to verdict displayed | < 3s (LLM API latency dependent) |
| Performance | App is reliable | Uptime | 99.5% |
| Business | Revenue generation begins | Monthly Recurring Revenue (MRR) | $200-$1,000 by month 6 (assuming $4.99/mo premium, 40-200 subscribers) |
| Business | Acquisition is efficient | Customer Acquisition Cost (CAC) | < $5 organic; < $15 paid (if applicable) |
| Business | Unit economics are viable | LTV:CAC ratio | > 3:1 (target; measurable only after ~6 months of data) |
| User Satisfaction | Users trust and value verdicts | Verdict accuracy (user-reported: "was the verdict helpful?") | 65-75% positive |
| User Satisfaction | Users don't feel judged | NPS (once sufficient user base) | > 30 (above average for fintech apps) |
| Data | Build future training dataset | Structured verdicts logged with full schema | 100% of verdicts captured with inputs, outputs, and follow-up outcome field |
| Data | Users report purchase outcomes | Follow-up completion rate (did user report regret/satisfaction?) | 10-15% of verdicts |

---

## 4. Target Users & Personas

### 4.1 Primary Users

Primary users are North American adults aged 18-40 (primarily Gen Z and Millennials) who experience frequent impulse spending and post-purchase regret, are already comfortable using mobile finance/wellness apps, and are motivated by self-control and value alignment rather than strict budgeting.

The pathological or clinical level of shopping addiction is not included. This is NOT a therapy tool and addiction cannot be targeted by a simple web app alone.

**Core segments**
- **Emotion-triggered impulse buyers (18-34):** users who buy under stress, boredom, or emotional distress, then feel remorse within days; they want a fast pause-and-decide system at checkout.
- **High-ticket regret repeaters (22-40):** users who make fewer but larger impulse purchases (often electronics/fashion) and want confidence checks before spending $100-$1,000+.
- **No-buy / underconsumption adopters (18-35):** culturally motivated users doing no-buy challenges who need practical, personalized decision support to stay consistent.

**Shared motivations**
- Reduce annual regret spending (commonly cited around ~$3,400/year in impulse buys).
- Replace guilt and second-guessing with clear, personalized buy/hold/skip guidance.
- Build a repeatable “purchase intelligence” habit at the moment of purchase.
- Redirect spending toward purchases that better match personal values and long-term satisfaction.

### 4.2 Secondary Users

Secondary users are adjacent groups who may not identify as impulse spenders but still benefit from purchase-decision support, accountability, and clearer reasoning before discretionary spending.

**Core segments**
- **Early-career budget stabilizers (22-35):** users adapting to rent, debt, and rising living costs who want lightweight pre-purchase guardrails without adopting a full budgeting system.
- **Recovery-oriented spenders (18-40):** users rebuilding financial confidence after overspending, BNPL late payments, or card debt; they need low-friction interventions and clear progress signals.
- **Accountability pairs (partners/friends) (20-40):** users who co-manage spending decisions informally and want shared language for discussing “worth it vs. not worth it” purchases.
- **Behavioral self-improvement users (18-35):** users from no-buy, minimalism, and underconsumption communities who want evidence-based reinforcement, not just willpower challenges.

**Shared motivations**
- Reduce decision fatigue at purchase moments with a quick, structured second opinion.
- Build consistency in spending behavior without feeling restricted by rigid budgeting rules.
- Improve confidence on major but necessary purchases through transparent reasoning.
- Track behavior change over time (fewer regret purchases, better value alignment).

---

## 5. User Stories & Requirements

### 5.1 Functional Requirements

#### 5.1.1 Verdict Engine (Core)

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| FR-001 | As a visitor, I want to enter a product name, price, and my reason for buying so that I receive a buy/skip verdict without creating an account. | High | **Implemented.** Verdict form accepts product name (text, required), price (numeric, required), and reason (text, optional, max 280 chars). Submitting returns a verdict within 3 seconds. Visitors are silently signed in anonymously (`signInAnonymously`) on first visit — no account creation required. Free tier is capped at 3 verdicts/day; hitting the cap shows the PaywallModal. |
| FR-002 | As a visitor, I want to see the reasoning behind my verdict so that I understand why the app recommended buy or skip. | High | Verdict response displays: verdict label (Buy / Skip / Hold), a 2-4 sentence explanation referencing purchase quality signals (price-to-value, impulse indicators, necessity), and a confidence indicator (e.g., low/medium/high). |
| FR-003 | As a visitor, I want to receive a verdict that evaluates impulse indicators so that I can identify when I am making an emotionally driven purchase. | High | LLM system prompt includes heuristics for: time pressure language, emotional justification patterns, comparison to recent similar purchases (if profile exists), and financial impact ratio (price relative to stated income/budget if available). |
| FR-004 | As a visitor, I want to submit another verdict immediately after receiving one so that I can evaluate multiple purchases in a session. | Medium | After verdict display, a clear "Evaluate another purchase" CTA resets the form. No session limit on the web app MVP. |
| FR-005 | As a visitor, I want to see the verdict in a visually distinct format (not just plain text) so that the recommendation is immediately clear. | Medium | Verdict displays with color-coded indicator: green (Buy), red (Skip), amber (Hold/Wait). Typography and layout clearly differentiate the verdict from the reasoning. |

#### 5.1.2 User Profile & Personalization

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| FR-006 | As a visitor, I want to optionally complete a short values questionnaire so that my verdicts become personalized to what I care about. | High | Profile form presents 5 questions covering: spending priorities (e.g., durability vs. convenience vs. experience), financial goals, and impulse sensitivity self-assessment. Completable in under 2 minutes. Stored in local storage (no account required). |
| FR-007 | As a profiled user, I want my verdicts to reference my stated values so that recommendations feel personally relevant, not generic. | High | When profile data exists, verdict reasoning explicitly references user stated values (e.g., "You said you prioritize experiences over things - this does not align with that goal"). Verdicts without a profile use general purchase quality signals only. |
| FR-008 | As a visitor, I want to create an account (email or OAuth) so that my profile and verdict history persist across devices. | Medium | **Partially implemented.** Account creation via email/password. Anonymous sessions auto-created on first visit; signing up via the auth form converts the anonymous account to permanent using `updateUser()`, preserving all verdict history. Google OAuth not yet implemented. |
| FR-009 | As a returning user, I want my previous verdicts to inform future recommendations so that the app learns my patterns. | Medium | Backend stores verdict history per user. LLM prompt includes summary of past verdicts (categories, regret patterns) when generating new verdicts. Minimum 3 past verdicts before pattern-based personalization activates. |
| FR-010 | As a profiled user, I want to edit my values profile at any time so that changes in my priorities are reflected in future verdicts. | Low | Profile edit accessible from settings. Changes take effect on next verdict. Previous verdicts are not retroactively updated. |

#### 5.1.3 Sharing & Viral Loop

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| FR-011 | As a user, I want to share my verdict as a visually branded card on social media so that my followers can see and try TruePick. | High | **Implemented.** Share button on Dashboard cards, Profile verdict cards, and VerdictDetailModal opens a share modal. Modal generates two image variants: square (1080×1080, for Instagram) and wide (1200×630, for Twitter). Images include product name, outcome badge, score, 1-line rationale, and `gettruepick.com` watermark. Five selectable background themes (midnight, aurora, sunset, nebula, sunrise) with animated layers. Supports sharing to iMessage, Messenger, Instagram (download + toast), TikTok (download + toast), WhatsApp, X/Twitter, native Web Share API (mobile), copy link, and save image. |
| FR-012 | As a visitor arriving from a shared verdict link, I want to see the original verdict and immediately try my own so that the viral loop completes. | High | **Implemented.** Public route `/shared/:token` renders a summary-only landing page (product name, price, vendor, outcome badge, 1-line rationale) without detailed scores or full reasoning. Prominent "Get your own verdict" CTA links to `/auth`. View count incremented on each visit via `increment_share_view_count` RPC. Invalid/expired tokens show a not-found message with a "Get started" CTA. |
| FR-013 | As a user, I want to copy a direct link to my verdict result so that I can paste it in chats, forums, or messages. | Medium | **Implemented.** "Copy link" button in share modal copies `{origin}/shared/{token}` to clipboard. Existing tokens are reused when re-sharing the same verdict. `shared_verdicts` table stores a public snapshot (share_token, candidate fields, rationale_summary, view_count) with RLS: public SELECT, owner-only INSERT/UPDATE/DELETE. |

#### 5.1.4 Structured Data Logging

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| FR-014 | As a product owner, I need every verdict to be logged with structured data so that I can train a prediction model on real user data. | High | Each verdict record stores: unique ID, timestamp, product name, price, category (LLM-determined), user reason, profile data snapshot (if available), LLM verdict, LLM confidence, LLM reasoning, and a nullable outcome field for follow-up. |
| FR-015 | As a product owner, I need verdict records linked to user accounts (when available) so that I can track per-user patterns over time. | High | **Implemented.** All verdicts — including guest sessions — include a `user_id` via Supabase anonymous auth. When the user later converts to a permanent account, the `user_id` is preserved so no history is lost. |
| FR-016 | As a returning user, I want to report whether I bought the product and whether I regret it so that the app learns from my outcomes. | Medium | Follow-up prompt appears in verdict history after 7 days: "Did you buy [product]? How do you feel about it?" Stores: purchased (yes/no), outcome (satisfied/regret/neutral). Links to original verdict record. |
| FR-017 | As a product owner, I need all LLM API calls logged with input/output tokens and latency so that I can monitor costs and performance. | Medium | Each verdict logs: model used, input token count, output token count, API latency (ms), estimated cost. Accessible in admin dashboard. |

#### 5.1.5 Educational Content & SEO

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| FR-018 | As a visitor arriving from search, I want to read educational content about impulse buying and smart purchasing so that I understand the value TruePick offers. | High | Blog/resource section with SEO-optimized articles. Each article includes an embedded verdict tool CTA. Content covers: impulse buying psychology, the IQ-tax concept, purchase decision frameworks, category-specific regret data. |
| FR-019 | As a visitor searching "should I buy [product]", I want to land on a product-specific verdict page so that I can get an instant AI-powered recommendation. | High | Product verdict pages are indexed by search engines. Each page contains: product name, an interactive verdict form pre-filled with the product, and general purchase considerations for the category. Pages generated programmatically for trending/popular products. |
| FR-020 | As a product owner, I need all verdict pages and blog content to have proper meta tags, structured data, and OG images so that they rank and share well. | Medium | Every page includes: title tag, meta description, OG image, OG title/description, canonical URL, and JSON-LD structured data. Product verdict pages use FAQ schema. |

#### 5.1.6 Web-to-iOS Conversion Funnel

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| FR-021 | As a returning web user, I want to see a non-intrusive prompt to download the iOS app so that I am aware of the premium experience without being annoyed. | High | iOS CTA appears after 3rd verdict (not before). Displays: "Get personalized verdicts, spending reports, and more on the TruePick app." Dismissible. Does not reappear for 7 days after dismissal. Smart App Banner on iOS Safari. |
| FR-022 | As a web user who creates an account, I want my profile and verdict history to sync to the iOS app so that I do not start over. | High | Account data (profile, verdict history) is stored server-side. iOS app login with same credentials loads full history. No data loss during platform transition. |
| FR-023 | As a product owner, I need to track the full web-to-iOS funnel so that I can optimize conversion at each step. | Medium | Analytics tracks: unique visitors -> first verdict -> 3rd verdict -> profile created -> account created -> iOS CTA shown -> App Store click. Funnel visualization in admin dashboard. |


### 5.2 Non-Functional Requirements

**Performance**
- Verdict page LCP < 2.5s on mobile 4G; Lighthouse score >= 85
- Verdict submission to display < 3s (p95); fallback verdict within 8s if LLM fails
- INP < 200ms; CLS < 0.1; TTFB < 800ms

**Reliability**
- 99.5% uptime; LLM fallback activates within 5s of primary timeout

**Security**

- LLM API keys in env vars / secrets manager only, never in frontend bundle or git — **Implemented** (all LLM calls proxied through `apps/api`)
- Rate limiting: 20 requests/min per user via `rateLimitLLM` middleware; daily verdict cap of 3/day for free tier via `checkDailyVerdictLimit` middleware — **Implemented**
- Supabase handles encryption at rest, TLS, and auth (bcrypt/JWT)

**Compliance**
- GDPR/CCPA: data export within 72 hours, full deletion within 30 days
- Privacy policy and ToS published before launch

**Accessibility**
- WCAG 2.1 AA; responsive from 320px to desktop
- Keyboard-navigable verdict flow; screen reader compatible

**Scalability**
- LLM model swappable via config, no code deploy needed
- Schema supports future features without breaking changes

**Not yet implemented**
- CI/CD pipeline, error monitoring/alerting, structured data log completeness checks

---

## 6. MVP Scope

- **Quick profile quiz (optional):** lightweight values questionnaire (target: < 5 minutes, ~5 questions), stored locally for anonymous users and synced when account exists.
- **Quick verdict flow:** user submits product name, price, and one-line reason; system returns Buy/Skip/Hold verdict with reasoning without requiring login.
- **Verdict explanation UI:** verdict is presented with transparent rationale (price-to-value, impulse indicators, necessity) and confidence signal.
- **Optional account profile:** users can create an account to persist profile + verdict history across sessions/devices.
- **Optional swiping / follow-up outcomes (account users):** capture post-purchase outcomes (regret/satisfaction) to improve personalization over time.
- **Educational content section:** SEO-oriented blog/resources on impulse buying, decision frameworks, and purchase psychology with embedded verdict CTAs.
- **Result sharing:** generate shareable verdict cards/links for social platforms and messaging to support organic acquisition.
- **iOS app waitlist / conversion prompts:** non-intrusive web prompts and CTA surface for future iOS premium experience.

### 6.1 Free features

- Single decision verdict
- Establishing the user profile (i.e., values)
- Email API seeding with past 10 purchases (one-time)
- Educational content about impulse and regrets

### 6.2 Premium features

- Personalized LLM feature
  - Analyze spending patterns weekly/monthly, dividend report style, charts and short summaries
    - "$$$ money redirected to satisfied purchases in the past week."
  - Alternative solutions instead of making the purchase
- Ongoing email syncing with new purchases (make sure to merge with the verdict)
- Blocking apps from the shopping category + user selected apps if decided to hold for 15 minutes before making the purchase like the screentime apps


### 6.3 Future Features

- **Chat with verdicts**: users can chat with the verdict in the chat interface to get personalized advice on their purchases.

---

## 7. Assumptions & Constraints

### 7.1 Assumptions
<!-- What are we assuming to be true? -->

### 7.2 Constraints
<!-- Technical, budgetary, regulatory, timeline constraints -->

---

## 8. Dependencies

### External Services & APIs
- **Supabase (core backend):** Auth, Postgres, RLS, RPC functions, and data persistence used by `apps/web/src/api/*`.
- **OpenAI APIs:** Chat Completions API with GPT-4o-mini (verdict reasoning), Responses API with GPT-5-nano (email receipt parsing via `client.responses.parse()`), and Embeddings with text-embedding-3-small (semantic similarity in purchase context retrieval).
- **Google Gmail API:** OAuth 2.0 (standard) + REST API for fetching purchase receipts.
- **Microsoft Graph API (Outlook):** OAuth 2.0 with PKCE (S256 code challenge) for fetching purchase receipts.
- **CDN-hosted GSAP scripts:** runtime animation dependencies loaded from Cloudflare CDN for UI interaction components.

### Required Runtime Configuration
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_OPENAI_API_KEY`
- `VITE_GOOGLE_CLIENT_ID` (for Gmail OAuth)
- `VITE_MICROSOFT_CLIENT_ID` (for Outlook OAuth)

### Database & Data Dependencies
- Supabase schema and policies in `supabase/migrations/20260123050136_initial_schema.sql`.
- Vendor dataset migration in `supabase/migrations/20260129032546_vendor_data.sql`.
- Modular migrations in `supabase/migrations/20260214094217_modular_*.sql` (active bootstrap source of truth).
- RPCs expected by frontend services:
  - `add_purchase`
  - `add_user_value`
- Database trigger: `handle_new_user` fires on `auth.users` INSERT, auto-creates `public.users` row.
- Core tables used by web app:
  - `users`, `user_values`, `purchases`, `swipe_schedules`, `swipes`, `purchase_stats`, `verdicts`, `vendors`, `email_connections`, `email_processed_messages`, `email_vendors`, `hold_timers`, `ocr_jobs`, `resources`.

### Application/Platform Dependencies
- **Web client:** React + Vite runtime in `apps/web`.
- **Optional API scaffold:** `apps/api` Express server (`/health`) for future server-side expansion.
- **Local dev tooling:** Supabase CLI and npm workspaces for running migrations, seed data, and app services.

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Engagement paradox: successful users churn because they buy impulsively less often | High | High | Expand value beyond prevention: add purchase-quality optimization, outcome reflection, and longitudinal “money redirected” insights so the app stays useful after behavior improves. |
| Users will not pause pre-purchase to consult the app | Medium | High | Validate with interviews and funnel metrics; if weak, pivot interaction to lower-friction channels (browser extension trigger or post-purchase reflection workflow). |
| iOS blocking controls are bypassed or unreliable | High | Medium | Position the feature as a mindful pause (not hard enforcement), treat app-blocking as secondary differentiator, and prioritize verdict quality/personalization as core value. |
| Low trust in AI verdicts causes early churn | Medium | High | Show transparent reasoning for every verdict, support easy user override, and tune recommendations conservatively at low confidence levels. |
| Privacy backlash from receipt/email syncing | Low | Medium | Keep syncing optional, provide explicit consent controls, minimize retained data, and publish clear privacy terms aligned with CCPA/GDPR expectations. |
| SEO growth underperforms for “should I buy” intent pages | Medium | Medium | Pair SEO pages with interactive verdict tools, reinforce acquisition via social sharing/content loops, and iterate topics based on search + conversion data. |
| Freemium conversion remains below target (<2%) | Medium | High | Run pricing/paywall experiments (timing, monthly vs annual), optimize activation moments after repeated verdict usage, and test value-metric packaging. |
| LLM inference costs outpace early revenue | Medium | Medium | Route requests by complexity to cheaper models, cache common evaluation patterns, monitor token/latency per verdict, and enforce abuse controls/rate limits. |
