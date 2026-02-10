# Application Flow

## 1. Overview
<!-- High-level description of how a user moves through the application -->

### Guest user

User completes a 5-question quiz to improve verdict accuracy, then proceeds to enter the details of their purchase at hand. The app generates the verdict for them and prompts to ask the guest if they want to sign up and save their quiz and verdict results.

### Registered user

User completes the full 10-question quiz. After entering the details of their purchase at hand, the app generates the verdict for them.
User also has the option to import their 10-20 most recent purchases through email API. They will swipe for regret or satisfaction to generate aggregated purchase-regret trends in assisting the verdict service. If the verdict is not 'hold', it will automatically add the item to the swiping queue for future feedback on their regret/satisfaction on purchasing or not purchasing the item (regardless of the verdict decision).

### Shared features

The educational content is available for all users. The user can also share the verdict as an image to iMesssage, Messenger, Whatsapp, Instagram, etc.

---

## 2. Entry Points
<!-- How do users arrive at the application? (URL, deep link, redirect, etc.) -->

Through URL from Google search or social media handles.

---

## 3. Authentication Flow

### 3.1 New User Registration
<!-- Step-by-step flow -->

The user can register using their email or phone number. Next they will enter their password, the strength will be indicated by a progress bar below the password input text box.
After registration, the user will check their email or text messages for verification codes to activate their account. Once activated, the user can login and initiate their profile onboarding and email syncing.

```
[Landing Page] → [Register / Sign-up] → [Text message/Email Verification] → [Dashboard] → [Profile Onboarding] → [Email Syncing] → [Tour of the app] → [Start the first verdict]
```


### 3.2 Returning User Login
<!-- Step-by-step flow -->

If the user hasn't completed the profile onboarding, they will be prompted to do so. If the user has completed the profile onboarding, they will be prompted to sync their email. If the user has completed the email syncing, they will be prompted to take a tour of the app. If the user has taken the tour of the app, they will be prompted to start the first verdict.

```
[Landing Page] → [Login] → [Dashboard] → [Profile Onboarding] → [Email Syncing] → [Tour of the app] → [Start the first verdict]
```

If the user has completed the profile onboarding and email syncing, they will be directed to the dashboard.

```
[Landing Page] → [Login] → [Dashboard]
```


### 3.3 Password Recovery
<!-- Step-by-step flow -->

The user can recover their password by entering their email or phone number. They will receive a password reset email with a link to reset their password.

```
[Landing Page] → [Forgot Password] → [Email Verification] → [Reset Password]
```

---

## 4. Core User Flows

### 4.1 Flow: Verdict Generation

The user enters the details of their purchase at hand. The app generates the verdict for them. During purchase details entry, the user will see example prompts of what to enter in the justification field for the purchase. The app will also remind the user to use speech-to-text for faster entry.

The details include the product name, price, category, vendor, justification, and a toggle to indicate if the purchase is important or not (i.e., major purchase like a laptop, a new phone, etc.). The app will use an emoji to present the item's product category as an extra UI element to help the user understand the category of the purchase.

```
[Dashboard] → [Purchase Details Entry] → [Verdict Generation] → [Verdict Result]
```

#### 4.1.1 Edge Cases
- The user enters minimal justification for the purchase. If the length is less than 10 words, the app will show a modal dialog suggesting the user to write down more details with some probing questions to get a more accurate verdict. The dialog has a button to 'go back' and another button to 'continue' if the user wants to continue with missing details.
- The justification also cannot be too long. If the length is greater than 100 words, the app will show a modal dialog suggesting the user to shorten the justification. The dialog has a button to 'go back' and another button to 'continue' if the user wants to continue with the long justification. This way to keep the token count in check.

### 4.2 Flow: Swiping for Regret/Satisfaction

The user can swipe for regret or satisfaction on the purchase. The app will update the purchase stats. Seeding purchases will be available for swiping immediately after importing from the email API. New verdicts will be available for swiping after 3 days, then 3 weeks, and finally 3 months. The stats will be aggregated for product category, vendor, and price range, and displayed in a chart in the dashboard. It will be stored in Supabase as a table called `purchase_stats` with the following columns: `id`, `user_id`, `vendor_id`, `dimension_type` (enum: category | price_range | vendor | vendor_quality | vendor_reliability | vendor_price_tier ), `total_purchases`, `total_swipes`, `regret_count`, `satisfied_count`, `regret_rate`, `last_updated`. The dashbaord only displays the most impactful stats and the profile displays all the stats with filter enabled for each dimension type.

