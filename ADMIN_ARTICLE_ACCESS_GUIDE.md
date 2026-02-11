# Admin Article Access Guide

This guide explains how to access the admin editor and create, edit, publish, unpublish, and delete articles.

## 1) Prerequisites

- Supabase local stack is running.
- Web app dependencies are installed.
- API app dependencies are installed.
- Your account email is listed as an admin email.
- (Optional) Example articles can be seeded from `seed_resources.sql`.

## 2) Configure Environment Variables

### `apps/web/.env`

Set these values:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<your_anon_key>
VITE_OPENAI_API_KEY=<optional_for_verdict_features>
VITE_API_BASE_URL=http://localhost:3000
VITE_ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

### `apps/api/.env`

Set these values:

```bash
PORT=3000
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
ADMIN_EMAILS=admin1@example.com,admin2@example.com
CORS_ORIGINS=http://localhost:5173
RESOURCES_IMAGE_BUCKET=resource-images
```

## 3) Start Required Services

From repo root:

```bash
# terminal 1
npm run dev:api

# terminal 2
npm run dev:web
```

Optional health check:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{"status":"ok"}
```

## 4) Seed Example Articles (Optional)

To populate the database with example articles about impulse buying and post-purchase dissonance:

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f seed_resources.sql
```

Or using Supabase CLI:

```bash
supabase db execute --file seed_resources.sql
```

This creates 5 published articles covering:
- Neurobiology of impulse acquisition
- Cognitive dissonance and regret
- Choice architecture in e-commerce
- The Halo Effect in product valuation
- Pre-commitment mitigation strategies

## 5) Sign In as Admin

1. Open the web app (`http://localhost:5173`).
2. Sign in with an email included in both:
   - `VITE_ADMIN_EMAILS` (frontend visibility)
   - `ADMIN_EMAILS` (backend authorization)
3. Click the **Admin** nav item.
4. Open `/admin/resources`.

If the Admin tab is missing, your signed-in email is not in `VITE_ADMIN_EMAILS`.

## 6) Create or Edit an Article

In **Admin Article Editor**:

- **New article**: click **New article** and fill form fields.
- **Edit article**: click **Edit** on an existing card.

### Field Reference

#### Required Fields

| Field | Description |
|-------|-------------|
| **Slug** | URL-friendly identifier (e.g., `impulse-buying-framework`). Used in the URL: `/resources/impulse-buying-framework`. Should be unique and lowercase with hyphens. |
| **Title** | The article headline displayed on the article page and in listings. |
| **Summary** | A short description/teaser of the article. Shown in article cards and SEO meta descriptions. |
| **Body content** | The main article content written in Markdown. Supports rich formatting (headings, lists, images, links, etc.). |
| **Category** | Broad classification (e.g., "Finance", "Psychology"). Used for grouping/filtering articles. |
| **Tags** | Array of keywords (e.g., `["budgeting", "saving"]`). Used for related content suggestions and search. |

#### Recommended Fields

| Field | Description |
|-------|-------------|
| **Canonical URL** | If the article was originally published elsewhere, this is the original source URL. Helps with SEO to avoid duplicate content penalties. |
| **Reading time** | Auto-calculated from word count at 200 WPM (words per minute). Displayed to users (e.g., "5 min read"). |
| **Cover image URL** | Featured image shown at the top of the article and in article cards/listings. |
| **CTA URL** | "Call to Action" link. Where you want readers to go after reading (e.g., sign-up page, related tool, external link). |

#### System Fields (auto-managed)

| Field | Description |
|-------|-------------|
| **is_published** | Boolean flag. `true` = visible in public `/resources` listing, `false` = draft/only admin visible. |
| **published_at** | Timestamp when the article was first published. Set automatically when you click **Publish**. |
| **created_at** | When the article row was first created. |
| **updated_at** | Last modification timestamp. |

Click **Save** to create/update the article as a draft.

## 7) Publish and Unpublish

- Click **Publish** to make article publicly visible in `/resources`.
- Click **Unpublish** to hide it from public listing.

Publishing sets `is_published=true` and `published_at` timestamp.

## 8) Delete an Article

1. Open article in editor.
2. Click **Delete**.
3. Confirm the dialog.

Deletion is permanent and removes the row from `resources`.

## 9) Upload Images in Editor

Use the image button in the rich text toolbar.

Allowed formats:

- PNG
- JPEG
- GIF

Uploads are stored in Supabase Storage bucket `resource-images`.

If upload fails, ensure bucket exists and is publicly readable.

## 10) Common Troubleshooting

### "Failed to fetch"

Usually means API is not reachable.

Check:

- `apps/api` is running on `3000`
- `VITE_API_BASE_URL=http://localhost:3000`
- CORS origin includes `http://localhost:5173`

### "Admin access required"

Your email is not in backend `ADMIN_EMAILS`.

### "Missing or invalid Authorization header"

Session expired or request sent without token. Sign out and sign in again.

### "Cannot DELETE /admin/resources/:id" (404)

API process is outdated or route not loaded. Restart `apps/api`.

### No articles shown in Admin list

Check API logs for Supabase credentials and auth errors, then verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## 11) Verification Checklist

- [ ] Admin tab visible after sign in
- [ ] Can save draft article
- [ ] Can publish and see article in `/resources`
- [ ] Can unpublish and hide article from `/resources`
- [ ] Can delete article
- [ ] Image upload works in editor
