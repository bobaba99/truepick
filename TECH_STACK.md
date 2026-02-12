# Technology Stack

## 1. Overview

For the fast deployment and the least hassle for the developers given prior experiences. The project is a TypeScript-first npm workspaces monorepo (`apps/web`, `apps/api`, `apps/mobile`, `packages/shared`) targeting web, mobile, and a lightweight API layer, all backed by Supabase.

---

## 2. Frontend

### Web (`apps/web`)

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Framework | React | ^19.2.0 | Component model, ecosystem, team familiarity |
| Language | TypeScript | ~5.9.3 | Strict typing across the entire monorepo |
| Routing | react-router-dom | ^7.13.0 | Declarative routing with auth guards via `<Outlet>` |
| Build Tool | Vite | ^7.2.4 | Fast HMR and ESM-native bundling |
| Styling | Plain CSS | — | Vanilla CSS in `src/styles/`; no CSS-in-JS or utility framework |
| Animation | GSAP | 3.12.5 | Loaded via CDN for custom cursor, scroll triggers, and motion components |
| State Management | React built-ins (`useState`, `useEffect`, `useMemo`) | — | No external state library; Supabase client is the remote source of truth |
| Supabase Client | @supabase/supabase-js | ^2.45.0 | Auth, DB reads/writes, and RPC calls directly from the browser |
| Testing | — | — | Not yet configured |

### Mobile (`apps/mobile`)

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Framework | React Native (Expo) | 0.81.5 / ~54.0.32 | Cross-platform mobile with managed workflow |
| Language | TypeScript | ~5.9.2 | Consistent with the rest of the monorepo |

---

## 3. Backend

### API Server (`apps/api`)

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Runtime / Framework | Express on Node.js | ^4.18.2 | Minimal REST scaffold; currently a health-check endpoint |
| Language | TypeScript (via tsx) | ~5.9.3 | Consistent tooling; `tsx watch` for dev |
| API Style | REST | — | Simple JSON endpoints |
| Authentication | Supabase Auth | — | Email/password sign-up and sign-in handled client-side via `@supabase/supabase-js` |
| Validation | — | — | Not yet configured (Zod recommended at boundaries) |
| Testing | — | — | Not yet configured |

### Supabase (BaaS)

Most backend logic runs through Supabase directly from the web client:

- **Auth** — email/password via Supabase Auth (JWT, refresh-token rotation)
- **Database** — Postgres (v17) with migrations in `supabase/migrations/`
- **Edge Runtime** — enabled (Deno 2) for serverless functions
- **Realtime** — enabled
- **Storage** — enabled (50 MiB file limit)
- **Analytics** — Postgres-backed analytics on port 54327

---

## 4. Database & Storage

| Layer | Technology | Notes |
|-------|-----------|-------|
| Database | PostgreSQL 17 (Supabase-managed) | Schema managed via SQL migrations in `supabase/migrations/` |
| Connection Pooler | Supabase PgBouncer | Transaction-mode pooling (disabled locally) |
| Seed Data | SQL | `supabase/seed.sql` loaded on `db reset` |
| Storage | Supabase Storage | S3-compatible protocol enabled |

---

## 5. Infrastructure & DevOps

| Concern | Technology | Notes |
|---------|-----------|-------|
| Hosting / Cloud | Supabase (hosted) | Auth, DB, Edge Functions, Storage |
| Local Dev | Supabase CLI | `supabase start` spins up Postgres, Auth, Studio, Inbucket locally |
| Containerization | — | Not yet configured |
| Orchestration | — | Not yet configured |
| CI/CD | — | Not yet configured |
| IaC | Supabase CLI config | `supabase/config.toml` defines all local/remote service settings |
| Monitoring | — | Not yet configured |
| Logging | Console | Client-side `console.error`/`console.warn` |
| Error Tracking | — | Not yet configured |

---

## 6. Third-Party Services & APIs

| Service | Provider | Purpose |
|---------|----------|---------|
| LLM Evaluation | OpenAI (`gpt-4o-mini`) | Purchase verdict reasoning via Chat Completions API |
| Receipt Parsing | OpenAI (`gpt-4o-mini`) | Extracting purchase data from email receipts |
| Embeddings | OpenAI (`text-embedding-3-small`) | Semantic similarity for purchase pattern matching |
| Gmail API | Google | OAuth2 + REST API for fetching purchase receipts |
| Email (local dev) | Inbucket | Captures outgoing auth emails locally on port 54324 |

---

## 7. Development Tools

| Tool | Purpose |
|------|---------|
| ESLint 9 + typescript-eslint + react-hooks + react-refresh | Linting |
| — | Formatting (not yet configured; Prettier recommended) |
| — | Git hooks (not yet configured; lint-staged + Husky recommended) |
| Supabase Studio | Local database GUI on port 54323 |
| npm workspaces | Monorepo dependency management |
| tsx | TypeScript execution and watch mode for `apps/api` |

---

## 8. Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      Monorepo (npm workspaces)          │
│                                                         │
│  apps/web (React + Vite)                                │
│    ├─ Supabase JS Client ──► Supabase Auth / DB / RPC   │
│    ├─ OpenAI fetch ────────► Chat Completions + Embed.  │
│    └─ Gmail API fetch ─────► OAuth + Receipt Import     │
│                                                         │
│  apps/mobile (Expo / React Native)                      │
│    └─ (scaffold)                                        │
│                                                         │
│  apps/api (Express)                                     │
│    └─ /health (scaffold)                                │
│                                                         │
│  packages/shared                                        │
│    └─ shared types / utilities (scaffold)               │
├─────────────────────────────────────────────────────────┤
│  Supabase Platform                                      │
│    ├─ PostgreSQL 17                                     │
│    ├─ Auth (email/password, JWT)                        │
│    ├─ Edge Functions (Deno 2)                           │
│    ├─ Realtime                                          │
│    └─ Storage (S3-compatible)                           │
└─────────────────────────────────────────────────────────┘
```
