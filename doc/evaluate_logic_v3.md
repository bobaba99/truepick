# Adjustment

## Marketing

- Avoid two extreme mindsets with pragmatism: scarcity and reckless spending
- Name: Verity, Justified, Aligned, Grounded

## Prompt (`verdictService.ts`)

- If decision is skip, add alternative solutions to compensate for the same need instead of purchasing

## User profile (`Profile.tsx`)

- Add a summary about user as a person, there will be guided questions
  - "I'm a cashier and undergraduate student, I'm thinking about saving for my tuition and eventually get a car."
  - Placeholder: “The user prioritises financial stability and minimalism, often regrets impulse tech purchases, is most satisfied with durable functional items, and has a moderately deliberate decision style. They are financially risk-averse and value purchases that provide long-term emotional stability rather than excitement.”
  - `My Decision Profile` for summary box and also make it into an onboarding quiz with a modal dialog
```markdown
1. Core Values

“Which of these matter most to you when buying something?”

Financial stability

Minimalism / low clutter

Emotional wellbeing

Self-improvement

Ethical consumption

Aesthetic enjoyment

Convenience

Status / image

Experiences over objects

2. Typical Regret Pattern

“When you regret a purchase, it is usually because…”

I bought impulsively

It didn’t get used

It didn’t match who I am

It was too expensive for what it gave

It was driven by stress, boredom, or FOMO

It duplicated something I already had

3. Typical Satisfaction Pattern

“When a purchase feels truly worth it, it usually…”

Improves my daily routine

Lasts a long time

Supports my growth or habits

Makes life calmer or easier

Reflects my identity

Saves time or energy

4. Decision Style

“Which best describes how you usually decide?”

I plan carefully and delay

I think briefly, then decide

I often buy emotionally and justify later

It depends heavily on mood

(You can map this to: deliberate → impulsive)

~~5. Financial Sensitivity~~

~~“When spending money, I mostly feel…”~~

~~Very cautious~~

~~Balanced~~

~~Flexible~~

~~Indifferent~~

~~Or numeric:~~

~~“Spending money causes me stress” (1–5)~~

5. Neuroticism (replace `Financial Sensitivity`)

Item: "I tend to experience negative emotions easily (e.g., worry, nervousness, tension, sadness), and I find it difficult to stay calm or emotionally steady under stress."

Scale:
1 — Disagree a lot
2 — Disagree
3 — Neither agree nor disagree
4 — Agree
5 — Agree a lot

Finding: Higher neuroticism predicts stronger outcome and process regret in consumers.

~~6. Emotional Relationship to Buying~~
~~“What role do purchases play emotionally for you?”~~
~~Rate each 1–5:~~
~~They help me feel more stable~~
~~They help me feel excited~~
~~They help me feel in control~~
~~They help me feel rewarded~~
~~This differentiates support vs stimulation.~~

6. Materialism (replace `Emotional Relationship to Buying`)

Scale: (1) no, not at all, (2) no, not really, (3) yes, a little, (4) yes, very much. Item scores were averaged to create scale scores

Items:
- Material centrality: "Do you think it’s important to own expensive things?"
- Material happiness: "Does buying expensive things make you happy?"
- Material success: "Do you like people who have expensive things more than you like other people?"

Finding: Materialistic, status‑driven, and compulsive buyers show higher post‑purchase regret.

7. Locus of control (new addition)

Scale: does not apply at all (1) to applies completely (5).

Items:
- "If I work hard, I will succeed."
- "Destiny often gets in the way of my plans."

Findings: People high in internal locus of control regret abnormal (norm‑violating) bad decisions more, because they feel more personally responsible; those low in internal control regret normal and abnormal decisions similarly.

8. Identity Stability

“How important is it that your purchases reflect who you believe you are?”

Not important

Somewhat important

Very important
```

- Add a weekly `budget` goal for entertainment and fun stuff

## Verdict service logic (`verdictService.ts`, `Home.tsx`, `Profile.tsx`)

- Schema: map out vendors with quality/reliability, utility coding for each brand reputation
- Flag for important/major purchases (e.g., car, tool)
- Use LLM to generate normally distributed data for testing and training algorithm
- MTurk to collect real user data and recall a real purchase from last 3 months.
  - Linear regression for the decision index value
  - Logistic regression for the decision outcomes

```json
{
  "quality": {
    "definition": "How well the product performs its intended function when it works.",
    "enum": {
      "low": {
        "score": 0.4,
        "description": "Below-average performance; compromises are obvious."
      },
      "medium": {
        "score": 0.6,
        "description": "Adequate performance; meets basic expectations."
      },
      "high": {
        "score": 0.8,
        "description": "Strong performance; well-designed and efficient."
      }
    }
  },
  "reliability": {
    "definition": "How consistently the product maintains acceptable performance over time.",
    "enum": {
      "low": {
        "score": 0.4,
        "description": "Noticeable failure risk; inconsistent durability."
      },
      "medium": {
        "score": 0.6,
        "description": "Generally dependable with occasional issues."
      },
      "high": {
        "score": 0.8,
        "description": "Rare failures; long-term dependable."
      }
    }
  },
  "price_tier": {
    "definition": "Relative market positioning of the product’s price level.",
    "enum": {
      "budget": {
        "typical_multiplier": "<0.7× market median",
        "description": "Lowest-cost options; price is the primary selling point."
      },
      "mid_range": {
        "typical_multiplier": "0.7–1.2× market median",
        "description": "Balanced cost and performance; mainstream pricing."
      },
      "premium": {
        "typical_multiplier": "1.2–2× market median",
        "description": "Higher-than-average price; design, brand, or quality emphasis."
      },
      "luxury": {
        "typical_multiplier": ">2× market median",
        "description": "Price driven mainly by brand, exclusivity, or status signalling."
      }
    }
  }
}
```

