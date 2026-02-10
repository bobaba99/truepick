# Backend Guidelines

## 1. Project Structure

Current backend is Supabase-first. `apps/web` talks directly to Supabase (tables + RPC), with a minimal Express scaffold in `apps/api`.

```
supabase/
├── migrations/                    # Schema, RLS, SQL functions
│   ├── 20260123050136_initial_schema.sql
│   └── 20260129032546_vendor_data.sql
├── seed.sql                       # Local/dev seed data
└── config.toml                    # Supabase local config

apps/api/src/
└── index.ts                       # Express app (currently only /health)

apps/web/src/api/
├── supabaseClient.ts              # Supabase client bootstrap
├── userProfileService.ts
├── userValueService.ts
├── purchaseService.ts
├── swipeService.ts
├── statsService.ts
├── verdictService.ts
├── verdictContext.ts
└── embeddingService.ts
```

---

## 2. API Design

### 2.1 Style
- Primary API is **Supabase PostgREST + RPC**, not custom REST controllers.
- Web client calls:
  - `supabase.from('<table>')` for CRUD
  - `supabase.rpc('<function>')` for protected write operations
  - `fetch(...)` only for OpenAI APIs

### 2.2 Versioning
- Database schema versioning is migration-based (`supabase/migrations/*.sql`).
- No `/api/v1` routing contract currently required for app behavior.

### 2.3 Backend Contract Used by Frontend

**Tables read/written by `apps/web`:**
- `users`
- `user_values`
- `purchases`
- `swipe_schedules`
- `swipes`
- `purchase_stats`
- `verdicts`
- `vendors`

**RPCs required by frontend services:**
- `add_user_value`
- `add_purchase`

**External API calls from frontend today:**
- `POST https://api.openai.com/v1/chat/completions`
- `POST https://api.openai.com/v1/embeddings`

### 2.4 Service Return Patterns (Current)
- Read flows: throw on Supabase error (e.g. `getUserProfile`, `getPurchaseHistory`)
- Mutations: return `{ error: string | null }`
- Keep this behavior consistent unless all callers are migrated together.

---

## 3. Authentication & Authorization

### 3.1 Auth Flow
- Supabase Auth (email/password) is used from `apps/web/src/App.tsx`.
- Session is read via `supabase.auth.getSession()` and subscribed via `onAuthStateChange`.

### 3.2 Authorization
- Access control is enforced at DB layer with RLS.
- Policies are scoped to owner checks such as:
  - `(select auth.uid()) = id`
  - `(select auth.uid()) = user_id`
- Keep owner checks in both `USING` and `WITH CHECK` clauses where applicable.

### 3.3 Roles
- No RBAC model is implemented yet.
- Current model is user-owned rows only.

---

## 4. Database

### 4.1 Data Access Strategy
- No ORM in runtime path.
- SQL schema + constraints + RLS + RPC functions are the source of truth.

### 4.2 Migrations
- Create schema changes in new SQL migration files under `supabase/migrations/`.
- Do not edit previous migrations after shared usage without explicit migration strategy.

### 4.3 Seeding
- Vendor and baseline data are seeded via:
  - `supabase/seed.sql`
  - `20260129032546_vendor_data.sql`

### 4.4 Naming Conventions
- Tables/columns: `snake_case`
- Indexes: `idx_<table>_<purpose>`
- Policy names: `<table>_<action>_own`
- SQL function parameters: `p_<name>`

### 4.5 Critical Constraints Expected by Frontend
- Unique swipe per schedule and timing (`swipes` uniqueness rules)
- Unique purchase per verdict link (`idx_purchases_verdict_unique`)
- `purchase_stats`, `swipe_schedules`, `verdicts` filtered heavily by `user_id`

---

## 5. Error Handling

### 5.1 Database-Level
- Use explicit constraints/checks in schema to fail invalid writes early.
- Keep RPC functions defensive (auth checks + validation + deterministic errors).

### 5.2 Service-Level
- For read APIs: throw errors with actionable messages.
- For mutation APIs: return `{ error }` so UI can render inline status safely.

### 5.3 Logging
- Current logging is console-based in web/api services.
- Include operation context in logs (`userId`, table/function name, action).
- Never log secrets or raw auth tokens.

---

## 6. Validation

- Validate at boundaries:
  - client form checks for UX
  - DB constraints and RPC guards for correctness/security
- For new Express endpoints, use schema validation (Zod recommended).
- Keep enum/domain values aligned with DB enums and frontend union types.

---

## 7. Testing Strategy

| Level | Tool | Scope |
|-------|------|-------|
| SQL / DB integration | Supabase local stack | RLS, RPC behavior, constraints, migration correctness |
| Service integration | Vitest (recommended) | `apps/web/src/api/*` against local Supabase |
| E2E | Playwright (recommended) | Auth + purchase + swipe + verdict full flows |

### 7.1 Test Database
- Use local Supabase (`supabase start`) with migrations + seed data.
- Prefer deterministic fixtures over ad-hoc manual data.

---

## 8. Security Checklist
- [ ] RLS enabled on every user data table
- [ ] Policies use `(select auth.uid())` pattern
- [ ] Mutating actions constrained by `user_id` ownership
- [ ] Secrets only in environment variables
- [ ] OpenAI key not exposed to untrusted clients in production architecture
- [ ] No plaintext storage of OAuth tokens (`email_connections` fields must remain encrypted)
- [ ] Avoid `service_role` key usage in browser runtime

---

## 9. Environment & Configuration

Required for web runtime:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_OPENAI_API_KEY=
```

Required for API scaffold:

```
PORT=3000
```

Notes:
- Missing Supabase envs should fail clearly (already warned in client bootstrap).
- For production, move OpenAI calls to server/edge to avoid exposing API keys.

---

## 10. Deployment

### 10.1 Current
- Supabase hosts DB/Auth/Storage/Realtime.
- `apps/api` is currently optional for app functionality (`/health` only).

### 10.2 Release Rules
- Run migrations before frontend rollout that depends on new columns/policies/functions.
- Treat RLS policy changes as high-risk; validate with representative user queries.
- Keep `apps/web/src/api` contracts in sync with migration changes.
