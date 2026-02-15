# User Preferences in Profile + App-Wide Consumption Implementation Plan

## Summary
Implement a first-version user preference system centered on `apps/web/src/pages/Profile.tsx`, with app-wide application for theme and formatting:
- Preferences in V1: `theme` (`light | dark | system`), `currency`, `locale`.
- Persistence: `users.preferences` JSONB.
- Behavior: currency is display-formatting only (no value conversion), theme applies app-wide including auth routes.
- Architecture: app-level preferences provider + shared formatting utilities + Profile editing UI.

## Public API / Interface Changes
1. Database (`users` table)
- Add `preferences jsonb` column.
- Store shape:
  - `theme: 'light' | 'dark' | 'system'`
  - `currency: string` (ISO-4217 code)
  - `locale: string` (BCP-47 locale tag)

2. Frontend domain types
- Add `UserPreferences` and `ThemeMode` in `apps/web/src/constants/userTypes.ts` (or a dedicated `userPreferences` constants file).
- Extend `UserRow` with optional `preferences`.

3. Profile service contract
- Update `apps/web/src/api/user/userProfileService.ts`:
  - `getUserProfile()` select includes `preferences`.
  - `UpdateUserProfileInput` includes `preferences`.
  - `updateUserProfile()` maps `preferences` to payload.

## Implementation Plan

### 1. Schema + migration
1. Create new migration in `supabase/migrations/` to add `users.preferences jsonb`.
2. Add conservative check constraint for valid JSON object shape where practical (at least `theme` enum guard).
3. Keep nullable support for backward compatibility with existing rows.

### 2. Preferences normalization and defaults
1. Create shared preference utility module (for example `apps/web/src/utils/userPreferences.ts`).
2. Implement:
- `normalizeUserPreferences(raw)`
- `resolveBrowserLocale()`
- `inferCurrencyFromLocale(locale)` with USD fallback
- `resolveEffectiveTheme(theme, systemPrefersDark)`
3. Defaults when no saved value:
- `theme = 'system'`
- `locale = navigator.language` (fallback `en-US`)
- `currency = inferred from locale or 'USD'`

### 3. App-wide provider and theme application
1. Add preferences context/provider module (for example `apps/web/src/preferences/UserPreferencesContext.tsx`).
2. In `apps/web/src/App.tsx`:
- Load user preferences once session is available.
- Expose preferences and refresh/update helpers via context.
- Apply resolved theme to document root (`data-theme="light|dark"`), including listening to OS theme changes when user preference is `system`.

### 4. Profile page preference editing
1. Update `apps/web/src/pages/Profile.tsx` to include draft + persisted preference state.
2. Add UI in the profile modal:
- Theme selector (`system/light/dark`)
- Currency dropdown (curated major currencies)
- Locale dropdown (curated common locales)
3. Extend existing save flow to persist preferences with profile details.
4. Show saved preferences in read-only profile summary area.

### 5. Formatting utility and adoption
1. Create shared format helpers (for example `apps/web/src/utils/formatters.ts`):
- `formatCurrencyAmount(amount, preferences)`
- `formatDate(value, preferences)`
- `formatDateTime(value, preferences)`
2. Replace hardcoded `$...toFixed(2)` and raw `toLocaleDateString()/toLocaleString()` in user-facing screens/components:
- `apps/web/src/pages/Profile.tsx`
- `apps/web/src/pages/Dashboard.tsx`
- `apps/web/src/pages/Swipe.tsx`
- `apps/web/src/pages/EmailSync.tsx`
- `apps/web/src/components/VerdictDetailModal.tsx`
3. Keep storage numeric values unchanged; only display formatting changes.

### 6. Styling for light/dark
1. Extend `apps/web/src/styles/App.css` and `apps/web/src/styles/index.css` with theme variable sets keyed by root theme attribute.
2. Add light-theme overrides for core surfaces (page background, cards, modal, inputs, text contrast) so both themes remain legible.
3. Keep dark theme as baseline, with light as explicit override.

### 7. Optional context consistency for verdict text prompts
1. Update budget text generation in:
- `apps/web/src/api/verdict/verdictService.ts`
- `apps/web/src/api/verdict/verdictContext.ts`
2. Replace hardcoded `$` with preference-aware formatting when composing user-facing/context strings.

## Test Cases and Scenarios
1. New user with no `preferences`:
- App resolves to `system` theme + browser locale + inferred currency (`USD` fallback).
2. Existing user with saved preferences:
- Theme applies on app load before entering Profile.
- Currency/date formatting reflects saved preferences across touched pages.
3. Profile save:
- Changing theme/currency/locale persists after refresh and new session.
- Existing profile fields (summary/budget/onboarding) continue to save correctly.
4. Theme mode behaviors:
- `light` always light, `dark` always dark, `system` tracks OS change.
5. Formatting safety:
- Invalid locale/currency falls back gracefully (no runtime crash).
6. Regression checks:
- `npm run lint` in `apps/web`
- `npm run build` in `apps/web`
- Manual verification of Profile, Dashboard, Swipe, EmailSync, verdict modal.

## Assumptions and Defaults
1. Multi-file change is allowed even though request references `Profile.tsx`.
2. No currency conversion is performed; amounts are only rendered with selected currency format.
3. Curated dropdown lists are sufficient for V1 (can expand later).
4. Plan is delivered inline in Plan Mode; writing it to `docs/plans/...` is deferred to implementation execution.
