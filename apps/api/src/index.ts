import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { PostHog } from 'posthog-node'
import { Resend } from 'resend'

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

const openaiApiKey = process.env.OPENAI_API_KEY ?? ''
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const holdReminderCronSecret = process.env.HOLD_REMINDER_CRON_SECRET ?? ''

const posthog = new PostHog(process.env.POSTHOG_API_KEY ?? '', {
  host: process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com',
  enableExceptionAutocapture: true,
})

process.on('SIGINT', async () => {
  await posthog.shutdown()
  process.exit(0)
})
process.on('SIGTERM', async () => {
  await posthog.shutdown()
  process.exit(0)
})

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

type AuthenticatedRequest = express.Request & { authUser: { id: string; email: string } }

const requireAuth = async (
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
  const sb = createClient(supabaseUrl, supabaseServiceKey)
  const {
    data: { user },
    error,
  } = await sb.auth.getUser(token)
  if (error || !user?.id) {
    res.status(401).json({ error: 'Invalid or expired token.' })
    return
  }
  ;(req as AuthenticatedRequest).authUser = {
    id: user.id,
    email: user.email ?? '',
  }
  posthog.identify({
    distinctId: user.id,
    properties: { email: user.email ?? '' },
  })
  next()
}

const rateLimits = new Map<string, number[]>()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 20

const rateLimitLLM = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const userId = (req as AuthenticatedRequest).authUser?.id
  if (!userId) {
    res.status(401).json({ error: 'Authentication required.' })
    return
  }

  const now = Date.now()
  const timestamps = (rateLimits.get(userId) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  )

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    posthog.capture({
      distinctId: userId,
      event: 'rate_limit_exceeded',
      properties: { endpoint: req.path, limit: RATE_LIMIT_MAX_REQUESTS, window_ms: RATE_LIMIT_WINDOW_MS },
    })
    res.status(429).json({
      error: 'Rate limit exceeded. Please wait a moment before trying again.',
    })
    return
  }

  timestamps.push(now)
  rateLimits.set(userId, timestamps)
  next()
}

setInterval(() => {
  const now = Date.now()
  for (const [userId, timestamps] of rateLimits.entries()) {
    const valid = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
    if (valid.length === 0) {
      rateLimits.delete(userId)
    } else {
      rateLimits.set(userId, valid)
    }
  }
}, 5 * 60 * 1000)

const DAILY_VERDICT_LIMIT_FREE = 3

const checkDailyVerdictLimit = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  const user = (req as AuthenticatedRequest).authUser
  const sb = supabase()

  // Regenerating an existing verdict doesn't consume a new daily slot.
  // Verify the ID belongs to this user before trusting it.
  const existingVerdictId = (req.body as Record<string, unknown>).existingVerdictId
  if (typeof existingVerdictId === 'string' && existingVerdictId.length > 0) {
    const { count } = await sb
      .from('verdicts')
      .select('id', { count: 'exact', head: true })
      .eq('id', existingVerdictId)
      .eq('user_id', user.id)
    if ((count ?? 0) > 0) {
      next()
      return
    }
  }

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
    .is('deleted_at', null)

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

  res.locals.verdictsUsedToday = usedToday
  next()
}

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

type HoldReminderTimerRow = {
  id: string
  user_id: string
  verdict_id: string
  expires_at: string
}

type HoldReminderVerdictRow = {
  id: string
  candidate_title: string
  candidate_price: number | null
  candidate_vendor: string | null
}

const requireCronSecret = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  if (!holdReminderCronSecret) {
    res.status(500).json({ error: 'Server misconfigured: missing hold reminder cron secret.' })
    return
  }

  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token || token !== holdReminderCronSecret) {
    res.status(401).json({ error: 'Invalid scheduler credentials.' })
    return
  }

  next()
}

