# Supabase — Local Development

## Quick Start

```bash
supabase start          # Start local Supabase stack (Docker)
supabase db reset       # Drop, re-apply all migrations, then run seed.sql
supabase stop           # Stop containers
```

## Directory Layout

```
supabase/
├── config.toml         # Supabase CLI config (ports, auth, storage, etc.)
├── seed.sql            # Dev seed: test user, purchases, swipe schedules, user values
├── seed_resources.sql  # Dev seed: example educational articles (not auto-loaded)
├── migrations/         # Ordered SQL migrations (applied alphabetically by filename)
│   ├── 20260214095341_extentions_and_enums.sql
│   ├── 20260214095402_core_domain_tables.sql
│   ├── 20260214095417_ingestion_tables.sql
│   ├── 20260214095432_indexes.sql
│   ├── 20260214095447_rls_policies.sql
│   ├── 20260214095506_functions_triggers_and_compat.sql
│   ├── 20260214095510_vendor_data.sql
│   └── 20260226031310_add_heuristic_fallback_scoring_model.sql
└── snippets/           # Ad-hoc SQL for manual testing in Supabase Studio
    ├── Test: example articles.sql
    └── Test: past purchases.sql
```

## Migrations

Migrations run in timestamp order. Each file is idempotent within a fresh
`supabase db reset` but is only applied once on `supabase db push` (tracked in
`supabase_migrations.schema_migrations`).

| Migration | Purpose |
|-----------|---------|
| `095341_extentions_and_enums` | pgcrypto extension, all custom enum types |
| `095402_core_domain_tables` | users, purchases, swipes, verdicts, vendors, resources, etc. |
| `095417_ingestion_tables` | email_connections, ocr_receipts for receipt ingestion |
| `095432_indexes` | Performance indexes for high-frequency queries |
| `095447_rls_policies` | Row Level Security policies (all tables) |
| `095506_functions_triggers_and_compat` | Auth-scoped helper functions, triggers, compatibility views |
| `095510_vendor_data` | Seed vendor catalog (INSERT into vendors table) |
| `031310_add_heuristic_fallback_scoring_model` | Add `heuristic_fallback` to verdicts.scoring_model check |

## Seed Files

- **seed.sql** — Loaded automatically on `supabase db reset` (configured in `config.toml` under `[db.seed]`). Creates a test user profile, 20 past purchases, swipe schedules, and user values.
- **seed_resources.sql** — Educational articles. Not auto-loaded. Run manually:
  ```bash
  psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/seed_resources.sql
  ```

## Adding a New Migration

```bash
supabase migration new <descriptive_name>
# Edit the generated file in supabase/migrations/
supabase db reset   # Test locally
```

## Connecting to Remote

```bash
supabase link --project-ref <project-id>
supabase db push    # Apply pending migrations to remote
```
