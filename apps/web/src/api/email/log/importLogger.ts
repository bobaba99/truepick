/**
 * Import Logger
 * Logs Gmail import operations for debugging and auditing
 * Includes markdown file export for message inspection
 */

export type FetchedMessage = {
  emailId: string
  from: string
  subject: string
  date: string
  textContent: string
  filterResult?: {
    shouldProcess: boolean
    confidence: number
    rejectionReason?: string
  }
  extractedReceipts?: Array<{
    title: string
    price: number
    vendor: string
    category: string | null
  }>
}

let fetchedMessages: FetchedMessage[] = []

export type ImportLogEntry = {
  timestamp: string
  type: 'import' | 'skip' | 'error' | 'filter_reject'
  emailId?: string
  emailSubject?: string
  title?: string
  price?: number
  vendor?: string
  reason?: string
  confidence?: number
}

export type ImportLogSummary = {
  startTime: string
  endTime: string
  totalProcessed: number
  imported: number
  skipped: number
  errors: number
  filterRejected: number
  entries: ImportLogEntry[]
}

let currentLog: ImportLogEntry[] = []
let logStartTime: string | null = null

/**
 * Start a new import log session
 */
export function startImportLog(): void {
  currentLog = []
  logStartTime = new Date().toISOString()
}

/**
 * Log a successful import
 */
export function logImport(entry: {
  emailId: string
  emailSubject: string
  title: string
  price: number
  vendor: string
}): void {
  currentLog.push({
    timestamp: new Date().toISOString(),
    type: 'import',
    ...entry,
  })
}

/**
 * Log a skipped email (duplicate or non-receipt from LLM)
 */
export function logSkip(entry: {
  emailId?: string
  emailSubject?: string
  reason: string
}): void {
  currentLog.push({
    timestamp: new Date().toISOString(),
    type: 'skip',
    ...entry,
  })
}

/**
 * Log an error during import
 */
export function logError(entry: {
  emailId?: string
  emailSubject?: string
  reason: string
}): void {
  currentLog.push({
    timestamp: new Date().toISOString(),
    type: 'error',
    ...entry,
  })
}

/**
 * Log a filter rejection (pre-LLM filtering)
 */
export function logFilterReject(entry: {
  emailId: string
  emailSubject: string
  reason: string
  confidence?: number
}): void {
  currentLog.push({
    timestamp: new Date().toISOString(),
    type: 'filter_reject',
    ...entry,
  })
}

/**
 * End the import log session and return summary
 */
export function endImportLog(): ImportLogSummary {
  const endTime = new Date().toISOString()
  const summary: ImportLogSummary = {
    startTime: logStartTime ?? endTime,
    endTime,
    totalProcessed: currentLog.length,
    imported: currentLog.filter((e) => e.type === 'import').length,
    skipped: currentLog.filter((e) => e.type === 'skip').length,
    errors: currentLog.filter((e) => e.type === 'error').length,
    filterRejected: currentLog.filter((e) => e.type === 'filter_reject').length,
    entries: [...currentLog],
  }

  // Log to console for debugging
  console.group('📧 Gmail Import Log')
  console.log(`Duration: ${logStartTime} → ${endTime}`)
  console.log(`Imported: ${summary.imported}`)
  console.log(`Skipped: ${summary.skipped}`)
  console.log(`Filter Rejected: ${summary.filterRejected}`)
  console.log(`Errors: ${summary.errors}`)

  if (summary.entries.length > 0) {
    console.table(
      summary.entries.map((e) => ({
        time: e.timestamp.split('T')[1].split('.')[0],
        type: e.type,
        subject: e.emailSubject?.slice(0, 40) ?? '—',
        title: e.title?.slice(0, 30) ?? '—',
        price: e.price ?? '—',
        reason: e.reason ?? '—',
      }))
    )
  }
  console.groupEnd()

  // Reset for next session
  currentLog = []
  logStartTime = null

  return summary
}

/**
 * Get current log entries (for real-time monitoring)
 */
export function getCurrentLog(): ImportLogEntry[] {
  return [...currentLog]
}

// =============================================================================
// Message Logging for Markdown Export
// =============================================================================

/**
 * Log a fetched message with its content and filter result
 */
export function logFetchedMessage(message: FetchedMessage): void {
  fetchedMessages.push(message)
}

/**
 * Clear fetched messages (call at start of import session)
 */
export function clearFetchedMessages(): void {
  fetchedMessages = []
}

/**
 * Get all fetched messages
 */
export function getFetchedMessages(): FetchedMessage[] {
  return [...fetchedMessages]
}

/**
 * Generate markdown content for a single message
 */
function messageToMarkdown(msg: FetchedMessage, index: number): string {
  const filterStatus = msg.filterResult?.shouldProcess
    ? `✅ Passed (confidence: ${(msg.filterResult.confidence * 100).toFixed(0)}%)`
    : `❌ Rejected: ${msg.filterResult?.rejectionReason ?? 'unknown'}`

  const receiptsSection =
    msg.extractedReceipts && msg.extractedReceipts.length > 0
      ? `### Extracted Receipts

| Title | Price | Vendor | Category |
|-------|-------|--------|----------|
${msg.extractedReceipts.map((r) => `| ${r.title} | $${r.price.toFixed(2)} | ${r.vendor} | ${r.category ?? 'other'} |`).join('\n')}`
      : '### Extracted Receipts\n\n_No receipts extracted_'

  return `## ${index + 1}. ${msg.subject}

- **Email ID:** \`${msg.emailId}\`
- **From:** ${msg.from}
- **Date:** ${msg.date}
- **Filter Result:** ${filterStatus}

${receiptsSection}

### Email Content

\`\`\`
${msg.textContent.slice(0, 2000)}${msg.textContent.length > 2000 ? '\n...(truncated)' : ''}
\`\`\`

---
`
}

/**
 * Generate full markdown report for all fetched messages
 */
export function generateMessagesMarkdown(): string {
  const passed = fetchedMessages.filter((m) => m.filterResult?.shouldProcess).length
  const rejected = fetchedMessages.filter((m) => !m.filterResult?.shouldProcess).length

  const header = `# Gmail Import Messages Report

**Generated:** ${new Date().toISOString()}
**Total Messages:** ${fetchedMessages.length}
**Passed Filter:** ${passed}
**Rejected by Filter:** ${rejected}

---

`

  const body = fetchedMessages.map((msg, i) => messageToMarkdown(msg, i)).join('\n')

  return header + body
}

/**
 * Download messages as markdown file (browser only)
 */
export function downloadMessagesMarkdown(): void {
  const markdown = generateMessagesMarkdown()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `gmail-import-${timestamp}.md`

  const blob = new Blob([markdown], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  console.log(`📥 Downloaded: ${filename}`)
}

/**
 * Log messages to console as formatted markdown preview
 */
export function previewMessagesMarkdown(): void {
  const markdown = generateMessagesMarkdown()
  console.group('📄 Messages Markdown Preview')
  console.log(markdown)
  console.groupEnd()
}