const formatReminderPrice = (price: number | null): string => {
  if (price === null || Number.isNaN(price)) {
    return 'Price not recorded'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(price)
}

const buildHoldReminderEmailHtml = ({
  title,
  brand,
  price,
  expiresAt,
}: {
  title: string
  brand: string | null
  price: number | null
  expiresAt: string
}) => {
  const formattedPrice = formatReminderPrice(price)
  const formattedRelease = new Date(expiresAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your TruePick hold has ended</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0c10;font-family:'Outfit',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0c10;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <tr>
            <td style="padding-bottom:32px;">
              <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">TruePick</span>
            </td>
          </tr>

          <tr>
            <td style="background-color:#0f1115;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:36px 32px;">
              <div style="display:inline-block;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.35);border-radius:999px;padding:4px 14px;margin-bottom:24px;">
                <span style="font-size:12px;font-weight:600;color:#fcd34d;letter-spacing:0.4px;text-transform:uppercase;">Hold reminder</span>
              </div>

              <h1 style="margin:0 0 12px;font-size:26px;font-weight:700;color:#ffffff;line-height:1.25;letter-spacing:-0.4px;">
                Your hold window has ended.
              </h1>

              <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#94a3b8;">
                You asked TruePick to slow this decision down. Your reminder is here so you can revisit the purchase with a clearer head.
              </p>

              <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:18px 18px 16px;margin-bottom:28px;">
                <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#ffffff;line-height:1.4;">${title}</p>
                <p style="margin:0 0 6px;font-size:14px;color:#cbd5e1;line-height:1.5;">${formattedPrice}${brand ? ` · ${brand}` : ''}</p>
                <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">Hold ended: ${formattedRelease}</p>
              </div>

              <div style="height:1px;background:rgba(255,255,255,0.07);margin-bottom:28px;"></div>

              <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;">Before you buy</p>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding-bottom:10px;">
                    <span style="color:#f59e0b;font-size:14px;margin-right:10px;">&#8594;</span>
                    <span style="font-size:14px;color:#cbd5e1;line-height:1.5;">Check whether the original reason still feels urgent.</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:10px;">
                    <span style="color:#f59e0b;font-size:14px;margin-right:10px;">&#8594;</span>
                    <span style="font-size:14px;color:#cbd5e1;line-height:1.5;">Compare it against one cheaper or non-purchase alternative.</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <span style="color:#f59e0b;font-size:14px;margin-right:10px;">&#8594;</span>
                    <span style="font-size:14px;color:#cbd5e1;line-height:1.5;">If you still want it, buy deliberately instead of reactively.</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#334155;line-height:1.6;">
                You received this because hold reminders are enabled in your TruePick settings.<br>
                <a href="https://gettruepick.com" style="color:#475569;text-decoration:none;">gettruepick.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

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
  posthog.capture({
    distinctId: adminUser.id,
    event: 'resource_created',
    properties: { resource_id: data.id, slug: body.slug.trim(), title: body.title.trim(), is_published: body.isPublished ?? false, tag_count: body.tags.length },
  })
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
  posthog.capture({
    distinctId: adminUser.id,
    event: 'resource_updated',
    properties: { resource_id: resourceId, slug: body.slug.trim(), title: body.title.trim(), is_published: body.isPublished ?? false },
  })
  res.json({ data: toDbRow(data) })
})

app.post('/admin/resources/:resourceId/publish', requireAdmin, async (req, res) => {
  const { resourceId } = req.params
  const adminUser = (req as express.Request & { adminUser: { id: string } }).adminUser
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
  posthog.capture({
    distinctId: adminUser.id,
    event: 'resource_published',
    properties: { resource_id: resourceId, slug: data.slug, title: data.title },
  })
  res.json({ data: toDbRow(data) })
})

app.post('/admin/resources/:resourceId/unpublish', requireAdmin, async (req, res) => {
  const { resourceId } = req.params
  const adminUser = (req as express.Request & { adminUser: { id: string } }).adminUser

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
  posthog.capture({
    distinctId: adminUser.id,
    event: 'resource_unpublished',
    properties: { resource_id: resourceId, slug: data.slug, title: data.title },
  })
  res.json({ data: toDbRow(data) })
})

app.delete('/admin/resources/:resourceId', requireAdmin, async (req, res) => {
  const { resourceId } = req.params
  const adminUser = (req as express.Request & { adminUser: { id: string } }).adminUser

  const { error } = await supabase()
    .from('resources')
    .delete()
    .eq('id', resourceId)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  posthog.capture({
    distinctId: adminUser.id,
    event: 'resource_deleted',
    properties: { resource_id: resourceId },
  })
  res.status(204).send()
})

const RESOURCE_IMAGES_BUCKET = 'resource-images'

app.post(
  '/admin/resources/upload-image',
  requireAdmin,
  upload.single('image'),
  async (req, res) => {
    const adminUser = (req as express.Request & { adminUser: { id: string } }).adminUser
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
    posthog.capture({
      distinctId: adminUser.id,
      event: 'image_uploaded',
      properties: { mime_type: file.mimetype, file_size: file.size },
    })
    res.json({ url: urlData.publicUrl })
  }
)

// ---------------------------------------------------------------------------
// OpenAI proxy routes — verdict evaluation, embeddings, receipt parsing
// ---------------------------------------------------------------------------

const LLM_TIMEOUT_MS = 60_000

app.post('/api/verdict/evaluate', requireAuth, checkDailyVerdictLimit, rateLimitLLM, async (req, res) => {
  if (!openaiApiKey) {
    res.status(500).json({ error: 'OpenAI API key not configured on server.' })
    return
  }

  const { systemPrompt, userPrompt, model, maxTokens } = req.body as {
    systemPrompt: string
    userPrompt: string
    model?: string
    maxTokens?: number
  }
  const userId = (req as AuthenticatedRequest).authUser.id

  if (!systemPrompt || !userPrompt) {
    res.status(400).json({ error: 'systemPrompt and userPrompt are required.' })
    return
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: model ?? 'gpt-5-nano',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_completion_tokens: maxTokens ?? 4000,
      }),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      posthog.capture({
        distinctId: userId,
        event: 'verdict_eval_failed',
        properties: { model: model ?? 'gpt-5-nano', status_code: response.status, reason: 'openai_error' },
      })
      res.status(response.status).json({
        error: `OpenAI API error: ${response.status}`,
        details: errorBody,
      })
      return
    }

    const data = await response.json()
    posthog.capture({
      distinctId: userId,
      event: 'verdict_evaluated',
      properties: { model: model ?? 'gpt-5-nano', max_tokens: maxTokens ?? 4000 },
    })
    const usedToday = (res.locals.verdictsUsedToday as number | undefined) ?? 0
    const verdicts_remaining = Math.max(0, DAILY_VERDICT_LIMIT_FREE - (usedToday + 1))
    res.json({ ...data, verdicts_remaining })
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      posthog.capture({
        distinctId: userId,
        event: 'verdict_eval_failed',
        properties: { model: model ?? 'gpt-5-nano', reason: 'timeout' },
      })
      res.status(504).json({ error: 'OpenAI request timed out.' })
      return
    }
    posthog.captureException(error, userId, { endpoint: '/api/verdict/evaluate' })
    posthog.capture({
      distinctId: userId,
      event: 'verdict_eval_failed',
      properties: { model: model ?? 'gpt-5-nano', reason: 'unknown_error' },
    })
    res.status(500).json({
      error: 'Failed to call OpenAI API.',
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

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

app.post('/api/waitlist', async (req, res) => {
  const { email, verdicts_at_signup } = req.body as { email?: string; verdicts_at_signup?: number }

  if (!email?.trim()) {
    res.status(400).json({ error: 'email is required.' })
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.trim())) {
    res.status(400).json({ error: 'Invalid email address.' })
    return
  }

  const { error } = await supabase()
    .from('waitlist')
    .insert({ email: email.trim().toLowerCase(), verdicts_at_signup: verdicts_at_signup ?? null })

  const isDuplicate = error?.code === '23505'

  if (error && !isDuplicate) {
    res.status(500).json({ error: error.message })
    return
  }

  if (resend && !isDuplicate) {
    resend.emails.send({
      from: 'TruePick <noreply@resila.ai>',
      to: email.trim(),
      subject: "You're on the TruePick waitlist",
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're on the TruePick waitlist</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0c10;font-family:'Outfit',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0c10;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">

          <!-- Header: wordmark -->
          <tr>
            <td style="padding-bottom:32px;">
              <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">TruePick</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#0f1115;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:36px 32px;">

              <!-- Badge -->
              <div style="display:inline-block;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.35);border-radius:999px;padding:4px 14px;margin-bottom:24px;">
                <span style="font-size:12px;font-weight:600;color:#a5b4fc;letter-spacing:0.4px;text-transform:uppercase;">Waitlist confirmed</span>
              </div>

              <!-- Heading -->
              <h1 style="margin:0 0 12px;font-size:26px;font-weight:700;color:#ffffff;line-height:1.25;letter-spacing:-0.4px;">
                You're on the list.
              </h1>

              <!-- Body -->
              <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#94a3b8;">
                Thanks for joining the TruePick waitlist. We're building a smarter way to make purchase decisions — and founding members get <strong style="color:#e2e8f0;font-weight:600;">3 months free</strong> when we launch.
              </p>

              <!-- Divider -->
              <div style="height:1px;background:rgba(255,255,255,0.07);margin-bottom:28px;"></div>

              <!-- What to expect -->
              <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;">What to expect</p>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding-bottom:10px;">
                    <span style="color:#6366f1;font-size:14px;margin-right:10px;">&#8594;</span>
                    <span style="font-size:14px;color:#cbd5e1;line-height:1.5;">Early access before public launch</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:10px;">
                    <span style="color:#6366f1;font-size:14px;margin-right:10px;">&#8594;</span>
                    <span style="font-size:14px;color:#cbd5e1;line-height:1.5;">3 months free for founding members</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <span style="color:#6366f1;font-size:14px;margin-right:10px;">&#8594;</span>
                    <span style="font-size:14px;color:#cbd5e1;line-height:1.5;">We'll reach out personally when your spot opens</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#334155;line-height:1.6;">
                You received this because you joined the TruePick waitlist.<br>
                <a href="https://gettruepick.com" style="color:#475569;text-decoration:none;">gettruepick.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    }).catch((err: unknown) => { console.error('[Resend] Failed to send waitlist email:', err) })
  }

  res.json({ success: true })
})

app.post('/api/hold-reminders/run', requireCronSecret, async (_req, res) => {
  if (!resend) {
    res.status(500).json({ error: 'Resend API key not configured on server.' })
    return
  }

  const nowIso = new Date().toISOString()
  const { data: timers, error: timersError } = await supabase()
    .from('hold_timers')
    .select('id, user_id, verdict_id, expires_at')
    .eq('notified', false)
    .lte('expires_at', nowIso)
    .order('expires_at', { ascending: true })
    .limit(100)

  if (timersError) {
    res.status(500).json({ error: timersError.message })
    return
  }

  const dueTimers = (timers ?? []) as HoldReminderTimerRow[]
  if (dueTimers.length === 0) {
    res.json({ success: true, processed: 0, sent: 0, skipped: 0, failed: 0 })
    return
  }

  const userIds = [...new Set(dueTimers.map((timer) => timer.user_id))]
  const verdictIds = [...new Set(dueTimers.map((timer) => timer.verdict_id))]

  const [{ data: users, error: usersError }, { data: verdicts, error: verdictsError }] = await Promise.all([
    supabase()
      .from('users')
      .select('id, email')
      .in('id', userIds),
    supabase()
      .from('verdicts')
      .select('id, candidate_title, candidate_price, candidate_vendor')
      .in('id', verdictIds),
  ])

  if (usersError) {
    res.status(500).json({ error: usersError.message })
    return
  }
  if (verdictsError) {
    res.status(500).json({ error: verdictsError.message })
    return
  }

  const usersById = new Map(
    (users ?? []).map((user) => [String(user.id), { email: String(user.email ?? '') }])
  )
  const verdictsById = new Map(
    ((verdicts ?? []) as HoldReminderVerdictRow[]).map((verdict) => [verdict.id, verdict])
  )

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const timer of dueTimers) {
    const user = usersById.get(timer.user_id)
    const verdict = verdictsById.get(timer.verdict_id)

    if (!user?.email || !verdict?.candidate_title) {
      skipped += 1
      continue
    }

    try {
      await resend.emails.send({
        from: 'TruePick <noreply@resila.ai>',
        to: user.email,
        subject: `Your TruePick hold ended: ${verdict.candidate_title}`,
        html: buildHoldReminderEmailHtml({
          title: verdict.candidate_title,
          brand: verdict.candidate_vendor,
          price: verdict.candidate_price,
          expiresAt: timer.expires_at,
        }),
      })

      const { error: updateError } = await supabase()
        .from('hold_timers')
        .update({ notified: true })
        .eq('id', timer.id)
        .eq('notified', false)

      if (updateError) {
        failed += 1
        console.error('[HoldReminder] Failed to mark timer notified:', updateError.message, { timerId: timer.id })
        continue
      }

      sent += 1
    } catch (error) {
      failed += 1
      console.error('[HoldReminder] Failed to send reminder:', error, { timerId: timer.id })
    }
  }

  res.json({
    success: true,
    processed: dueTimers.length,
    sent,
    skipped,
    failed,
  })
})