```
[Dashboard] → [Swipe for Regret/Satisfaction] → [Purchase Stats Update]
```

#### 4.2.1 Edge Cases

- The user doesn't swipe on past purchases. The app will remind the user to swipe on their past purchases to build their regret patterns for better verdict accuracy.

---

## 5. Navigation Structure

```
├── Home / Dashboard
│   ├── Verdict Generation
│   ├── Verdict History (up to 3 most recent verdicts)
|   ├── Share to social media or save as an image
├── Home / Swipe Queue
│   ├── Swiping for Regret/Satisfaction
├── Home / Resources
│   ├── Educational Content
├── Home / Profile
│   ├── Profile Summary
│   ├── Full Purchase History
│   ├── Full Verdict History
│   ├── Onboarding Quiz
│   ├── Email Syncing
│   ├── Tour of the app
│   ├── Preferences (language, theme, currency, etc.)
│   └── Logout
├── Home / About
│   ├── About the app
│   ├── Privacy Policy
│   ├── Terms of Service
│   ├── Contact Us
│   ├── FAQ
│   └── Logout
```

---

## 6. State Transitions
<!-- Document key state machines: e.g., order states, user account states -->

| Current State | Event | Next State | Implemented |
|--------------|-------|------------|-------------|
| Guest User | Sign up / sign in with email + password | Registered User | ✅ done |
| Guest User | Complete the short quiz to improve verdict accuracy | Guest User | ❌ not yet |
| Guest User | Enter purchase details for instant verdict (no account) | Guest User | ❌ not yet |
| Guest User | Try to access protected route (`/`, `/swipe`, `/profile`) | Guest User (redirect to `/auth`) | ✅ done |
| Registered User | Complete or edit onboarding/profile answers | Registered User | ✅ done |
| Registered User | Submit purchase decision form and receive verdict | Registered User | ✅ done |
| Registered User | Mark verdict decision (`bought` / `hold` / `skip`) | Registered User | ✅ done |
| Registered User | Add / edit / delete purchases | Registered User | ✅ done |
| Registered User | Swipe for regret/satisfaction (including undo) | Registered User | ✅ done |
| Registered User | View purchase stats | Registered User | ✅ done |
| Registered User | View verdict history | Registered User | ✅ done |
| Registered User | Import purchases from email | Registered User | ❌ not yet |
| Registered User | Logout | Guest User | ✅ done |

---

## 7. API Interaction Points
<!-- Where does the frontend call the backend? Map UI actions to API endpoints. -->

| UI Action | Method | Endpoint / Service Call | Notes | Implemented |
|-----------|--------|--------------------------|-------|-------------|
| Sign in | Supabase Auth | `supabase.auth.signInWithPassword` | Email/password auth in `App.tsx` | ✅ done |
| Sign up | Supabase Auth | `supabase.auth.signUp` | Email/password signup in `App.tsx` | ✅ done |
| Logout | Supabase Auth | `supabase.auth.signOut` | Session reset to guest | ✅ done |
| Sync user record on auth | Supabase Table | `upsert users` via `supabase.from('users').upsert(...)` | Updates `last_active` and email | ✅ done |
| Generate verdict | OpenAI + Supabase | `evaluatePurchase()` -> `fetch /v1/chat/completions`, then `insert verdicts` | Uses fallback scoring when API key missing/fails | ✅ done |
| Load verdict history | Supabase Table | `select verdicts` | Used by Dashboard/Profile | ✅ done |
| Update verdict decision | Supabase Table + RPC | `update verdicts` + `rpc add_purchase` (when bought) | Also removes verdict-linked purchase on reversal | ✅ done |
| Create purchase | Supabase RPC | `rpc add_purchase` | Manual purchase creation flow | ✅ done |
| Load purchases | Supabase Table | `select purchases` | Purchase history in Profile | ✅ done |
| Update / delete purchase | Supabase Table | `update purchases`, `delete purchases` | Deletion also updates linked verdict decision | ✅ done |
| Load swipe queue | Supabase Table | `select swipe_schedules` (+ joined purchase) | Supports due + upcoming queue | ✅ done |
| Create swipe | Supabase Table | `insert swipes`, `update swipe_schedules.completed_at` | Regret/satisfied/not_sure | ✅ done |
| Undo swipe | Supabase Table | `delete swipes`, `update swipe_schedules.completed_at = null` | 3s undo toast window | ✅ done |
| Load dashboard stats | Supabase Table | `select swipes`, `select verdicts` (hold status) | Computes completed swipes, regret rate, active holds | ✅ done |
| Share verdict to social media or save as image | REST API | `POST /api/share` | Share endpoint not implemented in current scripts | ❌ not yet |
| View educational content | REST API | `GET /api/educational-content` | No educational-content API route in current scripts | ❌ not yet |
| View settings | REST API | `GET /api/settings` | No settings API route in current scripts | ❌ not yet |

