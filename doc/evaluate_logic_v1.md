# Purchase Evaluation Logic (v1)

This document explains the current rule-based logic used by `evaluatePurchase` in
`apps/web/src/api/verdictService.ts`. It computes a risk score from price,
category, justification, and urgency signals, then maps that score to a verdict
(`buy`, `hold`, or `skip`).

## How the scoring works

### 1) Price-based risk

- If price > $200 → +30 risk
- Else if price > $100 → +15 risk

### 2) Category-based risk

If the category includes any of these impulse-prone terms (case-insensitive),
add +20 risk:

- clothing
- fashion
- accessories
- gadgets
- electronics

### 3) Justification strength

- If justification is missing or shorter than 20 characters → +25 risk
- Else if it includes "want" but not "need" → +10 risk

### 4) Title urgency keywords

If the title contains any urgency/scarcity keyword, add +20 risk:

- limited
- sale
- deal
- exclusive
- last chance
- flash

## Verdict thresholds

- riskScore ≥ 50 → **skip**
- riskScore ≥ 25 → **hold**
- otherwise → **buy**

## Confidence

Confidence is calculated as:

- `1 - riskScore / 150`
- clamped to a minimum of 0.50 and maximum of 0.95

This means higher risk reduces confidence, but it never drops below 50% or rises
above 95%.

## Output structure

The function returns:

- `outcome`: `buy` | `hold` | `skip`
- `confidence`: a value between 0.50 and 0.95
- `reasoning`:
  - `riskScore`: total score
  - `factors`: array of human-readable reasons for each score increase
