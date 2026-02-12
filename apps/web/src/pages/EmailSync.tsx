import { useState, useEffect, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { GlassCard, LiquidButton } from '../components/Kinematics'
import { GmailLogo } from '../components/EmailIcons'
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
  type ImportResult,
} from '../api/importGmail'

type EmailSyncProps = {
  session: Session | null
}

type Status = {
  type: 'idle' | 'loading' | 'success' | 'error'
  message?: string
}

// Gmail OAuth configuration
const GMAIL_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly'
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY ?? ''

export default function EmailSync({ session }: EmailSyncProps) {
  const [connection, setConnection] = useState<EmailConnectionRow | null>(null)
  const [status, setStatus] = useState<Status>({ type: 'idle' })
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [stats, setStats] = useState<{ totalImported: number; lastSyncDate: string | null } | null>(null)
  const [isImporting, setIsImporting] = useState(false)

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

    if (isTokenExpired(connection)) {
      setStatus({ type: 'error', message: 'Token expired. Please reconnect Gmail.' })
      return
    }

    if (!OPENAI_API_KEY) {
      setStatus({ type: 'error', message: 'OpenAI API key not configured' })
      return
    }

    setIsImporting(true)
    setStatus({ type: 'loading', message: 'Scanning emails for receipts...' })
    setImportResult(null)

    try {
      const result = await importGmailReceipts(
        connection.encrypted_token,
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
      loadConnectionData() // Refresh stats
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

      <div className="dashboard-grid">
        {/* Connection Card */}
        <GlassCard className="verdict-result">
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
                  <GmailLogo className="provider-logo" />
                  <span>Gmail Connected</span>
                </div>
                <div className="connection-actions">
                  <LiquidButton
                    className="btn-primary"
                    onClick={handleImport}
                    disabled={isImporting}
                  >
                    {isImporting ? 'Importing...' : 'Import Receipts'}
                  </LiquidButton>
                  <LiquidButton
                    className="btn-secondary"
                    onClick={handleDisconnect}
                    disabled={isImporting}
                  >
                    Disconnect
                  </LiquidButton>
                </div>
              </div>
            ) : (
              <LiquidButton
                className="btn-primary"
                onClick={handleConnectGmail}
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
            </div>
          )}
        </GlassCard>

        {/* How It Works Card */}
        <GlassCard className="verdict-result">
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
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Account permissions
            </a>{' '}
            to revoke access at any time.
          </p>
        </GlassCard>
      </div>
    </section>
  )
}
