# Plan: Tier 1 Behavioural Telemetry + Paywall + Anonymous Auth

## Context

This plan combines two implementation streams:

1. **Tier 1 PostHog telemetry** — the 7 core behavioural events needed to analyse the verdict funnel, paywall calibration, and guest-to-registered conversion at launch.
2. **Daily limit enforcement + Paywall modal** — the API-side 3-verdict/day cap for free users, a modal dialog that appears on limit-hit with a waitlist CTA offering 3 months free, and Supabase anonymous auth so guests get the full verdict experience without signing up first.

**Key constraints from codebase audit:**
- `bucketPrice()` exists at `useAnalytics.ts:69` (private, bare-number format `'0-25'` not `'$0-25'`) — keep format for consistency with existing `verdict_submitted`
- `submitVerdict()` returns `{ data, error }` but `Dashboard.tsx:171` only destructures `error` — must capture `data` for `verdict_id`
- `confidence_score` is already in the DB and selected in queries, but missing from the `VerdictRow` TypeScript type
- `users` table has no `tier`/`plan` column — must add one
- `syncUserRecord()` in `App.tsx:41` skips anonymous users (guards on `email` presence at line 43) — this is correct behaviour; no change needed
- `RequireAuth` guard at `App.tsx:61` currently blocks guests from `/`, `/swipe`, `/profile` — anonymous auth removes the need for this guard on `/` (Dashboard only)
- `identifyPostHogUser()` in `useAnalytics.ts:48` calls `posthog.identify(userId)` with no properties — must be extended to pass `is_anonymous`

---

## Part A: Database Changes

### A1. Add `tier` column to `users` table

**New migration file:** `supabase migration new add_user_tier`

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free', 'premium'));
```

No backfill needed — all existing users default to `'free'`.

---

## Part B: API Changes — Daily Limit Enforcement

**File:** `apps/api/src/index.ts`

### B1. New middleware: `checkDailyVerdictLimit`

Insert after the existing `rateLimitLLM` middleware (after line ~111), before the route definitions.

```typescript
const DAILY_VERDICT_LIMIT_FREE = 3

