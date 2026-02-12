/**
 * Gmail Message Fetcher Script (Raw Export)
 * Fetches recent Gmail messages and writes raw API responses to JSON.
 *
 * Usage:
 *   npx tsx apps/web/src/api/log/fetchMessages.ts --token <access_token> [--count 100] [--output ./messages.raw.json]
 *   npx tsx apps/web/src/api/log/fetchMessages.ts --count 100
 * 
 * Env fallback:
 *   GMAIL_ACCESS_TOKEN=<access_token> npx tsx apps/web/src/api/log/fetchMessages.ts --count 100
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1'
const DEFAULT_COUNT = 100
const GMAIL_PAGE_SIZE = 500

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

type CliOptions = {
  token: string
  count: number
  output: string
}

type GmailListResponse = {
  messages?: Array<{ id: string; threadId: string }>
  nextPageToken?: string
  resultSizeEstimate?: number
}

type GmailRawMessage = {
  id?: string
  threadId?: string
  labelIds?: string[]
  snippet?: string
  historyId?: string
  internalDate?: string
  sizeEstimate?: number
  raw?: string
}

function loadEnvFile() {
  const candidates = [
    path.resolve(process.cwd(), 'apps/web/.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../../.env'),
  ]

  const envPath = candidates.find((candidate) => fs.existsSync(candidate))
  if (!envPath) return

  const raw = fs.readFileSync(envPath, 'utf-8')
  const lines = raw.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eqIndex = trimmed.indexOf('=')
    if (eqIndex <= 0) continue

    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function printUsage() {
  console.error('Usage:')
  console.error('  npx tsx apps/web/src/api/log/fetchMessages.ts --token <access_token> [--count 100] [--output ./messages.raw.json]')
  console.error('  GMAIL_ACCESS_TOKEN=xxx npx tsx apps/web/src/api/log/fetchMessages.ts --count 100')
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    token: process.env.GMAIL_ACCESS_TOKEN ?? '',
    count: DEFAULT_COUNT,
    output: path.join(__dirname, 'messages.raw.json'),
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    if (arg === '--token' && argv[i + 1]) {
      options.token = argv[i + 1]
      i += 1
      continue
    }

    if (arg === '--count' && argv[i + 1]) {
      const count = Number.parseInt(argv[i + 1], 10)
      if (!Number.isNaN(count) && count > 0) {
        options.count = count
      }
      i += 1
      continue
    }

    if (arg === '--output' && argv[i + 1]) {
      options.output = path.resolve(argv[i + 1])
      i += 1
      continue
    }

    if (arg === '--help' || arg === '-h') {
      printUsage()
      process.exit(0)
    }
  }

  return options
}

async function gmailFetchJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    const message = error?.error?.message ?? `Gmail API request failed (${response.status})`
    throw new Error(message)
  }

  return (await response.json()) as T
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  return Buffer.from(padded, 'base64').toString('utf-8')
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_')
}

async function listMessagesRaw(accessToken: string, totalCount: number): Promise<{
  pages: GmailListResponse[]
  messageIds: string[]
}> {
  const pages: GmailListResponse[] = []
  const messageIds: string[] = []
  let pageToken: string | undefined

  while (messageIds.length < totalCount) {
    const limit = Math.min(GMAIL_PAGE_SIZE, totalCount - messageIds.length)
    const params = new URLSearchParams({ maxResults: String(limit) })
    if (pageToken) params.set('pageToken', pageToken)

    const page = await gmailFetchJson<GmailListResponse>(
      `${GMAIL_API_BASE}/users/me/messages?${params.toString()}`,
      accessToken,
    )

    pages.push(page)

    for (const message of page.messages ?? []) {
      if (messageIds.length >= totalCount) break
      messageIds.push(message.id)
    }

    pageToken = page.nextPageToken
    if (!pageToken || !(page.messages?.length)) break
  }

  return { pages, messageIds }
}

async function getMessageRaw(accessToken: string, messageId: string): Promise<GmailRawMessage> {
  return gmailFetchJson<unknown>(
    `${GMAIL_API_BASE}/users/me/messages/${messageId}?format=raw`,
    accessToken,
  ) as Promise<GmailRawMessage>
}

async function main() {
  loadEnvFile()
  const { token, count, output } = parseArgs(process.argv.slice(2))

  if (!token) {
    console.error('Error: Gmail access token is required')
    printUsage()
    process.exit(1)
  }

  console.log(`Fetching ${count} messages from Gmail (raw)...`)
  const { pages, messageIds } = await listMessagesRaw(token, count)
  console.log(`Found ${messageIds.length} message IDs`)

  if (messageIds.length === 0) {
    const emptyOutput = {
      generatedAt: new Date().toISOString(),
      requestedCount: count,
      fetchedCount: 0,
      listPagesRaw: pages,
      messagesRaw: [],
    }
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(output, JSON.stringify(emptyOutput, null, 2), 'utf-8')
    console.log(`No messages found. Wrote empty raw payload to ${output}`)
    return
  }

  const messagesRaw: Array<GmailRawMessage & { rawDecoded?: string | null; rawDecodeError?: string }> = []
  for (let i = 0; i < messageIds.length; i += 1) {
    const messageId = messageIds[i]
    process.stdout.write(`\rFetching raw message ${i + 1}/${messageIds.length}...`)

    try {
      const raw = await getMessageRaw(token, messageId)
      const rawDecoded =
        typeof raw.raw === 'string' ? decodeBase64Url(raw.raw) : null

      messagesRaw.push({
        ...raw,
        rawDecoded,
      })
      await new Promise((resolve) => setTimeout(resolve, 35))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`\nFailed to fetch message ${messageId}: ${message}`)
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    requestedCount: count,
    fetchedCount: messagesRaw.length,
    listPagesRaw: pages,
    messagesRaw,
  }

  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, JSON.stringify(payload, null, 2), 'utf-8')

  const originalsDir = path.join(path.dirname(output), 'messages.original')
  fs.mkdirSync(originalsDir, { recursive: true })

  for (const message of messagesRaw) {
    if (!message.id || typeof message.rawDecoded !== 'string') continue
    const fileName = `${sanitizeFilename(message.id)}.eml`
    fs.writeFileSync(path.join(originalsDir, fileName), message.rawDecoded, 'utf-8')
  }

  console.log(`\nDone! Saved ${messagesRaw.length} raw messages to ${output}`)
  console.log(`Saved decoded originals to ${originalsDir}`)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Error: ${message}`)
  process.exit(1)
})
