import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { createClient } from '@supabase/supabase-js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

const supabaseUrl = process.env.SUPABASE_URL ?? ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const adminEmails = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

const requireAdmin = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    res.status(401).json({ error: 'Missing or invalid Authorization header.' })
    return
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({ error: 'Server misconfigured: missing Supabase credentials.' })
    return
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)
  if (error || !user?.email) {
    res.status(401).json({ error: 'Invalid or expired token.' })
    return
  }
  if (adminEmails.length > 0 && !adminEmails.includes(user.email.toLowerCase())) {
    res.status(403).json({ error: 'Admin access required.' })
    return
  }
  ;(req as express.Request & { adminUser: { id: string; email: string } }).adminUser = {
    id: user.id,
    email: user.email,
  }
  next()
}

const supabase = () => createClient(supabaseUrl, supabaseServiceKey)

type ResourceUpsertBody = {
  slug: string
  title: string
  summary: string
  bodyMarkdown: string
  tags: string[]
  readingTimeMinutes: number | null
  canonicalUrl: string | null
  coverImageUrl: string | null
  ctaUrl: string | null
  isPublished: boolean
  publishedAt: string | null
}

const toDbRow = (row: Record<string, unknown>) => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  summary: row.summary,
  body_markdown: row.body_markdown,
  tags: row.tags ?? [],
  reading_time_minutes: row.reading_time_minutes,
  canonical_url: row.canonical_url,
  cover_image_url: row.cover_image_url,
  cta_url: row.cta_url,
  is_published: row.is_published ?? false,
  published_at: row.published_at,
  created_at: row.created_at,
  updated_at: row.updated_at,
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/admin/resources', requireAdmin, async (_req, res) => {
  const { data, error } = await supabase()
    .from('resources')
    .select('id, slug, title, summary, body_markdown, tags, reading_time_minutes, canonical_url, cover_image_url, cta_url, is_published, published_at, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json({ data: (data ?? []).map(toDbRow) })
})

app.post('/admin/resources', requireAdmin, async (req, res) => {
  const body = req.body as ResourceUpsertBody
  const adminUser = (req as express.Request & { adminUser: { id: string } }).adminUser
  const now = new Date().toISOString()
  const publishedAt = body.isPublished ? (body.publishedAt ?? now) : null

  // Validate required fields
  if (!body.slug?.trim()) {
    res.status(400).json({ error: 'Slug is required.' })
    return
  }
  if (!body.title?.trim()) {
    res.status(400).json({ error: 'Title is required.' })
    return
  }
  if (!body.summary?.trim()) {
    res.status(400).json({ error: 'Summary is required.' })
    return
  }
  if (!body.bodyMarkdown?.trim()) {
    res.status(400).json({ error: 'Body content is required.' })
    return
  }
  if (!Array.isArray(body.tags) || body.tags.length === 0) {
    res.status(400).json({ error: 'At least one tag is required.' })
    return
  }
  const { data, error } = await supabase()
    .from('resources')
    .insert({
      slug: body.slug.trim(),
      title: body.title.trim(),
      summary: body.summary.trim(),
      body_markdown: body.bodyMarkdown.trim(),
      tags: body.tags,
      reading_time_minutes: body.readingTimeMinutes ?? null,
      canonical_url: body.canonicalUrl?.trim() || null,
      cover_image_url: body.coverImageUrl?.trim() || null,
      cta_url: body.ctaUrl?.trim() || null,
      is_published: body.isPublished ?? false,
      published_at: publishedAt,
      created_by: adminUser.id,
      updated_by: adminUser.id,
    })
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json({ data: toDbRow(data) })
})

app.put('/admin/resources/:resourceId', requireAdmin, async (req, res) => {
  const { resourceId } = req.params
  const body = req.body as ResourceUpsertBody
  const adminUser = (req as express.Request & { adminUser: { id: string } }).adminUser
  const now = new Date().toISOString()
  const publishedAt = body.isPublished ? (body.publishedAt ?? now) : null

  // Validate required fields
  if (!body.slug?.trim()) {
    res.status(400).json({ error: 'Slug is required.' })
    return
  }
  if (!body.title?.trim()) {
    res.status(400).json({ error: 'Title is required.' })
    return
  }
  if (!body.summary?.trim()) {
    res.status(400).json({ error: 'Summary is required.' })
    return
  }
  if (!body.bodyMarkdown?.trim()) {
    res.status(400).json({ error: 'Body content is required.' })
    return
  }
  if (!Array.isArray(body.tags) || body.tags.length === 0) {
    res.status(400).json({ error: 'At least one tag is required.' })
    return
  }
  const { data, error } = await supabase()
    .from('resources')
    .update({
      slug: body.slug.trim(),
      title: body.title.trim(),
      summary: body.summary.trim(),
      body_markdown: body.bodyMarkdown.trim(),
      tags: body.tags,
      reading_time_minutes: body.readingTimeMinutes ?? null,
      canonical_url: body.canonicalUrl?.trim() || null,
      cover_image_url: body.coverImageUrl?.trim() || null,
      cta_url: body.ctaUrl?.trim() || null,
      is_published: body.isPublished ?? false,
      published_at: publishedAt,
      updated_by: adminUser.id,
      updated_at: now,
    })
    .eq('id', resourceId)
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json({ data: toDbRow(data) })
})

app.post('/admin/resources/:resourceId/publish', requireAdmin, async (req, res) => {
  const { resourceId } = req.params
  const now = new Date().toISOString()

  const { data, error } = await supabase()
    .from('resources')
    .update({ is_published: true, published_at: now })
    .eq('id', resourceId)
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json({ data: toDbRow(data) })
})

app.post('/admin/resources/:resourceId/unpublish', requireAdmin, async (req, res) => {
  const { resourceId } = req.params

  const { data, error } = await supabase()
    .from('resources')
    .update({ is_published: false, published_at: null })
    .eq('id', resourceId)
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json({ data: toDbRow(data) })
})

app.delete('/admin/resources/:resourceId', requireAdmin, async (req, res) => {
  const { resourceId } = req.params

  const { error } = await supabase()
    .from('resources')
    .delete()
    .eq('id', resourceId)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.status(204).send()
})

const RESOURCE_IMAGES_BUCKET = 'resource-images'

app.post(
  '/admin/resources/upload-image',
  requireAdmin,
  upload.single('image'),
  async (req, res) => {
    const file = req.file
    if (!file) {
      res.status(400).json({ error: 'No image file provided.' })
      return
    }
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif']
    if (!allowedTypes.includes(file.mimetype)) {
      res.status(400).json({ error: 'Invalid image type. Allowed: PNG, JPEG, GIF.' })
      return
    }

    const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/gif' ? 'gif' : 'jpg'
    const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { data, error } = await supabase().storage
      .from(RESOURCE_IMAGES_BUCKET)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    const { data: urlData } = supabase().storage.from(RESOURCE_IMAGES_BUCKET).getPublicUrl(data.path)
    res.json({ url: urlData.publicUrl })
  }
)

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`)
})
