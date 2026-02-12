# Function Calls & Data Pipeline

> Auto-generated reference mapping every service function, its dependencies, database operations, and the end-to-end data pipelines that power each user flow described in `APP_FLOW.md`.

---

## 1. Service Layer Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  Pages (UI)                                                         │
│  Dashboard · Profile · Swipe · Resources · App (auth)               │
└──────┬──────────┬──────────┬──────────┬──────────┬──────────────────┘
       │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌──────────────────┐
│ verdict  │ │ purchase │ │ swipe  │ │ stats  │ │ userProfile      │
│ Service  │ │ Service  │ │Service │ │Service │ │ Service          │
└────┬─────┘ └────┬─────┘ └───┬────┘ └───┬────┘ └────┬─────────────┘
     │            │           │          │           │
     ▼            │           │          │           │
┌──────────┐      │           │          │           │
│ verdict  │      │           │          │           │
│ Context  │      │           │          │           │
├──────────┤      │           │          │           │
│ verdict  │      │           │          │           │
│ Prompts  │      │           │          │           │
├──────────┤      │           │          │           │
│ verdict  │      │           │          │           │
│ Scoring  │      │           │          │           │
└────┬─────┘      │           │          │           │
     │            │           │          │           │
     ▼            ▼           ▼          ▼           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Supabase Client (supabaseClient.ts)                                │
│  Tables: users · purchases · verdicts · swipes · swipe_schedules    │
│          vendors · resources                                        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
                     ┌───────────────────┐
                     │  External APIs    │
                     │  · OpenAI (GPT)   │
                     │  · OpenAI Embed.  │
                     └───────────────────┘
