# Product Requirements Document (PRD)

## 1. Overview

Last Updated: 2026-02-20

Truepick is not a budgeting app, not a no-buy tool, not a review aggregator. It is a purchase decision therapist, it intervenes at the moment of deliberation, processes your reasoning, identifies whether the motivation is rational or emotional, and routes you to the appropriate resolution path.

---

## 2. Problem Statement
<!-- What problem does this product solve? Who experiences it? What is the impact? -->
This service helps clients to make purchases decisions to reduce future purchase regret and increase satisfaction. It aims to eliminate the cognitive work for the clients and generate informed reasoning process to facilitate financially healthy spendings. In some aspects, the reasoning provided may also reduce the guilt experienced with a major but necessary purchase through its reasonings.

The target clients are 18-40 years old North American adults with difficulties in impulse purchases. Over 70% of North American adults aged 18–40 experience purchase regret, collectively spending an estimated $3,400 per year on impulse buys. Cultural tailwinds are strong: the no-buy movement, underconsumption core, and de-influencing have gone mainstream, with 44% of Americans planning or considering a no-buy challenge in 2025. Yet the competitive landscape reveals a striking gap — virtually no app delivers a personalized, AI-powered buy/skip verdict at the moment of purchase.

Capital One Shopping data shows consumers averaged $282 per month ($3,381 annually) on impulse buys in 2024, with an average of 9.75 impulse purchases monthly at roughly $29 each.  Among Gen Z and Millennials specifically, a BadCredit.org survey of 1,002 consumers aged 18–43 found that 90.4% engage in impulse buying, with 40.8% citing emotional distress and 35.7% citing stress as primary triggers. Finder data shows that electronics purchases generate the highest per-item regret at $175.85 average, while apparel — where 77% experience remorse — averages $72 in regretted spending.

"no spend challenges" Google searches hit an all-time high in early 2025, up 40% year-over-year according to the Wall Street Journal. A Chime survey found 20% of Americans participated in a no-buy challenge in 2024, and an Intuit Credit Karma survey found 44% are doing or considering one in 2025. On TikTok, 94.4 million posts carry no-buy tags, while "underconsumption core" — which originated in summer 2024 — accumulated 44.9 million posts within months. The de-influencing hashtag has surpassed 233 million views. These movements reflect deeper economic pressures on young consumers: post-pandemic inflation, rising housing costs, and growing skepticism of influencer-driven consumption. The spread of buy-now-pay-later services has compounded the problem — 46% of Gen Z used BNPL in 2024 (up from 26% in 2023), and 42% of BNPL users made at least one late payment in 2025, suggesting a cycle of regret and overextension.

### 2.1 Competitors

Stop Impulse Buying (SIB), launched January 2024 by a husband-wife team in Washington state, offers a "Buy or Don't Buy" questionnaire that walks users through generic reflective
questions. It includes a no-spend challenge tracker and savings tracker but uses no AI, no personalization to user values or personality, and no app-blocking. It remains a small indie product with "thousands" of users.

SpendPause, a recently launched app, uses AI-powered photo analysis to classify purchases as "need vs. want" and includes alternative suggestions and a cooling-off period. It is the closest competitor to Truepick's vision but lacks personality-driven personalization, values-based analysis, and shopping app blocking. It appears to have minimal traction.

The biggest adjacent competitor, Cleo AI, validates that an AI-powered, personality-driven financial tool can achieve massive scale with young adults.
Users engage with Cleo 20x more than traditional banking apps. But Cleo is a budgeting and savings tool that operates retrospectively, not a point-of-purchase decision tool.

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
| FR-001 | As a visitor, I want to enter a product name, price, and my reason for buying so that I receive a buy/skip verdict without creating an account. | High | Verdict form accepts product name (text, required), price (numeric, required), and reason (text, optional, max 280 chars). Submitting returns a verdict within 3 seconds. No login required. |
| FR-002 | As a visitor, I want to see the reasoning behind my verdict so that I understand why the app recommended buy or skip. | High | Verdict response displays: verdict label (Buy / Skip / Hold), a 2-4 sentence explanation referencing purchase quality signals (price-to-value, impulse indicators, necessity), and a confidence indicator (e.g., low/medium/high). |
| FR-003 | As a visitor, I want to receive a verdict that evaluates impulse indicators so that I can identify when I am making an emotionally driven purchase. | High | LLM system prompt includes heuristics for: time pressure language, emotional justification patterns, comparison to recent similar purchases (if profile exists), and financial impact ratio (price relative to stated income/budget if available). |
| FR-004 | As a visitor, I want to submit another verdict immediately after receiving one so that I can evaluate multiple purchases in a session. | Medium | After verdict display, a clear "Evaluate another purchase" CTA resets the form. No session limit on the web app MVP. |
| FR-005 | As a visitor, I want to see the verdict in a visually distinct format (not just plain text) so that the recommendation is immediately clear. | Medium | Verdict displays with color-coded indicator: green (Buy), red (Skip), amber (Hold/Wait). Typography and layout clearly differentiate the verdict from the reasoning. |