const checkDailyVerdictLimit = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  const user = (req as AuthenticatedRequest).authUser
  // Fetch user tier from DB
  const sb = supabase()
  const { data: userRow } = await sb
    .from('users')
    .select('tier')
    .eq('id', user.id)
    .single()

  // Anonymous users (no row in users table) default to free
  const tier = userRow?.tier ?? 'free'
  if (tier === 'premium') {
    next()
    return
  }

  // Count today's verdicts (UTC day boundary)
  const todayUtc = new Date()
  todayUtc.setUTCHours(0, 0, 0, 0)
  const { count } = await sb
    .from('verdicts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', todayUtc.toISOString())

  const usedToday = count ?? 0
  if (usedToday >= DAILY_VERDICT_LIMIT_FREE) {
    posthog.capture({
      distinctId: user.id,
      event: 'paywall_hit',
      properties: {
        verdicts_used_today: usedToday,
        time_of_day: new Date().getUTCHours(),
        day_of_week: new Date().getUTCDay(),
      },
    })
    res.status(429).json({
      error: 'daily_limit_reached',
      verdicts_remaining: 0,
      verdicts_used_today: usedToday,
      daily_limit: DAILY_VERDICT_LIMIT_FREE,
    })
    return
  }

  next()
}
```

### B2. Apply to `/api/verdict/evaluate`

Change the route registration from:
```typescript
app.post('/api/verdict/evaluate', requireAuth, rateLimitLLM, async (req, res) => {
```
to:
```typescript
app.post('/api/verdict/evaluate', requireAuth, checkDailyVerdictLimit, rateLimitLLM, async (req, res) => {
```

`checkDailyVerdictLimit` runs after auth (needs `authUser`) but before the LLM call. Order: `requireAuth` → `checkDailyVerdictLimit` → `rateLimitLLM` → handler.

### B3. Response body update for daily limit

The API now also returns `verdicts_remaining` in the **success** response body so the client can update the counter without a separate fetch. In the handler's success return (around line 505), include it:

```typescript
// After existing posthog.capture('verdict_evaluated', ...) call:
const remaining = Math.max(0, DAILY_VERDICT_LIMIT_FREE - (usedToday + 1))
// Note: usedToday must be threaded from checkDailyVerdictLimit via res.locals or re-queried
```

**Simpler approach:** Pass count via `res.locals` from the middleware:
```typescript
// In checkDailyVerdictLimit, before next():
res.locals.verdictsUsedToday = usedToday
```
Then in the route handler, append to the OpenAI response:
```typescript
const responseData = { ...data, verdicts_remaining: Math.max(0, DAILY_VERDICT_LIMIT_FREE - (res.locals.verdictsUsedToday + 1)) }
res.json(responseData)
```

### B4. `paywall_conversion_completed` webhook stub (comment only)

After the `/api/verdict/evaluate` block, add:

```typescript
// FUTURE: POST /api/webhooks/stripe
// On event 'checkout.session.completed':
//   posthog.capture({
//     distinctId: event.data.object.metadata.user_id,
//     event: 'paywall_conversion_completed',
//     properties: {
//       trigger_context: event.data.object.metadata.trigger_context ?? 'unknown',
//       verdicts_at_conversion: Number(event.data.object.metadata.verdicts_at_conversion) || null,
//     },
//   })
// Requires: trigger_context + verdicts_at_conversion in Stripe checkout metadata.
```

---

## Part C: Anonymous Auth

### C1. Silent `signInAnonymously` on first visit

**File:** `apps/web/src/App.tsx`

In the existing `useEffect` that calls `supabase.auth.getSession()` (line 237), extend the logic: if `data.session` is null after the initial fetch, silently sign in anonymously.

```typescript
useEffect(() => {
  supabase.auth.getSession().then(async ({ data }) => {
    if (data.session) {
      setSession(data.session)
    } else {
      // No session — sign in anonymously so guests get a real user_id
      const { data: anonData } = await supabase.auth.signInAnonymously()
      setSession(anonData.session)
    }
    setSessionLoading(false)
  })

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
    setSession(nextSession)
  })

  return () => subscription.unsubscribe()
}, [])
```

**Why this is safe:** `signInAnonymously()` is idempotent when a persisted anonymous session already exists in `localStorage` — Supabase reuses it. The guard `if (data.session)` prevents double sign-in for returning users.

### C2. `syncUserRecord` already handles anonymous users correctly

`syncUserRecord` at `App.tsx:41` guards on `email` presence (line 43: `if (!email) return`). Anonymous users have no email, so no `users` table row is created. This is intentional — the daily limit middleware handles missing user rows by defaulting to `'free'` tier.

### C3. Update `RequireAuth` to allow anonymous sessions

Currently `RequireAuth` (line 61) redirects to `/auth` if `session === null`. With anonymous auth, `session` will always be non-null. No change needed — anonymous users will have a valid `session` and can access the Dashboard route.

**However:** The navbar currently shows `session.user.email` in the header chip (line 384). For anonymous users, `email` is `undefined`. Update the display:

**File:** `apps/web/src/App.tsx`, line 384:
```tsx
// BEFORE:
<span className="session-email">{session.user.email}</span>

// AFTER:
<span className="session-email">
  {session.user.email ?? 'Guest'}
</span>
```

And line 397 (avatar initial for mobile):
```tsx
// BEFORE:
{session.user.email?.charAt(0).toUpperCase() ?? '?'}

// AFTER:
{session.user.email?.charAt(0).toUpperCase() ?? 'G'}
```

### C4. Account conversion on sign-up

When an anonymous user submits the auth form with email + password (`authMode === 'sign_up'`), change the Supabase call from `signUp()` to `updateUser()`:

**File:** `apps/web/src/App.tsx`, `handleAuth` function (line 292–295):

```typescript
// BEFORE:
const action =
  authMode === 'sign_in'
    ? supabase.auth.signInWithPassword({ email, password })
    : supabase.auth.signUp({ email, password })

// AFTER:
const isAnonymous = session?.user.is_anonymous ?? false
const action =
  authMode === 'sign_in'
    ? supabase.auth.signInWithPassword({ email, password })
    : isAnonymous
      ? supabase.auth.updateUser({ email, password })  // converts anonymous → permanent
      : supabase.auth.signUp({ email, password })       // fresh sign-up
```

`updateUser()` preserves the `user_id`, so all verdict history carries over automatically. The session remains valid; `onAuthStateChange` will fire with the updated user object including the new email.

After conversion, call `syncUserRecord` to create the users table row (it was skipped for anonymous users):
```typescript
// Inside handleAuth, after successful sign-up analytics tracking:
if (authMode === 'sign_up' && data.session) {
  await syncUserRecord(data.session)
}
```

---

## Part D: Paywall Modal

### D1. New component: `PaywallModal.tsx`

**File:** `apps/web/src/components/PaywallModal.tsx`

New modal component following the existing modal pattern (`VerdictDetailModal`, `EvaluatingModal`):

```typescript
type PaywallModalProps = {
  isOpen: boolean
  onClose: () => void
  onSignUp: () => void   // navigates to /auth or triggers sign-up flow
  verdictsUsedToday: number
  dailyLimit: number
}
```

**Content:**
- Heading: "You've used your 3 free verdicts today"
- Subtext: "Join the premium waitlist now — founding members get 3 months free."
- Email input + "Join waitlist" CTA (submits to a waitlist endpoint or mailto)
- Secondary CTA: "Sign up free" — calls `onSignUp()` for anonymous users who haven't registered yet; hidden if user is already registered
- Close button (X) and Escape key support
- Renders via `createPortal(document.body)` from Dashboard

**PostHog event on waitlist submit:**
```typescript
analytics.trackPaywallConversionStarted({
  trigger_context: 'paywall_modal',
  verdicts_at_conversion: verdictsUsedToday,
})
```

### D2. Waitlist submission

Simple approach for MVP: use Resend to manage clients who signed up for waitlist. The modal email input posts to a new API endpoint:

**New migration:** `supabase migrations new add_waitlist.sql`
```sql
CREATE TABLE waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  verdicts_at_signup int,
  created_at timestamp DEFAULT now()
);
```

No auth required on this route — anyone can submit.

### D3. Wire PaywallModal into Dashboard

**File:** `apps/web/src/pages/Dashboard.tsx`

1. Add state: `const [paywallOpen, setPaywallOpen] = useState(false)`
2. Add state: `const [verdictsUsedToday, setVerdictsUsedToday] = useState(0)`
3. In `handleEvaluate`, when `evaluatePurchase()` returns a 429 with `error: 'daily_limit_reached'`, instead of showing a text error:
   - Parse `verdicts_used_today` from the response body
   - `setVerdictsUsedToday(data.verdicts_used_today)`
   - `setPaywallOpen(true)`
4. Pass `verdicts_remaining` from successful API responses back through `evaluatePurchase()` so the `verdict_requested` PostHog event can include the real count.
5. Add to JSX (alongside existing portal modals):
```tsx
{paywallOpen && createPortal(
  <PaywallModal
    isOpen={paywallOpen}
    onClose={() => setPaywallOpen(false)}
    onSignUp={() => { setPaywallOpen(false); navigate('/auth') }}
    verdictsUsedToday={verdictsUsedToday}
    dailyLimit={3}
  />,
  document.body
)}
```

Note: `navigate` requires importing `useNavigate` from react-router-dom in Dashboard.

---

## Part E: PostHog Analytics Changes

### E1. `identifyPostHogUser` — add `is_anonymous` property

**File:** `apps/web/src/hooks/useAnalytics.ts`, `identifyPostHogUser` function (line 48)

```typescript
// BEFORE:
export const identifyPostHogUser = (userId: string | null): void => {
  if (!isPostHogEnabled()) return
  if (userId) {
    posthog.identify(userId)
  } else {
    posthog.reset()
  }
}

// AFTER:
export const identifyPostHogUser = (userId: string | null, isAnonymous = false): void => {
  if (!isPostHogEnabled()) return
  if (userId) {
    posthog.identify(userId, { is_anonymous: isAnonymous })
  } else {
    posthog.reset()
  }
}
```

**File:** `apps/web/src/components/AnalyticsProvider.tsx`, line 56

```typescript
// BEFORE:
identifyPostHogUser(userId)

// AFTER:
const isAnonymous = session?.user.is_anonymous ?? false
identifyPostHogUser(userId, isAnonymous)
```

### E2. `useAnalytics.ts` — New types and tracking functions

**Add type aliases** (before `bucketPrice`):
```typescript
type InputMethod = 'manual' | 'chrome_extension' | 'url_paste'
type UserTier = 'free' | 'premium'
```

**Export `bucketPrice`:** Change `const bucketPrice` → `export const bucketPrice`

**Add 5 new tracking functions** (after existing Tier 1 section):
```typescript
const trackVerdictRequested = (params: {
  product_category: string
  price_range: string
  input_method: InputMethod
  user_tier: UserTier
  verdicts_remaining_today: number | null
}) =>
  trackEvent('verdict_requested', {
    product_category: params.product_category,
    price_range: params.price_range,
    input_method: params.input_method,
    user_tier: params.user_tier,
    verdicts_remaining_today: params.verdicts_remaining_today ?? undefined,
  })

const trackVerdictDelivered = (params: {
  verdict_outcome: string
  confidence_score: number | null
  response_latency_ms: number
  verdict_id: string
}) =>
  trackEvent('verdict_delivered', {
    verdict_outcome: params.verdict_outcome,
    confidence_score: params.confidence_score ?? undefined,
    response_latency_ms: Math.round(params.response_latency_ms),
    verdict_id: params.verdict_id,
  })

const trackVerdictOverride = (params: {
  verdict_id: string
  original_verdict: string
  user_action: 'bought_anyway' | 'skipped_anyway'
  time_since_verdict_ms: number
}) =>
  trackEvent('verdict_override', {
    verdict_id: params.verdict_id,
    original_verdict: params.original_verdict,
    user_action: params.user_action,
    time_since_verdict_ms: Math.round(params.time_since_verdict_ms),
  })

const trackPaywallHit = (params: {
  verdicts_used_today: number
  session_verdicts_count: number
  time_of_day: number
  day_of_week: number
}) =>
  trackEvent('paywall_hit', {
    verdicts_used_today: params.verdicts_used_today,
    session_verdicts_count: params.session_verdicts_count,
    time_of_day: params.time_of_day,
    day_of_week: params.day_of_week,
  })

const trackPaywallConversionStarted = (params: {
  trigger_context: string
  verdicts_at_conversion: number | null
}) =>
  trackEvent('paywall_conversion_started', {
    trigger_context: params.trigger_context,
    verdicts_at_conversion: params.verdicts_at_conversion ?? undefined,
  })

const trackShareCardGenerated = (params: {
  verdict_id: string
  share_destination: string | null
  theme_selected: string
}) =>
  trackEvent('share_card_generated', {
    verdict_id: params.verdict_id,
    share_destination: params.share_destination ?? undefined,
    theme_selected: params.theme_selected,
  })
```

**Add all 6 to `analytics` export object** under Tier 1:
```
trackVerdictRequested,
trackVerdictDelivered,
trackVerdictOverride,
trackPaywallHit,
trackPaywallConversionStarted,
trackShareCardGenerated,
```

**Session replay `sampleRate`** in `initializePostHog()`:
```typescript
session_recording: {
  maskAllInputs: true,
  maskTextSelector: '[data-ph-mask]',
  sampleRate: 1,   // 100% at MVP — reduce to 0.2 at 10k+ DAU
},
```

### E3. `verdictTypes.ts` — Add `confidence_score` to `VerdictRow`

**File:** `apps/web/src/constants/verdictTypes.ts`

Add `confidence_score?: number | null` to `VerdictRow`. DB column already exists and is selected.

### E4. `Dashboard.tsx` — Wire telemetry events

**Replace** `analytics.trackVerdictEvalStarted()` at line 142 with `trackVerdictRequested`:
```typescript
analytics.trackVerdictRequested({
  product_category: category || 'other',
  price_range: bucketPrice(priceValue),
  input_method: 'manual',
  user_tier: 'free',  // TODO: read from API response when tier is available
  verdicts_remaining_today: verdictsRemainingToday, // from state (populated by API response)
})
```

**Capture `data` from `submitVerdict`** (line 171):
```typescript
const { data: submittedVerdict, error } = await submitVerdict(session.user.id, input, evaluation)
```

**Fire `verdict_delivered`** after `loadRecentVerdicts()` (line 191):
```typescript
if (submittedVerdict) {
  sessionVerdictsCountRef.current += 1
  analytics.trackVerdictDelivered({
    verdict_outcome: evaluation.outcome ?? 'unknown',
    confidence_score: evaluation.confidence ?? null,
    response_latency_ms: Date.now() - evalStartRef.current,
    verdict_id: submittedVerdict.id,
  })
}
```

**Fire `verdict_override`** after `trackVerdictDecision` in `handleVerdictDecision` (line 224):
```typescript
const isOverride =
  (verdict?.predicted_outcome === 'buy' && decision === 'skip') ||
  (verdict?.predicted_outcome === 'skip' && decision === 'bought')
if (isOverride && verdict) {
  analytics.trackVerdictOverride({
    verdict_id: verdictId,
    original_verdict: verdict.predicted_outcome ?? 'unknown',
    user_action: decision === 'skip' ? 'skipped_anyway' : 'bought_anyway',
    time_since_verdict_ms: verdictAgeSeconds * 1000,
  })
}
```

**Add `sessionVerdictsCountRef`** (after `evalStartRef` at line 36):
```typescript
const sessionVerdictsCountRef = useRef<number>(0)
```

### E5. `Profile.tsx` — Mirror `verdict_override`

After `analytics.trackVerdictDecision(decision, verdictAgeSeconds)` at line 653, add identical override block using the local `verdict` variable.

### E6. `VerdictShareModal.tsx` — `share_card_generated`

After `analytics.trackShareLinkCreated(...)` at line 75:
```typescript
analytics.trackShareCardGenerated({
  verdict_id: verdict.id,
  share_destination: null,
  theme_selected: background,
})
```

---

## Implementation Sequence

| Order | Step | File(s) |
|---|---|---|
| 1 | DB migration: add `tier` to users | new migration sql |
| 2 | DB migration: add `waitlist` table | new migration sql |
| 3 | API: `checkDailyVerdictLimit` middleware + apply to route | `apps/api/src/index.ts` |
| 4 | API: `POST /api/waitlist` route | `apps/api/src/index.ts` |
| 5 | Analytics types + functions + `bucketPrice` export | `useAnalytics.ts` |
| 6 | `identifyPostHogUser` signature + `is_anonymous` | `useAnalytics.ts`, `AnalyticsProvider.tsx` |
| 7 | `VerdictRow` type: add `confidence_score` | `verdictTypes.ts` |
| 8 | Anonymous auth: `signInAnonymously` on first visit | `App.tsx` |
| 9 | Account conversion: `updateUser` for anonymous sign-ups | `App.tsx` |
| 10 | Header: show "Guest" for anonymous users | `App.tsx` |
| 11 | `PaywallModal` component | new `PaywallModal.tsx` |
| 12 | Dashboard: wire paywall modal + telemetry events | `Dashboard.tsx` |
| 13 | Profile: `verdict_override` augmentation | `Profile.tsx` |
| 14 | VerdictShareModal: `share_card_generated` | `VerdictShareModal.tsx` |

---

## Event → Implementation Mapping

| Event | Where it fires | Status |
|---|---|---|
| `verdict_requested` | Dashboard.tsx `handleEvaluate` | **Replaces** `trackVerdictEvalStarted` |
| `verdict_delivered` | Dashboard.tsx after `loadRecentVerdicts` | **New** — client-side render event |
| `verdict_override` | Dashboard.tsx + Profile.tsx `handleVerdictDecision` | **Augments** `trackVerdictDecision` |
| `paywall_hit` | API middleware (server-side) + Dashboard (client) | **New** — fires in both places |
| `paywall_conversion_started` | PaywallModal.tsx on waitlist submit | **New** |
| `paywall_conversion_completed` | API webhook (comment stub — awaits Stripe) | **Future** |
| `share_card_generated` | VerdictShareModal.tsx after share link created | **New** |
| PostHog `is_anonymous` | AnalyticsProvider.tsx on `identifyPostHogUser` | **Augments** existing identify call |

---

## Verification

1. **TypeScript build:** `cd apps/web && tsc --noEmit` and `cd apps/api && tsc --noEmit`
2. **Anonymous auth:**
   - Clear localStorage, open app — network tab should show `signInAnonymously` call
   - Submit 3 verdicts — PaywallModal should appear on the 4th attempt
   - Sign up in the modal — `updateUser` should fire, email should appear in header, verdict history should be preserved
3. **PostHog Live Events:**
   - Submit verdict → see `verdict_requested` then `verdict_delivered` in sequence
   - Click "Bought" on a "skip" verdict → see `verdict_override` with `user_action: bought_anyway`
   - Hit daily limit → see `paywall_hit` from API (check PostHog server-side events)
   - Open share modal → see `share_card_generated` with initial theme
4. **PostHog person properties:** Verify `is_anonymous: true` on guest persons, `is_anonymous: false` after conversion
5. **Session replay:** Confirm recordings appear with all inputs masked
