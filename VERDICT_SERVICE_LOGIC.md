# Verdict Service Logic — Detailed Documentation

This document describes the verdict evaluation logic across `verdictContext.ts`, `verdictPrompts.ts`, `verdictScoring.ts`, and `verdictService.ts`.

---

## 1. Overview

The verdict service evaluates potential purchases and returns a **Buy / Hold / Skip** verdict with reasoning. The active algorithm is **LLM-only** (`llm_only`): decisions come from OpenAI's GPT-4o-mini. A heuristic fallback is used when the LLM is unavailable (no API key, parse failure, or validation failure).

**Entry points:**
- `evaluatePurchase(userId, input, openaiApiKey?)` — runs evaluation (LLM or fallback)
- `submitVerdict(userId, input, evaluation, existingVerdictId?)` — persists verdict (insert or update)
- `inputFromVerdict(verdict)` — extracts `PurchaseInput` from a verdict row (for regeneration)

---

## 2. verdictContext.ts — Context Gathering

### 2.1 Vendor Match (`retrieveVendorMatch`)

Fetches vendor data from the `vendors` table for the given purchase input.

**Matching strategy (in order):**
1. Exact `vendor_name` + `vendor_category` (category normalized: trimmed, lowercase)
2. Exact `vendor_name` (ignore category)
3. Partial `vendor_name` (`ILIKE '%vendorName%'`) with `limit(1)`

**Returned fields:** `vendor_id`, `vendor_name`, `vendor_category`, `vendor_quality`, `vendor_reliability`, `vendor_price_tier`

---

### 2.2 User Profile Context (`retrieveUserProfileContext`)

Builds a text summary from `users`:

- **profile_summary** — plain text summary
- **weekly_fun_budget** — formatted as `$X.XX`
- **onboarding_answers** (JSON):
  - `coreValues`, `regretPatterns`, `satisfactionPatterns`
  - `decisionStyle`, `neuroticismScore`, `identityStability`
  - `materialism` (centrality, happiness, success)
  - `locusOfControl` (workHard, destiny)

Returns `'Profile summary: not set.'` if empty.

---

### 2.3 Recent Purchases (`retrieveRecentPurchases`)

Fetches purchases from `purchases` joined with `swipes` and `verdicts`.

**Rating windows:**
- `recent` — swipes rated within last 30 days
- `long_term` — swipes rated older than 6 months

**Logic:**
- Filters by `getLatestRatedAt(swipes)` vs cutoff dates
- Sorts by latest `rated_at` descending
- Formats each purchase: `title | $price | category | vendor | ratings: day3=X, week3=X, month3=X | "justification"`
- Limit: 5 per window

---

### 2.4 Similar Purchases (`retrieveSimilarPurchases`)

**With embeddings (OpenAI API key provided):**
1. Build query text: `title | category | vendor | justification` (first 500 chars)
2. Build purchase text per item: `title | category | vendor | justification` (500 chars)
3. Get embeddings for query + all purchases
4. Score with cosine similarity
5. Return top 5 by similarity

**Without embeddings or on failure:**
- Fallback: exact category match, then format same as above

**Rating windows:** same as recent purchases (`recent` / `long_term`).

---

### 2.5 Pattern Repetition (`computePatternRepetition`)

Fetches swipes for the given category from `swipes` joined with `purchases`.

**Scoring:**
- `regret` → 0
- `not_sure` → 0.5
- `satisfied` → 1
- Else → 0

Returns mean score and explanation `'Average similarity-weighted reflection score.'`

---

## 3. verdictPrompts.ts — Prompt Construction

### 3.1 System Prompt (`buildSystemPrompt`)

- Role: purchase evaluator
- Vendor rubric: quality, reliability, price_tier definitions from `VENDOR_RUBRIC`
- Rules: no inventing vendor/history, valid JSON only, ratings within 30 days = immediate regret, >6 months = long-term satisfaction

---

### 3.2 User Prompt (`buildUserPrompt`)

**Inputs:** `input`, `profileContext`, `similarRecentPurchases`, `recentPurchases`, `similarLongTermPurchases`, `longTermPurchases`, `vendorMatch`, `weeklyBudget`

**Structure:**
1. Profile context
2. Immediate regret signals (recent + similar recent)
3. Long-term satisfaction signals (long-term + similar long-term)
4. Vendor match (or "not found")
5. Purchase details: item, price, category, vendor, rationale, important-purchase flag
6. Important purchase policy (if `isImportant`)
7. JSON schema for the response

---

### 3.3 Important Purchase Policy (`buildImportantPurchasePolicy`)

Only included when `input.isImportant === true`.

**Budget-based thresholds** (from `computePriceThresholds(weeklyBudget)`):
- `monthlyBudget = weeklyBudget * 4`
- `high` = 0.8 × monthlyBudget
- `medium` = 0.4 × monthlyBudget

If no budget: `'No budget is set, so use general judgment for price sensitivity.'`

**Policy rules:**
- High price and premium/luxury tier must not be the primary negative reason
- Price is negative only with clear affordability strain or poor long-term utility
- Must acknowledge important purchase and state that high price is tolerated
- Essential + long-term utility → approve; suggest financing instead of skip
- Never skip unless poor long-term utility or severe affordability strain