#### 5.1.2 User Profile & Personalization

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| FR-006 | As a visitor, I want to optionally complete a short values questionnaire so that my verdicts become personalized to what I care about. | High | Profile form presents 5 questions covering: spending priorities (e.g., durability vs. convenience vs. experience), financial goals, and impulse sensitivity self-assessment. Completable in under 2 minutes. Stored in local storage (no account required). |
| FR-007 | As a profiled user, I want my verdicts to reference my stated values so that recommendations feel personally relevant, not generic. | High | When profile data exists, verdict reasoning explicitly references user stated values (e.g., "You said you prioritize experiences over things - this does not align with that goal"). Verdicts without a profile use general purchase quality signals only. |
| FR-008 | As a visitor, I want to create an account (email or OAuth) so that my profile and verdict history persist across devices. | Medium | Account creation via email/password or Google OAuth. Profile data and verdict history sync to account. Account creation is prompted after 3rd verdict but never blocks access. |
| FR-009 | As a returning user, I want my previous verdicts to inform future recommendations so that the app learns my patterns. | Medium | Backend stores verdict history per user. LLM prompt includes summary of past verdicts (categories, regret patterns) when generating new verdicts. Minimum 3 past verdicts before pattern-based personalization activates. |
| FR-010 | As a profiled user, I want to edit my values profile at any time so that changes in my priorities are reflected in future verdicts. | Low | Profile edit accessible from settings. Changes take effect on next verdict. Previous verdicts are not retroactively updated. |

#### 5.1.3 Sharing & Viral Loop

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| FR-011 | As a user, I want to share my verdict as a visually branded card on social media so that my followers can see and try Truepick. | High | Share button generates an image card (PNG or OG-tagged URL) containing: product name, verdict (Buy/Skip), a 1-line summary of reasoning, and Truepick branding with URL. Supports sharing to Twitter/X, Instagram Stories, iMessage, and clipboard. |
| FR-012 | As a visitor arriving from a shared verdict link, I want to see the original verdict and immediately try my own so that the viral loop completes. | High | Shared verdict URL displays the original verdict card with a prominent "Try your own" CTA that opens the verdict form. No login required. |
| FR-013 | As a user, I want to copy a direct link to my verdict result so that I can paste it in chats, forums, or messages. | Medium | Copy link button provides a unique permalink to the verdict. Link resolves to a branded landing page showing the verdict with Truepick CTA. |

#### 5.1.4 Structured Data Logging

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| FR-014 | As a product owner, I need every verdict to be logged with structured data so that I can train a prediction model on real user data. | High | Each verdict record stores: unique ID, timestamp, product name, price, category (LLM-determined), user reason, profile data snapshot (if available), LLM verdict, LLM confidence, LLM reasoning, and a nullable outcome field for follow-up. |
| FR-015 | As a product owner, I need verdict records linked to user accounts (when available) so that I can track per-user patterns over time. | High | Verdicts created by authenticated users include `user_id` foreign key. Anonymous verdicts store a session identifier for potential later account linking. |
| FR-016 | As a returning user, I want to report whether I bought the product and whether I regret it so that the app learns from my outcomes. | Medium | Follow-up prompt appears in verdict history after 7 days: "Did you buy [product]? How do you feel about it?" Stores: purchased (yes/no), outcome (satisfied/regret/neutral). Links to original verdict record. |
| FR-017 | As a product owner, I need all LLM API calls logged with input/output tokens and latency so that I can monitor costs and performance. | Medium | Each verdict logs: model used, input token count, output token count, API latency (ms), estimated cost. Accessible in admin dashboard. |

#### 5.1.5 Educational Content & SEO

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| FR-018 | As a visitor arriving from search, I want to read educational content about impulse buying and smart purchasing so that I understand the value Truepick offers. | High | Blog/resource section with SEO-optimized articles. Each article includes an embedded verdict tool CTA. Content covers: impulse buying psychology, the IQ-tax concept, purchase decision frameworks, category-specific regret data. |
| FR-019 | As a visitor searching "should I buy [product]", I want to land on a product-specific verdict page so that I can get an instant AI-powered recommendation. | High | Product verdict pages are indexed by search engines. Each page contains: product name, an interactive verdict form pre-filled with the product, and general purchase considerations for the category. Pages generated programmatically for trending/popular products. |
| FR-020 | As a product owner, I need all verdict pages and blog content to have proper meta tags, structured data, and OG images so that they rank and share well. | Medium | Every page includes: title tag, meta description, OG image, OG title/description, canonical URL, and JSON-LD structured data. Product verdict pages use FAQ schema. |

#### 5.1.6 Web-to-iOS Conversion Funnel

