# Resource Articles — Authoring & Publishing

## Quick Start

1. Copy the template:
   ```bash
   cp content/resources/_template.md content/resources/my-article-slug.md
   ```
2. Edit the frontmatter and write your article body in markdown.
3. Preview (no DB writes):
   ```bash
   npm run seed:resources:dry
   ```
4. Publish to Supabase:
   ```bash
   npm run seed:resources
   ```

## Directory Structure

```
content/
  INSTRUCTIONS.md          ← you are here
  resources/
    _template.md           ← frontmatter reference (skipped by seed script)
    my-article-slug.md     ← your article files
    another-article.md
```

## Frontmatter Reference

Every `.md` file in `content/resources/` must start with YAML frontmatter:

```yaml
---
slug: my-article-slug          # URL path: /resources/my-article-slug (required, unique)
title: "My Article Title"      # Display title (required)
summary: "One or two sentences shown on the resource list card." # (required)
tags:                          # At least one tag (required)
  - psychology
  - impulse-control
cover_image_url: null          # Optional cover image URL (or null)
cta_url: null                  # Optional call-to-action link (or null)
is_published: false            # true = live on /resources, false = draft (admin-only)
---
```

### Required Fields

| Field       | Rules                                         |
|-------------|-----------------------------------------------|
| `slug`      | 3-120 chars, URL-safe (lowercase, hyphens)    |
| `title`     | Non-empty string                              |
| `summary`   | Non-empty string                              |
| `tags`      | Array with at least one tag                   |

### Optional Fields

| Field             | Default | Notes                                      |
|-------------------|---------|--------------------------------------------|
| `cover_image_url` | `null`  | Public URL to a cover image                |
| `cta_url`         | `null`  | Link for the article's call-to-action      |
| `is_published`    | `false` | Set `true` to publish immediately          |

### Available Tags

From `apps/web/src/constants/resourceTags.ts`:

**Topics:** neuroscience, behavioral-economics, psychology, finance, self-regulation, cognitive-bias, marketing, consumer-behavior

**Concepts:** dopamine, cognitive-dissonance, regret, choice-architecture, nudge-theory, UX-design, halo-effect, pre-commitment, impulse-control, decision-making, habit-formation, spending-triggers, mental-accounting, loss-aversion, hyperbolic-discounting

**Practical:** money-saving, budgeting, financial-planning, mindfulness, productivity, minimalism, digital-wellness

## Commands

| Command                                         | What it does                                     |
|-------------------------------------------------|--------------------------------------------------|
| `npm run seed:resources:dry`                    | Parse and validate all articles, print summary   |
| `npm run seed:resources`                        | Upsert all articles to Supabase                  |
| `npm run seed:resources -- --file my-slug.md`   | Upsert a single file only                        |

## How It Works

1. The seed script (`temp/seed-resources.ts`) reads every `.md` file in `content/resources/` (files starting with `_` are skipped).
2. YAML frontmatter is parsed with `gray-matter`.
3. The markdown body is converted to HTML with `marked`.
4. Reading time is auto-calculated (~200 words/minute).
5. Each article is upserted into the Supabase `resources` table using `slug` as the conflict key — so re-running the script updates existing articles without creating duplicates.
6. The same HTML is rendered by the existing `ResourceDetail.tsx` page at `/resources/:slug`.

## Publishing Workflow

**Draft an article:**
Set `is_published: false` (the default). The article is saved to the database but only visible in the admin UI at `/admin/resources`.

**Publish an article:**
Set `is_published: true` and re-run `npm run seed:resources`. The article becomes visible on the public `/resources` page immediately.

**Update a published article:**
Edit the `.md` file and re-run `npm run seed:resources`. The upsert overwrites the existing row matched by slug.

**Unpublish an article:**
Change `is_published: true` to `false` and re-run the seed script, or use the admin UI toggle at `/admin/resources`.

## Writing Tips

- Use `##` for major sections (renders as `<h2>`), `###` for subsections.
- Keep paragraphs concise — the resource detail page uses the project's glassmorphism styling, which reads best with shorter blocks.
- Include a TruePick CTA near the end to connect the educational content back to the product.
- Aim for 800-1500 words (4-7 min read) for SEO value.