### Formula

Outcome thresholds: score ≥ 0.7 → skip, ≥ 0.4 → hold, else buy.

``` latex
decision_score =
  w1 * value_conflict +
  w2 * pattern_repetition +
  w3 * emotional_impulse +
  w4 * financial_strain -
  w5 * long_term_utility -
  w6 * emotional_support
```

#### `value_conflict`

Rated by LLM with a set of rubrics: `0` = fully aligned with pre-committed values (e.g., "I value efficiency and this tool can save my price with a small cost within my budget"); `.5` = partially aligned (e.g., "You value minimalism and avoiding clutter, but this item overlaps with things you already own. While it has some functional justification, it partially conflicts with your preference for reducing redundancy."); `1` = obvious contradiction (“You have stated that you avoid fast fashion and this purchase comes from a brand that contradicts this commitment, creating a direct conflict with your pre-committed values.”).

#### `pattern_repetition`

```latex
mean(reflection x similarity_score)
```

reflection: `regret`=0, `not_sure`=.5, `satisfied`=1

#### `emotional_impulse`

Rated by LLM with a set of rubrics: `0` = deliberate, planned, emotionally neutral (e.g., "This purchase was planned, and your motivation is primarily functional. You are not expecting it to significantly change your mood, and you would still want it even if you waited a few days.", "I need new clothes because I grow out of my old ones"); `.5` = mild emotional impulse/mixed motivation (e.g., "Part of your motivation comes from wanting to feel excited or relieved right now, but you also see long-term usefulness. Emotional and practical reasons are roughly balanced."); `1` = high emotional arousal/primarily emotion-driven (e.g., "You indicated that this purchase is mainly to change how you feel in the moment, such as reducing stress or boredom. If you waited 24 hours, your desire for it might decrease. This suggests a strong impulse-driven component.").

#### `financial_strain`

Calculated with harcoded formula. If the cost weighs over 1/3 of the entire weekly budget and not flagged as `important`, it will be assigned the highest value of `financial_strain`; if the purchase is flagged as `important`, it will proceed with normal calculation.

```latex
financial_strain = min(1, price / budget_goal)
```

#### `long_term_utility`

How much durable value does this purchase actually add. Rated by LLM with a set of rubrics: `0` = decorative, replaceable, rarely used; `1` = consistently used, capability-expanding, long-lived.

### `emotional_support`

The degree to which the purchase provides stable, non-avoidant psychological support that improves the user’s wellbeing beyond momentary mood repair. Rated by LLM with a set of rubrics: `0` = No real emotional support; `.5` = Mild support; `1` = Strong support.

To differentiate from impulse:
- `emotional_impulse`: “I want to feel better right now”
- `emotional_support`: “This helps me function over time”
- Impulse promotes volatility.
- Support promotes stability.

Low emotional support (0): “This purchase does not appear to provide ongoing emotional or psychological support. Its impact is likely to be brief rather than stabilising.”

Medium emotional support (0.5): “This item may offer some comfort or structure, but its effect seems situational rather than deeply integrated into your routines.”

High emotional support (1): “You indicated that this purchase would support your mental wellbeing in a lasting way, such as improving daily routines or emotional stability. This strongly offsets impulsive or short-term motivations.”


### Exporting weights

```json
{
  "model_version": "weights_v1.2",
  "trained_on": "2026-01-27",
  "dimensions": [
    "value_conflict",
    "pattern_repetition",
    "emotional_impulse",
    "financial_strain",
    "long_term_utility"
  ],
  "weights": {
    "intercept": 0.18,
    "value_conflict": 0.34,
    "pattern_repetition": 0.41,
    "emotional_impulse": 0.27,
    "financial_strain": 0.12,
    "long_term_utility": -0.29
  }
}
```

## Swiping (`Swipe.tsx`)

- Outcomes stored in `swipes.outcome`: `regret`, `satisfied`, `not_sure`.
- Schedule timings stored in `swipe_schedules.timing`:
  - `day3` (purchase date + 3 days)
  - `week3` (purchase date + 3 weeks)
  - `month3` (purchase date + 3 months)
  - `immediate` is reserved for seeded historical purchases.
- New purchases schedule **day3 / week3 / month3** checkpoints.
- Seeded purchases schedule **immediate**, then **week3** and **month3**.
- The queue shows only due schedules (`scheduled_for <= today` and `completed_at is null`).
- UI filter:
  - **All** (default)
  - **Immediate** (seeded)
  - **Later** (day3 / week3 / month3)