| ID | User Story | Priority | Acceptance Criteria |
|----|------------|----------|---------------------|
| FR-021 | As a returning web user, I want to see a non-intrusive prompt to download the iOS app so that I am aware of the premium experience without being annoyed. | High | iOS CTA appears after 3rd verdict (not before). Displays: "Get personalized verdicts, spending reports, and more on the Truepick app." Dismissible. Does not reappear for 7 days after dismissal. Smart App Banner on iOS Safari. |
| FR-022 | As a web user who creates an account, I want my profile and verdict history to sync to the iOS app so that I do not start over. | High | Account data (profile, verdict history) is stored server-side. iOS app login with same credentials loads full history. No data loss during platform transition. |
| FR-023 | As a product owner, I need to track the full web-to-iOS funnel so that I can optimize conversion at each step. | Medium | Analytics tracks: unique visitors -> first verdict -> 3rd verdict -> profile created -> account created -> iOS CTA shown -> App Store click. Funnel visualization in admin dashboard. |


### 5.2 Non-Functional Requirements

| ID | Requirement | Category | Target |
|----|------------|----------|--------|
| NFR-001 | Verdict page (form + result) achieves Largest Contentful Paint under threshold on mobile 4G. | Performance | LCP < 2.5s |
| NFR-002 | Time from verdict submission to verdict display, including LLM API round-trip. | Performance | < 3s (p95) |
| NFR-003 | Interaction to Next Paint for all interactive elements (buttons, form fields, share actions). | Performance | INP < 200ms |
| NFR-004 | Cumulative Layout Shift across the verdict flow (form -> loading -> result display). | Performance | CLS < 0.1 |
| NFR-005 | Time to First Byte for initial page load and verdict API endpoint. | Performance | TTFB < 800ms |
| NFR-006 | Web app uptime measured monthly, excluding scheduled maintenance windows. | Reliability | 99.5% uptime |
| NFR-007 | LLM API failure graceful degradation: if primary model is unavailable, fall back to secondary model or cached generic verdict. | Reliability | Fallback activates within 5s of primary timeout; user sees verdict within 8s worst case. |
| NFR-008 | All user data (profiles, verdicts, accounts) encrypted at rest using AES-256. | Security | AES-256 encryption at rest |
| NFR-009 | All data in transit encrypted via TLS 1.2+. No HTTP endpoints. | Security | TLS 1.2+ enforced; HSTS enabled |
| NFR-010 | User authentication via bcrypt-hashed passwords or OAuth 2.0. No plaintext credential storage. | Security | bcrypt (cost factor >= 12) or OAuth 2.0 |
| NFR-011 | LLM API keys stored in environment variables or secrets manager, never in client-side code or version control. | Security | Zero API keys in frontend bundle or git history |
| NFR-012 | Rate limiting on verdict API to prevent abuse and control LLM costs. | Security | 10 verdicts/hour per IP (anonymous); 30/hour per authenticated user |
| NFR-013 | GDPR and CCPA compliance: user data exportable and deletable on request. | Compliance | Data export within 72 hours; full deletion (including verdict logs) within 30 days of request |
| NFR-014 | Privacy policy and terms of service clearly explain data collection, LLM usage, and data retention. | Compliance | Published and linked from footer on all pages before public launch |
| NFR-015 | WCAG 2.1 Level AA compliance for all user-facing pages. | Accessibility | Lighthouse Accessibility score >= 90; keyboard-navigable verdict flow; screen reader compatible |
| NFR-016 | Responsive design: fully functional on mobile (320px+), tablet, and desktop viewports. | Accessibility | No horizontal scrolling or broken layouts at 320px, 768px, 1024px, 1440px widths |
| NFR-017 | Architecture supports 10x current traffic without re-architecture. Verdict API is stateless and horizontally scalable. | Scalability | Handles 100 concurrent verdict requests with < 5s p99 latency |
| NFR-018 | Database schema supports future features (email sync, purchase history, swipe interface) without breaking changes. | Scalability | Schema includes nullable fields and foreign keys for iOS app features per existing SQL schema design |
| NFR-019 | LLM model is swappable via configuration (not hardcoded). Supports rapid switching between providers/models for cost or quality optimization. | Scalability | Model change requires config update only, no code deployment. Supports Claude, gpt-5-nano, and equivalent tier models |
| NFR-020 | Google Lighthouse overall score for verdict page. | Performance | Score >= 85 (Performance, Accessibility, Best Practices, SEO) |
| NFR-021 | Structured verdict data log completeness: percentage of verdicts with all required schema fields populated. | Data Quality | 100% of required fields; >= 95% of optional fields (category, confidence) |
| NFR-022 | Automated deployment pipeline with staging environment for pre-production testing. | Maintainability | CI/CD pipeline deploys to staging on PR merge; production deploy requires manual approval |
| NFR-023 | Error monitoring and alerting for LLM API failures, server errors, and anomalous traffic patterns. | Observability | Alerts within 5 minutes of: >5% error rate, LLM API downtime, or traffic spike >3x baseline |

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
