# Email Parsing Architecture

## Current architecture

```markdown
Gmail API → List Messages → Filter Pipeline → AI Parsing → Purchase Creation
                ↓                ↓                ↓              ↓
           gmailClient.ts    gmailClient.ts   receiptParser.ts  Supabase RPC
```

### 1. Email Fetching (`gmailClient.ts`)

**Gmail API Client** - REST API wrapper for Gmail:

- `listMessages(accessToken, query, maxResults)` - Lists message headers matching a search query
- `getMessage(accessToken, messageId)` - Fetches full message content
- `parseMessage(message)` - Extracts from, subject, date, and text content from raw message
- `extractMessageText(message)` - Decodes base64 content, handles multipart messages, strips HTML

**Query Building** (`buildReceiptQuery`):

- Searches for receipt-like emails using sender/subject patterns
- Time-filtered to recent emails (default: 90 days)
- Query: `from:(noreply|receipt|order|confirmation...) subject:(receipt|order|...) newer_than:90d`

### 2. Multi-Stage Filter Pipeline (`gmailClient.ts:265-428`)

Pre-LLM filtering to reduce API costs and improve accuracy:

**Stage 1: Negative Pattern Rejection** (`matchesNegativePatterns`)

- Hard reject for: refunds, returns, cancellations, shipping-only updates, promotional emails, account management
- Regex-based pattern matching on subject + content

**Stage 2: Price Pattern Detection** (`detectPricePatterns`)

- Confidence score 0-1 based on presence of price patterns ($, USD, €, £, ¥, total:, subtotal:, etc.)
- Rejects emails with no price patterns (confidence = 0)

**Stage 3: Keyword Confidence Scoring** (`calculateReceiptConfidence`)

- Weighted scoring: high-confidence keywords (0.4 each), medium (0.2), low (0.1)
- Keywords: "order confirmation", "payment received", "receipt", "invoice", etc.

**Combined Filter** (`filterEmailForReceipt`):

- Overall confidence = priceConfidence × 0.4 + keywordConfidence × 0.6
- Threshold: ≥ 0.5 to process with LLM

### 3. AI Receipt Parsing (`receiptParser.ts`)

**Model**: GPT-4o-mini (configured as `gpt-5-nano`)

**Process**:

1. Truncates email content to 4000 chars (token limit)
2. Sends structured prompt with sender, subject, date, and content
3. Receives JSON response with extracted items array

**Extracted Fields** per item:

- `title` - Item/product name
- `price` - Price as number (must be > 0)
- `vendor` - Store/merchant name
- `category` - One of 11 categories (electronics, fashion, home goods, etc.)
- `purchase_date` - YYYY-MM-DD format
- `order_id` - Optional order/confirmation number

**Validation** (`validateAndNormalize`):

- Rejects items missing required fields (title, vendor, price)
- Rejects items with price ≤ 0
- Normalizes date format, truncates long strings

### 4. Purchase Creation (`importGmail.ts:233-267`)

**RPC Call**: `add_purchase(p_title, p_price, p_vendor, p_category, p_purchase_date, p_source, p_verdict_id, p_is_past_purchase, p_past_purchase_outcome, p_order_id)`

**Deduplication**:

- Unique constraint on `order_id` in database
- Detects duplicates via PostgreSQL error code 23505 or conflict messages
- Skips silently on duplicate

### 5. Connection Management (`emailConnectionService.ts`)

**Table**: `email_connections`

**Operations**:

- `saveEmailConnection` - Upsert OAuth tokens (access, refresh, expiry)
- `getEmailConnection` - Retrieve active connection
- `updateLastSync` - Update sync timestamp after import
- `isTokenExpired` - Check token expiry with 5-minute buffer

**Note**: Tokens stored as `encrypted_token` but not currently encrypted (TODO for production)

### 6. Import Orchestration (`importGmail.ts`)

**Main Function**: `importGmailReceipts(accessToken, userId, options)`

**Options**:

- `maxMessages` - Max purchases to import (default: 10)
- `sinceDays` - Days to look back (default: 90)
- `openaiApiKey` - Required for AI parsing

**Process**:

1. Validate credentials (access token, OpenAI key)
2. Build Gmail query and fetch message headers (3× maxMessages for filtering buffer)
3. For each message:
   - Fetch full content
   - Apply multi-stage filter
   - If passed, parse with AI
   - Create purchases for each extracted item
   - Handle duplicates and errors
4. Update last sync timestamp
5. Return results with import log

**Rate Limiting**: 100ms delay between API calls

### 7. Logging (`log/importLogger.ts`)

**In-memory logging** for debugging and auditing:

**Log Types**:

- `import` - Successful purchase creation
- `skip` - Duplicate or empty LLM response
- `error` - Processing error
- `filter_reject` - Pre-LLM filter rejection

**Features**:

- Console output with table formatting
- Markdown export for message inspection (`downloadMessagesMarkdown`)
- Summary stats: imported, skipped, errors, filterRejected

## Other ways to enhance parsing

- Use Google's preassigned label: Reciepts to prefilter during retrieval (their shit is more robust than mine)
- Read over the raw return from API