---

## 8. Error Handling & Edge Cases

Use short, action-oriented status messages in the existing `.status` banner pattern (`error` / `success` / `info`). Prefer recoverable guidance over technical jargon.

### 8.1 Implemented Error Messages (Current Scripts)

| Flow | Trigger / Edge Case | User-Facing Message | Recovery Action | Implemented |
|------|----------------------|---------------------|-----------------|-------------|
| Auth | Missing Supabase env vars | `Missing Supabase config. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Vite environment.` | Add env vars and restart app | ✅ done |
| Auth | Sign-in / sign-up failure | Supabase error message (`error.message`) | Retry credentials or sign up flow | ✅ done |
| Auth | Sign-out success | `Signed out.` | Redirect via auth guard to `/auth` | ✅ done |
| Dashboard | Empty title on verdict form | `Item title is required.` | Fill required input | ✅ done |
| Dashboard/Profile | Supabase mutation errors | Raw service error string (`setStatus(error)`) | Retry action; keep form state | ✅ done |
| Profile | Profile row missing + no email | `Profile not found and user email is missing.` | Re-authenticate or support path | ✅ done |
| Profile | Profile creation conflict | `Profile sync issue. Please contact support or try signing out and back in.` | Re-login; admin data repair if needed | ✅ done |
| Profile | Profile fetch catch-all | `Profile load error: <message>` | Retry and verify session | ✅ done |
| Profile | Invalid budget input | `Weekly fun budget must be a positive number.` | Correct input and resubmit | ✅ done |
| Profile | Invalid purchase fields | `Purchase title is required.` / `Purchase price must be a positive number.` / `Purchase date is required.` | Fix validation errors | ✅ done |
| Profile | Failed list loads | `Unable to load verdicts from Supabase. Check RLS policies.` / `Unable to load purchases from Supabase. Check RLS policies.` | Verify DB policies/session | ✅ done |
| Swipe | Queue fetch failure | `Failed to load purchases.` | Retry via refresh/reload | ✅ done |
| Swipe | Undo failure | `Failed to undo.` | Retry while item remains in context | ✅ done |
| Swipe | Swipe creation/update failure | Service error (`setStatus(error)`) | Retry swipe | ✅ done |

### 8.2 Edge Cases To Handle Explicitly Next

| Area | Edge Case | Recommended Message | Recommended Behavior | Implemented |
|------|-----------|---------------------|----------------------|-------------|
| OpenAI verdicting | API timeout / provider outage | `Verdict service is slow right now. Showing a fallback recommendation.` | Return deterministic fallback verdict; keep interaction under 8s | ⚠️ partial (fallback exists, message not explicit) |
| Network | Offline / transient network error | `You appear offline. Check your connection and try again.` | Detect offline state; disable submit buttons temporarily | ❌ not yet |
| Session | Expired/invalid auth session on protected actions | `Your session expired. Please sign in again.` | Force sign-out and redirect to `/auth` | ❌ not yet |
| Data consistency | Duplicate swipe attempt | `This purchase was already rated.` | Keep current index unchanged; show non-blocking info | ⚠️ partial (duplicate handled in service, message generic) |
| Profile bootstrap | Newly created profile not queryable immediately | `Profile created, but still syncing. Please refresh in a moment.` | Auto-retry fetch once before showing message | ⚠️ partial (message exists, no auto-retry) |
| Feature availability | Not-yet endpoints (`/api/share`, educational content API, settings API) | `This feature is coming soon.` | Hide unsupported actions or show disabled CTA with tooltip | ❌ not yet |

### 8.3 Messaging Rules

- Keep messages under ~120 characters when possible.
- State the problem first, then the next step.
- Avoid exposing internal schema/table names to end users (replace RLS-specific wording in production UI).
- For recoverable operations, preserve user input and scroll position.
- For irreversible actions (delete purchase/verdict), show confirm step before mutation.
