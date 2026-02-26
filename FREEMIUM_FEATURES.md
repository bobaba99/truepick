# TruePick — Feature Summary

## Free Tier (Web App)

| Feature | Description |
| --- | --- |
| **Initial Quiz** | Onboarding assessment to profile the user's spending tendencies, impulse triggers, and decision-making style |
| **Limited Verdicts (3 per week)** | AI-powered buy/skip verdicts with usage cap — users submit a product and receive a one-line reasoned recommendation, limit the rationale depth* |
| **Educational Resources** | Curated content on consumer psychology, impulse buying patterns, and decision frameworks |

> **Design intent:** The free tier builds habit and trust. Users learn to consult TruePick before purchases. No analytics, no behavioral tracking — just the core decision tool. This creates natural demand for the premium tier when users want *automated* protection and *insight* into their patterns.

*=_Deliberately starting strict and publicly loosening limits is an underused growth lever — it generates organic goodwill moments ("TruePick just doubled the free limit!") that function as free marketing events. Headspace and Notion both used this playbook effectively during growth phases._

---

## Premium Tier

### Chrome Extension — Behavioral Intervention Layer

#### 0. Refined and unlimited verdict

- Unlimited verdicts
- More detailed rationale for the verdict (refer to user's profile and values)

#### 1. Session Awareness (Passive)

- Tracks browsing activity on e-commerce domains (time on site, pages viewed, visit frequency)
- Surfaces real-time indicators: *"You've browsed 14 products in 22 minutes — this pattern matches impulse browsing"*
- Badge count or subtle dashboard widget showing session stats
- **Ships first** — generates behavioral data for the other two features without introducing friction

#### 2. Interstitial Friction at Checkout (Active)

- Detects checkout flow pages via URL pattern matching and DOM heuristics
- Injects a dismissible decision overlay that routes the user through TruePick's verdict engine
- Logs override behavior: *"You've overridden TruePick 6 of 8 times. Your average regret score on overrides: 7.2/10"*
- Integrates with the web app's existing buy/skip logic — verdicts are contextual, not duplicated

#### 3. Website Blocking (Opt-in Commitment Device)

- User-configured block lists with customizable schedules (e.g., block Amazon 10pm–2am)
- Two modes:
  - **Soft block** — 30-second delay with a reflection prompt before access
  - **Hard block** — full prevention with a user-set override cooldown
- **Never default-on** — positioned as a self-imposed constraint for users who have built self-awareness through session tracking and interstitial friction

### Web App — Analytics & Intelligence Layer

#### 4. Spending Pattern Analysis

- Weekly/monthly reports modeled on dividend-report style: charts, short summaries, trend lines
- Key metric: *"$XXX redirected to satisfied purchases this past week"*
- Personalized LLM-generated insights analyzing purchase categories, timing patterns, and decision quality over time
- More emotionally compelling: "You override TruePick verdicts 73% of the time after 10pm. Your regret rate on those overrides is 4x higher than daytime purchases. If you'd followed TruePick's evening recommendations, you'd have saved $280 this month."

#### 5. Alternative Recommendations

- When a verdict suggests "skip," the LLM surfaces alternative solutions — cheaper options, DIY approaches, existing items the user already owns that fulfill the same need
- Alternatives are contextual to the specific product and the user's stated goals

#### 6. Ongoing Email Syncing

- Connects to purchase confirmation emails to automatically log completed transactions
- Merges email-detected purchases with TruePick verdicts to close the feedback loop:
  - Which verdicts did the user follow vs. override?
  - Post-purchase satisfaction tracking (7/14/30-day check-ins)
  - Regret data feeds back into the verdict model over time

#### 7. Agent Implementation

- Chat with your past regretted and satisfied purchases
- Gate the agent behind a data threshold ("Chat unlocks after 10 verdicts") or design the onboarding to front-load data — the initial quiz results, manual purchase history import, or a retroactive email scan.
- Structured query layer: "Show me my most regretted purchases," "What categories do I overspend on after 9pm," "Compare my override rate this month vs. last month." 

---

## Tier Comparison

| Capability | Free | Premium |
|---|:---:|:---:|
| Initial quiz | ✓ | ✓ |
| Unlimited verdicts | ✓ | ✓ |
| Educational resources | ✓ | ✓ |
| Session awareness | — | ✓ |
| Checkout interstitials | — | ✓ |
| Website blocking | — | ✓ |
| Spending reports & charts | — | ✓ |
| Alternative recommendations | — | ✓ |
| Email sync & purchase tracking | — | ✓ |

---

## Implementation Sequence

```markdown
Phase 1: Free Web App (current)
  └── Quiz + Verdicts + Educational content → build user base
  Needs to show returning and expanding user base before committing to the Chrome extension and premium features.

Phase 2: Chrome Extension (after web app traction)
  └── Session Awareness → Interstitial Friction → Website Blocking
      (ship incrementally, not all at once)

Phase 3: Premium Analytics (web app)
  └── Spending reports + Alternative recs + Email syncing
      (requires sufficient purchase history data)
```