---

### 3.4 Expected LLM JSON Output

| Field | Type | Notes |
|-------|------|-------|
| `value_conflict` | `{ score, explanation }` | 0–1, 0 = no conflict |
| `emotional_impulse` | `{ score, explanation }` | 0 = rational, 1 = impulsive |
| `long_term_utility` | `{ score, explanation }` | 0 = no value, 1 = essential |
| `emotional_support` | `{ score, explanation }` | 0–1 |
| `short_term_regret` | `{ score, explanation }` | 0–1 |
| `long_term_regret` | `{ score, explanation }` | 0–1 |
| `verdict` | `'buy' \| 'hold' \| 'skip'` | lowercase only |
| `confidence` | number | 0.5 = uncertain, 0.7 = moderate, 0.9+ = very confident |
| `alternative_solution` | string | Empty if buy |
| `rationale` | string | 3–4 sentence narrative, no schema leakage |

---

## 4. verdictScoring.ts — Scoring and Fallback

### 4.1 VENDOR_RUBRIC

**Quality:** low (0.4), medium (0.6), high (0.8)  
**Reliability:** low (0.4), medium (0.6), high (0.8)  
**Price tier:** budget, mid_range, premium, luxury (with typical_multiplier descriptions)

---

### 4.2 Price Tier Risk Points

| Tier | Risk points |
|------|-------------|
| budget | 0 |
| mid_range | 4 |
| premium | 8 |
| luxury | 12 |

---

### 4.3 Price Thresholds (`computePriceThresholds`)

From `weeklyBudget`:
- `monthlyBudget = weeklyBudget * 4`
- `high = 0.8 * monthlyBudget`
- `medium = 0.4 * monthlyBudget`

If no budget: `high = 800`, `medium = 400`.

---

### 4.4 Decision From Score (`decisionFromScore`)

- `score >= 0.7` → `skip`
- `score >= 0.4` → `hold`
- else → `buy`

---

### 4.5 Financial Strain (`computeFinancialStrain`)

- If no price or no budget or `weeklyBudget <= 0`: 0
- If not important and `price > weeklyBudget / 3`: 1
- Else: `clamp01(price / weeklyBudget)`

---

### 4.6 Fallback Evaluation (`evaluatePurchaseFallback`)

**Risk score components:**

| Condition | Points | Reason string |
|-----------|--------|----------------|
| `price >= high` | 30 | `High price point (>=$X)` |
| `price >= medium` | 15 | `Moderate price point ($X-$Y)` |
| `justification` missing or &lt;20 chars | 25 | Weak or missing justification |
| "want" without "need" in justification | 10 | Want-based rather than need-based |
| Title has urgency keywords | 20 | Title contains urgency/scarcity language |
| Vendor price tier (mid/premium/luxury) | 4–12 | Vendor price tier: X |

**Urgency keywords:** `limited`, `sale`, `deal`, `exclusive`, `last chance`, `flash`

**Normalized risk:** `clamp01(riskScore / 100)`

**Output:** Builds `EvaluationResult` with `valueConflict`, `emotionalImpulse`, `longTermUtility` (vendor-based or 0.4 fallback), `financialStrain`, `patternRepetition`, decision score, outcome, confidence, `alternativeSolution`, and narrative rationale.

**Rationale construction:**
1. Outcome message + primary reasons (from `reasons`)
2. Profile connection (regret/satisfaction patterns, core values)
3. Budget note if strain > 0.5
4. Vendor quality line

---

## 5. verdictService.ts — Orchestration

### 5.1 Main Flow: `evaluatePurchase`

1. **Load profile:** `weekly_fun_budget`, `onboarding_answers`
2. **Retrieve vendor match** for input
3. **Compute:**
   - `psychScores` from onboarding (neuroticism, materialism, locusOfControl)
   - `financialStrain` from price and weekly budget
   - `patternRepetition` for input category
4. **Fetch context in parallel:**
   - `profileContext`, `recentRatedPurchases`, `similarRecentPurchases` (recent)
   - `longTermRatedPurchases`, `similarLongTermPurchases` (long-term)
5. **If no `openaiApiKey`:** return `evaluatePurchaseFallback(input, overrides)`
6. **LLM path:** Call OpenAI, parse JSON, validate, optionally retry (max 2 attempts)

---

### 5.2 LLM Request

- **Model:** `gpt-4o-mini`
- **Messages:** `buildSystemPrompt()`, `buildUserPrompt(...)` + retry context
- **max_completion_tokens:** 4000

---

### 5.3 LLM Response Validation

1. **Content check:** Non-empty string; if empty, retry or throw
2. **JSON parse:** Valid JSON; if invalid, retry or throw
3. **Prompt template leak:** `rationale` and `alternative_solution` must not contain prompt markers (e.g. `'respond with this exact json'`, `'score constraints:'`, etc.)
4. **Important-purchase policy:** If `input.isImportant`, call `validateImportantPurchaseLlmOnlyRationale`
5. **Verdict and confidence:** Must be valid outcome and finite number; else fallback