app.post('/api/embeddings/search', requireAuth, rateLimitLLM, async (req, res) => {
  if (!openaiApiKey) {
    res.status(500).json({ error: 'OpenAI API key not configured on server.' })
    return
  }

  const { inputs } = req.body as { inputs: string[] }
  const userId = (req as AuthenticatedRequest).authUser.id

  if (!Array.isArray(inputs) || inputs.length === 0) {
    res.status(400).json({ error: 'inputs must be a non-empty array of strings.' })
    return
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: inputs,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      res.status(response.status).json({
        error: `OpenAI embeddings error: ${response.status}`,
        details: errorBody,
      })
      return
    }

    const data = await response.json()
    posthog.capture({
      distinctId: userId,
      event: 'embeddings_searched',
      properties: { input_count: inputs.length },
    })
    res.json(data)
  } catch (error) {
    posthog.captureException(error, userId, { endpoint: '/api/embeddings/search' })
    res.status(500).json({
      error: 'Failed to call OpenAI embeddings API.',
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

const openaiClient = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null

const RECEIPT_EXTRACTION_PROMPT = `You are a receipt parser that extracts purchase information from email content.

Extract the following fields for EACH item purchased:
- title: The item/product name (be specific but concise)
- price: The item price as a number (no currency symbols). Must be the actual price paid, not 0.
- vendor: The store/merchant name
- category: One of: electronics, fashion, home goods, health & wellness, travel, entertainment, subscriptions, food & beverage, services, education, other
- purchase_date: The date of purchase in YYYY-MM-DD format
- order_id: The order/confirmation number if present, otherwise null

Rules:
- If multiple items are purchased, return EACH item as a separate object in a JSON array
- For subscriptions, include the period in the title (e.g., "Netflix 1 Month")
- SKIP any item where the price cannot be determined - do not include items with price 0 or unknown price
- If date cannot be determined, use the email date
- Return valid JSON only, no markdown

Email sender: {sender}
Email subject: {subject}
Email date: {email_date}

Email content:
{content}

If this is NOT a purchase receipt (e.g., promotional email, newsletter, shipping update without purchase details), respond with exactly: {"not_a_receipt": true}

For a SINGLE item, respond with:
{"items": [{"title": "...", "price": 12.99, "vendor": "...", "category": "...", "purchase_date": "YYYY-MM-DD", "order_id": "..." or null}]}

For MULTIPLE items, respond with:
{"items": [{"title": "Item 1", "price": 12.99, "vendor": "...", "category": "...", "purchase_date": "YYYY-MM-DD", "order_id": "..."}, {"title": "Item 2", "price": 8.50, "vendor": "...", "category": "...", "purchase_date": "YYYY-MM-DD", "order_id": "..."}]}`

app.post('/api/email/parse-receipt', requireAuth, rateLimitLLM, async (req, res) => {
  if (!openaiClient) {
    res.status(500).json({ error: 'OpenAI API key not configured on server.' })
    return
  }

  const { emailText, sender, subject, emailDate, contentLimit, maxOutputTokens } = req.body as {
    emailText: string
    sender: string
    subject: string
    emailDate: string
    contentLimit?: number
    maxOutputTokens?: number
  }
  const userId = (req as AuthenticatedRequest).authUser.id

  if (!emailText || !sender || !subject || !emailDate) {
    res.status(400).json({
      error: 'emailText, sender, subject, and emailDate are required.',
    })
    return
  }

  try {
    const limit = contentLimit ?? 3000
    const truncatedContent =
      emailText.length > limit ? emailText.slice(0, limit) + '...' : emailText

    const prompt = RECEIPT_EXTRACTION_PROMPT.replace('{sender}', sender)
      .replace('{subject}', subject)
      .replace('{email_date}', emailDate)
      .replace('{content}', truncatedContent)

    const response = await openaiClient.responses.parse({
      model: 'gpt-5-nano',
      text: { format: { type: 'json_object' } },
      input: [{ role: 'user', content: prompt }],
      max_output_tokens: maxOutputTokens ?? 1500,
    })

    if (response.error) {
      posthog.capture({
        distinctId: userId,
        event: 'receipt_parse_failed',
        properties: { reason: 'openai_parse_error', details: response.error.message },
      })
      res.status(500).json({
        error: 'OpenAI parsing failed.',
        details: response.error.message,
      })
      return
    }

    if (response.incomplete_details?.reason) {
      posthog.capture({
        distinctId: userId,
        event: 'receipt_parse_failed',
        properties: { reason: 'incomplete_response', details: response.incomplete_details.reason },
      })
      res.status(422).json({
        error: 'OpenAI response incomplete.',
        details: response.incomplete_details.reason,
      })
      return
    }

    const content = response.output_text?.trim() ?? ''
    posthog.capture({
      distinctId: userId,
      event: 'receipt_parsed',
      properties: { email_date: emailDate, content_truncated: emailText.length > limit },
    })
    res.json({ content })
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      posthog.capture({
        distinctId: userId,
        event: 'receipt_parse_failed',
        properties: { reason: 'openai_api_error', status_code: error.status },
      })
      res.status(error.status ?? 500).json({
        error: 'OpenAI API error.',
        details: error.message,
      })
      return
    }
    posthog.captureException(error, userId, { endpoint: '/api/email/parse-receipt' })
    posthog.capture({
      distinctId: userId,
      event: 'receipt_parse_failed',
      properties: { reason: 'unknown_error' },
    })
    res.status(500).json({
      error: 'Failed to parse receipt.',
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const userId = (req as AuthenticatedRequest).authUser?.id ?? 'anonymous'
  posthog.captureException(err, userId, { endpoint: req.path, method: req.method })
  res.status(500).json({ error: 'Internal server error.' })
})

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`)
})
