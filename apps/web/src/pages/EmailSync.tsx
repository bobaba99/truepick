import { useState, useEffect, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { GlassCard, LiquidButton } from '../components/Kinematics'
import { GmailLogo, OutlookLogo } from '../components/EmailIcons'
import {
  getEmailConnection,
  saveEmailConnection,
  deactivateEmailConnection,
  isTokenExpired,
  type EmailConnectionRow,
} from '../api/emailConnectionService'
import {
  importGmailReceipts,
  getEmailImportStats,
  downloadMessagesMarkdown,
  type ImportResult,
} from '../api/importGmail'
import { importOutlookReceipts } from '../api/importOutlook'
import { startOutlookOAuth, exchangeCodeForTokens, refreshOutlookToken } from '../api/outlookAuth'

type EmailSyncProps = {
  session: Session | null
}

type Status = {
  type: 'idle' | 'loading' | 'success' | 'error'
  message?: string
}

// OAuth configuration
const GMAIL_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly'
const MICROSOFT_CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID ?? ''
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY ?? ''
const IMPORT_RESULT_STORAGE_PREFIX = 'email-sync-import-result'

type EmailProvider = 'gmail' | 'outlook'

const getImportResultStorageKey = (userId: string) =>
  `${IMPORT_RESULT_STORAGE_PREFIX}:${userId}`

export default function EmailSync({ session }: EmailSyncProps) {
  const [connection, setConnection] = useState<EmailConnectionRow | null>(null)
  const [status, setStatus] = useState<Status>({ type: 'idle' })
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [hasHydratedImportResult, setHasHydratedImportResult] = useState(false)
  const [stats, setStats] = useState<{ totalImported: number; lastSyncDate: string | null } | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [provider, setProvider] = useState<EmailProvider>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('provider') === 'outlook' ? 'outlook' : 'gmail'
  })

  const userId = session?.user?.id

  // Load existing connection and stats
  const loadConnectionData = useCallback(async () => {
    if (!userId) return

    try {
      const [conn, importStats] = await Promise.all([
        getEmailConnection(userId),
        getEmailImportStats(userId),
      ])
      setConnection(conn)
      setStats(importStats)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load connection'
      setStatus({ type: 'error', message })
    }
  }, [userId])

  useEffect(() => {
    loadConnectionData()
  }, [loadConnectionData])

  // Restore the latest import result for this user after page refresh.
  useEffect(() => {
    if (!userId) {
      setImportResult(null)
      setHasHydratedImportResult(false)
      return
    }

    try {
      const raw = window.localStorage.getItem(getImportResultStorageKey(userId))
      if (!raw) {
        setImportResult(null)
        return
      }
      const parsed = JSON.parse(raw) as ImportResult
      setImportResult(parsed)
    } catch {
      window.localStorage.removeItem(getImportResultStorageKey(userId))
      setImportResult(null)
    } finally {
      setHasHydratedImportResult(true)
    }
  }, [userId])

  // Persist latest import result so it survives reloads.
  useEffect(() => {
    if (!userId || !hasHydratedImportResult) return

    const storageKey = getImportResultStorageKey(userId)
    if (!importResult) {
      window.localStorage.removeItem(storageKey)
      return
    }
    window.localStorage.setItem(storageKey, JSON.stringify(importResult))
  }, [userId, importResult, hasHydratedImportResult])

  // Initialize Google OAuth
  const handleConnectGmail = useCallback(() => {
    if (!GMAIL_CLIENT_ID) {
      setStatus({ type: 'error', message: 'Google Client ID not configured' })
      return
    }

    // Build OAuth URL
    const redirectUri = `${window.location.origin}/email-sync`
    const params = new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: GMAIL_SCOPES,
      include_granted_scopes: 'true',
      state: 'gmail_oauth',
    })

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  }, [])

  // Initialize Outlook OAuth
  const handleConnectOutlook = useCallback(async () => {
    if (!MICROSOFT_CLIENT_ID) {
      setStatus({ type: 'error', message: 'Microsoft Client ID not configured' })
      return
    }
    try {
      await startOutlookOAuth(MICROSOFT_CLIENT_ID)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start OAuth'
      setStatus({ type: 'error', message })
    }
  }, [])

  // Handle OAuth callback (access token in URL hash)
  useEffect(() => {
    const hash = window.location.hash
    if (!hash || !userId) return

    const params = new URLSearchParams(hash.substring(1))
    const accessToken = params.get('access_token')
    const expiresIn = params.get('expires_in')
    const state = params.get('state')

    if (accessToken && state === 'gmail_oauth') {
      // Clear hash from URL
      window.history.replaceState(null, '', window.location.pathname)

      // Calculate expiry time
      const expiresAt = expiresIn
        ? new Date(Date.now() + parseInt(expiresIn, 10) * 1000)
        : null

      // Save connection
      saveEmailConnection(userId, {
        provider: 'gmail',
        accessToken,
        expiresAt,
      }).then(({ error }) => {
        if (error) {
          setStatus({ type: 'error', message: error })
        } else {
          setStatus({ type: 'success', message: 'Gmail connected successfully!' })
          loadConnectionData()
        }
      })
    }
  }, [userId, loadConnectionData])

  // Handle Outlook OAuth callback (auth code or error in URL query params)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const state = params.get('state')

    if (state !== 'outlook_oauth') return

    // Microsoft returns error params if user denies consent or auth fails
    const oauthError = params.get('error')
    if (oauthError) {
      const errorDesc = params.get('error_description') ?? oauthError
      window.history.replaceState(null, '', window.location.pathname)
      setStatus({ type: 'error', message: `Outlook auth failed: ${errorDesc}` })
      return
    }

    const code = params.get('code')
    if (!code || !userId || !MICROSOFT_CLIENT_ID) return

    // Clear query params from URL
    window.history.replaceState(null, '', window.location.pathname)

    setStatus({ type: 'loading', message: 'Exchanging Outlook token...' })

    exchangeCodeForTokens(MICROSOFT_CLIENT_ID, code)
      .then(({ accessToken, refreshToken, expiresAt }) =>
        saveEmailConnection(userId, {
          provider: 'outlook',
          accessToken,
          refreshToken,
          expiresAt,
        })
      )
      .then(({ error }) => {
        if (error) {
          setStatus({ type: 'error', message: error })
        } else {
          setProvider('outlook')
          setStatus({ type: 'success', message: 'Outlook connected successfully!' })
          loadConnectionData()
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Token exchange failed'
        setStatus({ type: 'error', message })
      })
  }, [userId, loadConnectionData])

  // Disconnect Gmail
  const handleDisconnect = async () => {
    if (!userId) return

    setStatus({ type: 'loading', message: 'Disconnecting...' })
    const { error } = await deactivateEmailConnection(userId)

    if (error) {
      setStatus({ type: 'error', message: error })
    } else {
      setConnection(null)
      setStatus({ type: 'success', message: 'Gmail disconnected' })
    }
  }

  // Import receipts
  const handleImport = async () => {
    if (!userId || !connection) return

    let accessToken = connection.encrypted_token

    // If token is expired, try to refresh (Outlook only — Gmail uses implicit flow)
    if (isTokenExpired(connection)) {
      if (connection.provider === 'outlook' && connection.refresh_token && MICROSOFT_CLIENT_ID) {
        try {
          setStatus({ type: 'loading', message: 'Refreshing Outlook token...' })
          const refreshed = await refreshOutlookToken(MICROSOFT_CLIENT_ID, connection.refresh_token)
          await saveEmailConnection(userId, {
            provider: 'outlook',
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            expiresAt: refreshed.expiresAt,
          })
          accessToken = refreshed.accessToken
          loadConnectionData()
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Token refresh failed'
          setStatus({ type: 'error', message: `Token expired and refresh failed: ${message}. Please reconnect Outlook.` })
          return
        }
      } else {
        setStatus({
          type: 'error',
          message: `Token expired. Please reconnect ${connection.provider === 'outlook' ? 'Outlook' : 'Gmail'}.`,
        })
        return
      }
    }

    if (!OPENAI_API_KEY) {
      setStatus({ type: 'error', message: 'OpenAI API key not configured' })
      return
    }

    setIsImporting(true)
    setStatus({ type: 'loading', message: 'Scanning emails for receipts...' })

    try {
      const importFn =
        connection.provider === 'outlook'
          ? importOutlookReceipts
          : importGmailReceipts

      const result = await importFn(
        accessToken,
        userId,
        {
          maxMessages: 10,
          sinceDays: 90,
          openaiApiKey: OPENAI_API_KEY,
        }
      )

      setImportResult(result)
      setStatus({
        type: 'success',
        message: `Imported ${result.imported.length} receipts`,
      })
      loadConnectionData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed'
      setStatus({ type: 'error', message })
    } finally {
      setIsImporting(false)
    }
  }

  const isConnected = connection?.is_active && !isTokenExpired(connection)

  return (
    <section className="route-content">
      <div className="section-header">
        <h1>Email Sync</h1>
      </div>

      <GlassCard className="email-sync-container">
        <div className="provider-tabs">
          <button
            className={`provider-tab ${provider === 'gmail' ? 'active' : ''}`}
            onClick={() => setProvider('gmail')}
            type="button"
          >
            <GmailLogo className="tab-icon" />
            Gmail
          </button>
          <button
            className={`provider-tab ${provider === 'outlook' ? 'active' : ''}`}
            onClick={() => setProvider('outlook')}
            type="button"
          >
            <OutlookLogo className="tab-icon" />
            Outlook
          </button>
        </div>
        <div className="dashboard-grid">
          {/* Connection Card */}
          <div className="content-panel">
            <h2>Connect Email</h2>
            <p>
              Import your purchase receipts automatically by connecting your email.
              We only read order confirmations and receipts.
            </p>

            {status.message && (
              <div className={`status ${status.type}`}>
                {status.message}
              </div>
            )}

            <div className="email-providers">
              {isConnected ? (
                <div className="connected-status">
                  <div className="provider-info">
                    {connection.provider === 'outlook' ? (
                      <OutlookLogo className="provider-logo" />
                    ) : (
                      <GmailLogo className="provider-logo" />
                    )}
                    <span>{connection.provider === 'outlook' ? 'Outlook' : 'Gmail'} Connected</span>
                  </div>
                  <div className="connection-actions">
                    <LiquidButton
                      className="primary"
                      onClick={handleImport}
                      type="button"
                      disabled={isImporting}
                    >
                      {isImporting ? 'Importing...' : 'Import Receipts'}
                    </LiquidButton>
                    <LiquidButton
                      className="ghost"
                      onClick={handleDisconnect}
                      type="button"
                      disabled={isImporting}
                    >
                      Disconnect
                    </LiquidButton>
                  </div>
                </div>
              ) : provider === 'outlook' ? (
                <LiquidButton
                  className="primary"
                  onClick={handleConnectOutlook}
                  type="button"
                  disabled={!session}
                >
                  <OutlookLogo className="button-icon" />
                  Connect Outlook
                </LiquidButton>
              ) : (
                <LiquidButton
                  className="primary"
                  onClick={handleConnectGmail}
                  type="button"
                  disabled={!session}
                >
                  <GmailLogo className="button-icon" />
                  Connect Gmail
                </LiquidButton>
              )}
            </div>

            {stats && (
              <div className="import-stats">
                <p>
                  <strong>{stats.totalImported}</strong> receipts imported
                  {stats.lastSyncDate && (
                    <> · Last sync: {new Date(stats.lastSyncDate).toLocaleDateString()}</>
                  )}
                </p>
              </div>
            )}

            {importResult && (
              <div className="import-result">
                <h3>Import Results</h3>
                <ul>
                  <li>Imported: {importResult.imported.length}</li>
                  <li>Skipped (duplicates/non-receipts): {importResult.skipped}</li>
                  {importResult.errors.length > 0 && (
                    <li>Errors: {importResult.errors.length}</li>
                  )}
                </ul>
                {importResult.imported.length > 0 && (
                  <div className="imported-list">
                    <h4>New Purchases</h4>
                    {importResult.imported.map((item, idx) => (
                      <div key={idx} className="imported-item">
                        <span className="item-title">{item.title}</span>
                        <span className="item-vendor">{item.vendor}</span>
                        <span className="item-price">${item.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="import-actions">
                  <LiquidButton
                    className="ghost"
                    onClick={downloadMessagesMarkdown}
                    type="button"
                  >
                    Download Import Log
                  </LiquidButton>
                </div>
              </div>
            )}
          </div>

          {/* How It Works Card */}
          <div className="content-panel">
            <h2>How It Works</h2>

            <h3>Step-by-step workflow</h3>
            <ol>
              <li><strong>OAuth prompt</strong> — you authorize read-only access</li>
              <li><strong>Permission grant</strong> — limited to gmail.readonly scope</li>
              <li><strong>Receipt scan</strong> — we search for order confirmations</li>
              <li><strong>AI extraction</strong> — GPT extracts product details</li>
              <li><strong>Deduplication</strong> — no duplicate imports via order ID</li>
              <li><strong>Swipe queue</strong> — imported purchases ready for feedback</li>
            </ol>

            <h3>What emails are scanned</h3>
            <p>
              Only receipt and order confirmation patterns (matching sender patterns like
              &quot;noreply,&quot; &quot;no-reply,&quot; &quot;receipts&quot; and subject lines like
              &quot;Order confirmation,&quot; &quot;Your receipt,&quot; &quot;Shipping notification&quot;).
            </p>

            <h3>What data is extracted</h3>
            <ul>
              <li>Product name</li>
              <li>Price</li>
              <li>Vendor</li>
              <li>Category</li>
              <li>Purchase date</li>
              <li>Order ID (for deduplication)</li>
            </ul>

            <h3>What is never read or stored</h3>
            <ul>
              <li>Email body content beyond receipts</li>
              <li>Personal messages</li>
              <li>Attachments</li>
              <li>Contacts</li>
              <li>Drafts</li>
            </ul>

            <h3>How to revoke access</h3>
            <p>
              Click &quot;Disconnect&quot; above, or visit your{' '}
              {provider === 'outlook' ? (
                <a
                  href="https://account.live.com/consent/Manage"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Microsoft Account permissions
                </a>
              ) : (
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Account permissions
                </a>
              )}{' '}
              to revoke access at any time.
            </p>
          </div>
        </div>
      </GlassCard>
    </section>
  )
}