---

### 5.4 Important-Purchase Validation (`validateImportantPurchaseLlmOnlyRationale`)

**When `isImportant` is true:**

1. **Rationale presence:** Must not be empty
2. **Acknowledgment:** Must mention "important purchase", "is important", "high-priority", or "priority purchase"
3. **Price tolerance:** Must contain price-tolerance language (e.g. "acceptable", "reasonable", "justified", "not a dealbreaker", "despite high price")
4. **Primary negative:** If high price/premium is primary negative, must have affordability or long-term utility evidence; otherwise invalid
5. **Force-approve check:** If verdict is skip and `isEssentialImportantHighUtilityPurchase` is true → invalid

---

### 5.5 Essential Important High-Utility Override (`isEssentialImportantHighUtilityPurchase`)

Returns `true` only when ALL hold:

- `input.isImportant`
- Justification has essential tokens: `essential`, `for work`, `required`, `need`, `photo`, `video`, `editing`, `machine learning`, `ml`
- `long_term_utility.score >= 0.65`
- `priceTier === 'high'` (from budget thresholds) OR vendor tier is premium/luxury

**Effect:** If LLM returns skip but this is true → verdict overridden to **buy**, confidence raised to ≥ 0.65, rationale amended with financing suggestion.

---

### 5.6 Rationale Alignment (`alignRationaleWithOutcome`)

- Strips leading `Outcome: ...` and similar labels
- Prepends normalized label: `Outcome: buy now` | `Outcome: hold or delay` | `Outcome: skip`
- Returns `Outcome: X. body`

---

### 5.7 Retry Loop

- **Max attempts:** 2
- **Retry triggers:**
  - Empty content / token limit
  - Invalid JSON
  - Prompt template leak in rationale or alternative_solution
  - Important-purchase validation failure
- **Retry payload:** Appends `Your previous response was rejected: ${reason} Please fix this issue in your next response.` to user message

---

### 5.8 Submit Verdict (`submitVerdict`)

**Behavior:**
- If `existingVerdictId`: UPDATE verdict
- Else: INSERT new verdict

**Payload:** `candidate_vendor_id`, `scoring_model`, `predicted_outcome`, `confidence_score`, `reasoning`, `hold_release_at` (24h from now if outcome is hold)

**Vendor match:** Re-queried at submit time (used for `candidate_vendor_id`).

---

### 5.9 Verdict Decision Update (`updateVerdictDecision`)

Handles user decision (`hold`, `bought`, `skipped`):

- **hold:** Set `user_hold_until` to 24h from now
- **bought:** If was not bought before, call `add_purchase` RPC; set `user_decision`
- **skipped:** If was bought, delete linked purchase; set `user_decision`

---

## 6. Utility Dependencies (utils.ts)

| Function | Purpose |
|----------|---------|
| `computePriceThresholds(weeklyBudget)` | Returns `{ high, medium }` from budget |
| `classifyPriceTier(price, weeklyBudget)` | `'high'` \| `'medium'` \| `'low'` by thresholds |
| `clamp01(value)` | Clamp to [0, 1] |

---

## 7. Data Flow Summary

```
User Input (PurchaseInput)
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│ evaluatePurchase                                                  │
│   ├── retrieveVendorMatch(input)                                  │
│   ├── Load profile (weekly_fun_budget, onboarding_answers)         │
│   ├── computePatternRepetition(userId, category)                 │
│   ├── retrieveUserProfileContext(userId)                          │
│   ├── retrieveRecentPurchases (recent + long_term)                 │
│   ├── retrieveSimilarPurchases (recent + long_term)                 │
│   └── buildFallbackOverrides() for fallback path                  │
└──────────────────────────────────────────────────────────────────┘
       │
       ├── No API key? ──────────────► evaluatePurchaseFallback
       │
       └── LLM path
             ├── buildSystemPrompt()
             ├── buildUserPrompt(..., weeklyBudget)
             ├── OpenAI API call
             ├── Parse JSON
             ├── hasPromptTemplateLeak?
             ├── isImportant? validateImportantPurchaseLlmOnlyRationale
             ├── Valid verdict/confidence? else fallback
             ├── shouldForceApprove? override skip → buy
             └── alignRationaleWithOutcome
       │
       ▼
EvaluationResult (outcome, confidence, reasoning)
       │
       ▼
submitVerdict(userId, input, evaluation, existingVerdictId?)
       │
       ▼
Verdict persisted in `verdicts` table
```

---

## 8. Database Tables Used

| Table | Usage |
|-------|-------|
| `users` | profile_summary, onboarding_answers, weekly_fun_budget |
| `vendors` | vendor lookup by name/category |
| `purchases` | history, swipes, verdicts for context |
| `swipes` | outcome, timing, rated_at for pattern repetition |
| `verdicts` | insert/update verdict results |

---

## 9. External APIs

| Service                  | Purpose                                   |
|--------------------------|-------------------------------------------|
| OpenAI Chat Completions  | LLM verdict evaluation (gpt-4o-mini)      |
| OpenAI Embeddings        | Semantic similarity for similar purchases |