```

---

## 2. Verdict Pipeline

### 2.1 Core Functions

#### `evaluatePurchase(userId, input, openaiApiKey?)`
**File:** `verdictService.ts`  
**Purpose:** Gathers all context, calls LLM, returns scored evaluation.

| Step | Function Call | Source | DB Read |
|------|-------------|--------|---------|
| 1 | `retrieveVendorMatch(input)` | verdictContext | `vendors` |
| 2 | `supabase.from('users').select(...)` | direct | `users.weekly_fun_budget, onboarding_answers` |
| 3 | `computePsychScores(onboarding_answers)` | internal | — |
| 4 | `computeFinancialStrain(price, budget, isImportant)` | verdictScoring | — |
| 5 | `buildScore(strainValue, explanation)` | verdictScoring | — |
| 6 | `computePatternRepetition(userId, category)` | verdictContext | `swipes` + `purchases` (joined) |
| 7a | `retrieveUserProfileContext(userId)` | verdictContext | `users.profile_summary, onboarding_answers, weekly_fun_budget` |
| 7b | `retrieveRecentPurchases(userId, 5, { ratingWindow: 'recent' })` | verdictContext | `purchases` + `swipes` + `verdicts` |
| 7c | `retrieveSimilarPurchases(userId, input, 5, key, { ratingWindow: 'recent' })` | verdictContext | `purchases` + `swipes` + `verdicts`, OpenAI Embeddings API |
| 7d | `retrieveRecentPurchases(userId, 5, { ratingWindow: 'long_term' })` | verdictContext | `purchases` + `swipes` + `verdicts` |
| 7e | `retrieveSimilarPurchases(userId, input, 5, key, { ratingWindow: 'long_term' })` | verdictContext | `purchases` + `swipes` + `verdicts`, OpenAI Embeddings API |
| 8 | `buildSystemPrompt()` | verdictPrompts | — |
| 9 | `buildUserPrompt(input, context...)` | verdictPrompts | — |
| 10 | `fetch('https://api.openai.com/v1/chat/completions')` | external | OpenAI Chat API |
| 11 | Validate + retry loop (up to 2 attempts) | internal | — |
| 12 | `buildScore()` × 6 score fields | verdictScoring | — |
| 13 | `alignRationaleWithOutcome(verdict, rationale)` | internal | — |

**Fallback path** (no API key or LLM failure):
- `evaluatePurchaseFallback(input, overrides)` → heuristic-based scoring using `decisionFromScore` + `confidenceFromScore`

**Returns:** `EvaluationResult { outcome, confidence, reasoning }`

---

#### `submitVerdict(userId, input, evaluation, existingVerdictId?)`
**File:** `verdictService.ts`  
**Purpose:** Persists evaluation result as a new or updated verdict row.

| Step | Operation | Table | Columns |
|------|-----------|-------|---------|
| 1 | `retrieveVendorMatch(input)` | `vendors` (read) | vendor_id, vendor_name, ... |
| 2a | INSERT (new) | `verdicts` (write) | user_id, candidate_title, candidate_price, candidate_category, candidate_vendor, justification, candidate_vendor_id, scoring_model, predicted_outcome, confidence_score, reasoning, hold_release_at |
| 2b | UPDATE (regenerate) | `verdicts` (write) | candidate_vendor_id, scoring_model, predicted_outcome, confidence_score, reasoning, hold_release_at |
| 3 | SELECT (re-fetch) | `verdicts` (read) | full row |

**Returns:** `{ data: VerdictRow | null, error: string | null }`

---

#### `inputFromVerdict(verdict)`
**File:** `verdictService.ts`  
**Purpose:** Extracts `PurchaseInput` from an existing `VerdictRow` for regeneration.

| VerdictRow field | → PurchaseInput field |
|---|---|
| `candidate_title` | `title` |
| `candidate_price` | `price` |
| `candidate_category` | `category` |
| `candidate_vendor` | `vendor` |
| `justification` | `justification` |
| `reasoning.importantPurchase` | `isImportant` |

---

### 2.2 Context Gathering (verdictContext.ts)

#### `retrieveVendorMatch(input)`
Searches `vendors` table by vendor name (fuzzy `ilike`) and optional category match. Falls back to name-only match if category match fails.

#### `retrieveUserProfileContext(userId)`
Reads `users.profile_summary`, `onboarding_answers`, `weekly_fun_budget` and formats into a text block for the LLM prompt.

#### `retrieveRecentPurchases(userId, limit, options?)`
Reads last 40 purchases with joined `swipes` and `verdicts`, filters by rating window (`recent` = last 30 days, `long_term` = older than 6 months), sorts by latest rated date, returns formatted text.

#### `retrieveSimilarPurchases(userId, input, limit, openaiApiKey?, options?)`
Same data source as `retrieveRecentPurchases`, but ranks by semantic similarity using OpenAI embeddings (cosine similarity). Falls back to category/title matching when no API key.

#### `computePatternRepetition(userId, category)`
Reads `swipes` joined with `purchases` for the same category, computes mean regret rate, returns `ScoreExplanation`.

---

### 2.3 Prompt Construction (verdictPrompts.ts)

#### `buildSystemPrompt()`
Static system prompt defining the evaluator role, vendor rubric definitions, and response rules (JSON-only, no fabrication, rating window interpretation).

#### `buildUserPrompt(input, profileContext, ...purchaseContexts, vendorMatch)`
Assembles the full user prompt:
1. Profile context block
2. Immediate regret signals (recent ratings)
3. Long-term satisfaction signals (long-term ratings)
4. Vendor match data
5. Purchase details (item, price, category, vendor, rationale, importance)
6. Important purchase policy (conditionally appended)
7. JSON schema with score anchors and field constraints

---

### 2.4 Scoring & Fallback (verdictScoring.ts)

#### `evaluatePurchaseFallback(input, overrides?)`
Heuristic fallback when LLM is unavailable. Computes risk score from:
- Price thresholds (>$200 = 30pts, >$100 = 15pts)
- Impulse category detection (+20pts)
- Justification quality (+25pts weak, +10pts want-based)
- Urgency/scarcity language in title (+20pts)
- Vendor price tier risk points

Maps normalized risk → `decisionFromScore()` → `confidenceFromScore()` → narrative rationale.

#### `buildScore(score, explanation)` → `ScoreExplanation`
#### `computeFinancialStrain(price, budget, isImportant)` → `number`
#### `decisionFromScore(score)` → `VerdictOutcome` (≥0.7 skip, ≥0.4 hold, else buy)
#### `confidenceFromScore(score)` → `number`

---

### 2.5 LLM Response Validation (verdictService.ts)

| Check | Action on failure |
|-------|-------------------|
| Empty/truncated content | Retry (up to 2 attempts) |
| Invalid JSON | Retry |
| Prompt template leak detected | Retry |
| Important purchase policy violation | Retry |
| Invalid verdict value or confidence | Fall back to `evaluatePurchaseFallback` |
| Essential important purchase returns `skip` | Force override to `buy` |

---

## 3. Verdict Decision Pipeline

#### `updateVerdictDecision(userId, verdictId, decision)`
**File:** `verdictService.ts`

| Step | Condition | Operation | Table |
|------|-----------|-----------|-------|
| 1 | — | SELECT | `verdicts` (read previous decision) |
| 2 | Was `bought`, now isn't | DELETE | `purchases` (remove linked purchase) |
| 3 | Now `bought`, wasn't before | RPC `add_purchase` | `purchases` (create linked purchase) |
| 4 | — | UPDATE | `verdicts.user_decision, user_hold_until` |

---

## 4. Purchase Pipeline

#### `createPurchase(input)` — `purchaseService.ts`
Calls RPC `add_purchase(p_title, p_price, p_vendor, p_category, p_purchase_date, p_source)`.

#### `updatePurchase(userId, purchaseId, input)` — `purchaseService.ts`
Updates `purchases` row: `title, price, vendor, category, purchase_date, source`.

#### `deletePurchase(userId, purchaseId)` — `purchaseService.ts`
1. Reads `purchases.verdict_id`
2. If linked to verdict: updates `verdicts.user_decision = 'skip'`, `user_hold_until = null`
3. Deletes `purchases` row

#### `getPurchaseHistory(userId, limit)` — `purchaseService.ts`
Reads `purchases`: `id, title, price, vendor, category, purchase_date, source, created_at`.

---

## 5. Swipe Pipeline

#### `getUnratedPurchases(userId, options?)` — `swipeService.ts`
Reads `swipe_schedules` (where `completed_at IS NULL`) joined with `purchases`. Optionally includes future-scheduled items.

#### `createSwipe(userId, purchaseId, outcome, timing, scheduleId)` — `swipeService.ts`
1. INSERT into `swipes`: `user_id, purchase_id, schedule_id, timing, outcome, rated_at`
2. UPDATE `swipe_schedules.completed_at`

#### `deleteSwipe(userId, scheduleId)` — `swipeService.ts` (undo)
1. DELETE from `swipes` where `user_id + schedule_id`
2. UPDATE `swipe_schedules.completed_at = null`

---

## 6. Stats Pipeline

#### `getSwipeStats(userId)` — `statsService.ts`
1. Reads all `swipes.outcome` for user
2. Reads `verdicts` where `predicted_outcome = 'hold'` and `hold_release_at > now()` and `user_proceeded IS NULL`
3. Computes: `swipesCompleted`, `regretRate`, `activeHolds`

---

## 7. User Profile Pipeline

#### `getUserProfile(userId)` — `userProfileService.ts`
Reads `users`: `id, email, created_at, last_active, onboarding_completed, profile_summary, onboarding_answers, weekly_fun_budget`.

#### `createUserProfile(userId, email)` — `userProfileService.ts`
Inserts into `users`: `id, email, last_active`.

#### `updateUserProfile(userId, updates)` — `userProfileService.ts`
Updates `users`: `profile_summary`, `onboarding_answers`, `weekly_fun_budget` (conditionally).

---

## 8. Page → Service Call Map

### Dashboard (`/`)

| User Action | Service Calls (in order) |
|-------------|--------------------------|
| Page load | `getSwipeStats` → `getVerdictHistory(3)` |
| Submit evaluate form | `evaluatePurchase` → `submitVerdict` → `getSwipeStats` → `getVerdictHistory` |
| Click Bought/Hold/Skip | `updateVerdictDecision` → `getSwipeStats` → `getVerdictHistory` |
| Click Regenerate | `inputFromVerdict` → `evaluatePurchase` → `submitVerdict(…, verdict.id)` → `getSwipeStats` |

### Profile (`/profile`)

| User Action | Service Calls (in order) |
|-------------|--------------------------|
| Page load | `getUserProfile` → `getVerdictHistory(10)` → `getPurchaseHistory(10)` |
| Save profile/budget | `updateUserProfile` → `getUserProfile` |
| Save onboarding | `updateUserProfile` → `getUserProfile` |
| Add purchase | `createPurchase` → `getPurchaseHistory` |
| Edit purchase | `updatePurchase` → `getPurchaseHistory` |
| Delete purchase | `deletePurchase` → `getPurchaseHistory` → `getVerdictHistory` |
| Verdict decision | `updateVerdictDecision` → `getVerdictHistory` → `getPurchaseHistory` |
| Delete verdict | `deleteVerdict` → `getVerdictHistory` → `getPurchaseHistory` |
| Regenerate verdict | `inputFromVerdict` → `evaluatePurchase` → `submitVerdict(…, verdict.id)` |

### Swipe (`/swipe`)

| User Action | Service Calls (in order) |
|-------------|--------------------------|
| Page load | `getUnratedPurchases` |
| Swipe left/right/down | `createSwipe` |
| Undo | `deleteSwipe` |
| Refresh | `getUnratedPurchases` |

### Resources (`/resources`)

| User Action | Service Calls (in order) |
|-------------|--------------------------|
| Page load | `getPublishedResources` |

### Admin Resources (`/admin/resources`)

| User Action | Service Calls (in order) |
|-------------|--------------------------|
| Page load | `getAdminResources` |
| Save (new) | `createAdminResource` |
| Save (edit) | `updateAdminResource` |
| Publish / Unpublish | `publishAdminResource` / `unpublishAdminResource` |
| Delete | `deleteAdminResource` |
| Image upload | `uploadAdminResourceImage` |

### Auth (App.tsx)

| User Action | Service Calls (in order) |
|-------------|--------------------------|
| App mount | `supabase.auth.getSession` → `supabase.from('users').upsert` |
| Sign in | `supabase.auth.signInWithPassword` |
| Sign up | `supabase.auth.signUp` |
| Sign out | `supabase.auth.signOut` |

---

## 9. Database Table Access Summary

| Table | Read by | Written by |
|-------|---------|------------|
| `users` | evaluatePurchase, retrieveUserProfileContext, getUserProfile | createUserProfile, updateUserProfile, App (upsert) |
| `verdicts` | getVerdictHistory, getRecentVerdict, updateVerdictDecision, getSwipeStats, submitVerdict | submitVerdict (insert/update), updateVerdictDecision, deleteVerdict, deletePurchase |
| `purchases` | retrieveRecentPurchases, retrieveSimilarPurchases, computePatternRepetition, getPurchaseHistory, deletePurchase, getEmailImportStats | createPurchase (RPC), updatePurchase, deletePurchase, updateVerdictDecision (RPC), importGmailReceipts (RPC) |
| `swipes` | computePatternRepetition, getSwipeStats, retrieveRecentPurchases (joined) | createSwipe, deleteSwipe |
| `swipe_schedules` | getUnratedPurchases | createSwipe (update), deleteSwipe (update) |
| `vendors` | retrieveVendorMatch, submitVerdict | — |
| `resources` | getPublishedResources | Admin API (apps/api) |
| `email_connections` | getEmailConnection, getEmailImportStats, isTokenExpired | saveEmailConnection, updateLastSync, deactivateEmailConnection, deleteEmailConnection |

---

## 10. External API Calls

| API | Called by | Purpose |
|-----|----------|---------|
| OpenAI Chat Completions (`gpt-4o-mini`) | `evaluatePurchase`, `parseReceiptWithAI` | LLM verdict generation, receipt data extraction |
| OpenAI Embeddings | `retrieveSimilarPurchases` | Semantic similarity for purchase matching |
| Gmail API (messages.list) | `listMessages` | Search for receipt emails |
| Gmail API (messages.get) | `getMessage` | Fetch full email content |
| Google OAuth | EmailSync page | Obtain Gmail access token |

---

## 11. Gmail Import Pipeline

### 11.1 Core Functions

#### `importGmailReceipts(accessToken, userId, options)`
**File:** `importGmail.ts`
**Purpose:** Orchestrates Gmail receipt import from OAuth token to purchase creation.

| Step | Function Call | Source | External API |
|------|---------------|--------|--------------|
| 1 | `buildReceiptQuery(sinceDays)` | gmailClient | — |
| 2 | `listMessages(accessToken, query, maxMessages * 3)` | gmailClient | Gmail API |
| 3 | `getMessage(accessToken, messageId)` | gmailClient | Gmail API |
| 4 | `parseMessage(message)` | gmailClient | — |
| 5 | `looksLikeReceipt(parsed)` | gmailClient | — |
| 6 | `parseReceiptWithAI(text, sender, subject, date, apiKey)` | receiptParser | OpenAI API |
| 7 | `supabase.rpc('add_purchase', {...})` | direct | — |
| 8 | `updateLastSync(userId)` | emailConnectionService | — |

**Returns:** `ImportResult { imported, skipped, errors }`

---

#### `parseReceiptWithAI(emailText, sender, subject, emailDate, openaiApiKey)`
**File:** `receiptParser.ts`
**Purpose:** Uses GPT-4o-mini to extract structured purchase data from email content.

| Step | Operation |
|------|-----------|
| 1 | Truncate email content to 4000 chars |
| 2 | Build prompt with sender, subject, date, content |
| 3 | Call OpenAI Chat Completions API |
| 4 | Parse JSON response |
| 5 | `validateAndNormalize(parsed, fallbackDate)` |

**Returns:** `ExtractedReceipt | null`

---

### 11.2 Email Connection Service (emailConnectionService.ts)

| Function | Operation | Table |
|----------|-----------|-------|
| `getEmailConnection(userId)` | SELECT | `email_connections` |
| `saveEmailConnection(userId, input)` | UPSERT | `email_connections` |
| `updateLastSync(userId)` | UPDATE | `email_connections.last_sync` |
| `deactivateEmailConnection(userId)` | UPDATE | `email_connections.is_active = false` |
| `deleteEmailConnection(userId)` | DELETE | `email_connections` |
| `isTokenExpired(connection)` | — (pure function) | — |

---

### 11.3 Page → Service Call Map (EmailSync)

| User Action | Service Calls (in order) |
|-------------|--------------------------|
| Page load | `getEmailConnection` → `getEmailImportStats` |
| Connect Gmail | Google OAuth redirect → `saveEmailConnection` |
| Import Receipts | `importGmailReceipts` → `getEmailImportStats` |
| Disconnect | `deactivateEmailConnection` |
