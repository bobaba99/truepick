/**
 * Seed script: reads markdown files from content/resources/, converts to HTML,
 * and upserts into the Supabase `resources` table.
 *
 * Usage:
 *   npx tsx temp/seed-resources.ts              # upsert all articles
 *   npx tsx temp/seed-resources.ts --dry-run    # preview without writing to DB
 *   npx tsx temp/seed-resources.ts --file my-article.md   # seed a single file
 *
 * Env: reads apps/api/.env for SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { marked } from 'marked'
import { createClient } from '@supabase/supabase-js'

// ── Config ──────────────────────────────────────────────────────────────────

const SCRIPT_DIR = typeof import.meta.dirname === 'string'
  ? import.meta.dirname
  : dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(SCRIPT_DIR, '..')
const CONTENT_DIR = join(ROOT, 'content', 'resources')
const ENV_PATH = join(ROOT, 'apps', 'api', '.env')

const WORDS_PER_MINUTE = 200

// ── Env loading ─────────────────────────────────────────────────────────────

function loadEnv(path: string): Record<string, string> {
  const env: Record<string, string> = {}
  try {
    const lines = readFileSync(path, 'utf-8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
      env[key] = val
    }
  } catch {
    console.error(`Failed to read env file at ${path}`)
    process.exit(1)
  }
  return env
}

// ── Types ───────────────────────────────────────────────────────────────────

type ArticleFrontmatter = {
  slug: string
  title: string
  summary: string
  tags: string[]
  cover_image_url?: string | null
  cta_url?: string | null
  is_published?: boolean
}

type ArticleRow = {
  slug: string
  title: string
  summary: string
  body_markdown: string
  tags: string[]
  reading_time_minutes: number
  cover_image_url: string | null
  cta_url: string | null
  is_published: boolean
  published_at: string | null
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ')
}

function calculateReadingTime(title: string, summary: string, bodyHtml: string): number {
  const text = `${title} ${summary} ${stripHtml(bodyHtml)}`
  const wordCount = text.trim().split(/\s+/).filter((w) => w.length > 0).length
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE))
}

function parseArticle(filePath: string): ArticleRow {
  const raw = readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)
  const fm = data as ArticleFrontmatter

  if (!fm.slug?.trim()) throw new Error(`Missing 'slug' in frontmatter: ${filePath}`)
  if (!fm.title?.trim()) throw new Error(`Missing 'title' in frontmatter: ${filePath}`)
  if (!fm.summary?.trim()) throw new Error(`Missing 'summary' in frontmatter: ${filePath}`)
  if (!Array.isArray(fm.tags) || fm.tags.length === 0) {
    throw new Error(`'tags' must be a non-empty array: ${filePath}`)
  }

  const bodyHtml = marked.parse(content.trim(), { async: false }) as string
  const isPublished = fm.is_published ?? false
  const readingTime = calculateReadingTime(fm.title, fm.summary, bodyHtml)

  return {
    slug: fm.slug.trim(),
    title: fm.title.trim(),
    summary: fm.summary.trim(),
    body_markdown: bodyHtml,
    tags: fm.tags,
    reading_time_minutes: readingTime,
    cover_image_url: fm.cover_image_url?.trim() || null,
    cta_url: fm.cta_url?.trim() || null,
    is_published: isPublished,
    published_at: isPublished ? new Date().toISOString() : null,
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const fileFlag = args.indexOf('--file')
  const singleFile = fileFlag !== -1 ? args[fileFlag + 1] : null

  // Discover markdown files (skip _template.md)
  const allFiles = readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .sort()

  const targetFiles = singleFile
    ? allFiles.filter((f) => f === singleFile)
    : allFiles

  if (targetFiles.length === 0) {
    console.log('No article files found in content/resources/.')
    console.log('Create .md files using _template.md as a reference.')
    process.exit(0)
  }

  console.log(`Found ${targetFiles.length} article(s) to process.\n`)

  // Parse all articles first (fail fast on validation errors)
  const articles: ArticleRow[] = []
  for (const file of targetFiles) {
    try {
      const article = parseArticle(join(CONTENT_DIR, file))
      articles.push(article)
      const status = article.is_published ? 'PUBLISH' : 'DRAFT'
      console.log(`  [${status}] ${file} -> /${article.slug} (${article.reading_time_minutes} min read)`)
    } catch (err) {
      console.error(`  [ERROR] ${file}: ${(err as Error).message}`)
      process.exit(1)
    }
  }

  if (dryRun) {
    console.log('\n--dry-run: No database writes. Preview above.')
    return
  }

  // Load env and create Supabase client with service role key
  const env = loadEnv(ENV_PATH)
  const supabaseUrl = env.SUPABASE_URL
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/api/.env')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log(`\nUpserting ${articles.length} article(s) to Supabase...`)

  const { data, error } = await supabase
    .from('resources')
    .upsert(articles, { onConflict: 'slug' })
    .select('slug, title, is_published')

  if (error) {
    console.error('Supabase upsert failed:', error.message)
    process.exit(1)
  }

  console.log(`\nDone! ${(data ?? []).length} article(s) upserted:`)
  for (const row of data ?? []) {
    const status = row.is_published ? 'published' : 'draft'
    console.log(`  - ${row.slug} (${status})`)
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
