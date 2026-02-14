/**
 * Outlook OAuth (Auth Code + PKCE) Utilities
 * Handles PKCE code generation and token exchange for Microsoft identity platform
 */

const MS_AUTH_BASE = 'https://login.microsoftonline.com/common/oauth2/v2.0'
const OUTLOOK_SCOPES = 'Mail.Read offline_access'

/**
 * Generate a cryptographic random string for PKCE code_verifier
 * Must be 43-128 characters, using unreserved characters [A-Z, a-z, 0-9, -, ., _, ~]
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(64)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[byte % 66]
  ).join('')
}

/**
 * Generate S256 code_challenge from code_verifier
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Start Outlook OAuth flow by redirecting to Microsoft login
 * Stores code_verifier in sessionStorage for token exchange
 */
export async function startOutlookOAuth(clientId: string): Promise<void> {
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  // Store verifier for token exchange after redirect
  sessionStorage.setItem('outlook_code_verifier', codeVerifier)

  const redirectUri = `${window.location.origin}/email-sync`

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: OUTLOOK_SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: 'outlook_oauth',
    prompt: 'consent',
  })

  window.location.href = `${MS_AUTH_BASE}/authorize?${params}`
}

/**
 * Exchange authorization code for tokens using PKCE
 * Returns access_token, refresh_token, and expires_in
 */
export async function exchangeCodeForTokens(
  clientId: string,
  authCode: string
): Promise<{
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
}> {
  const codeVerifier = sessionStorage.getItem('outlook_code_verifier')
  if (!codeVerifier) {
    throw new Error('PKCE code verifier not found. Please restart the OAuth flow.')
  }

  // Clean up stored verifier
  sessionStorage.removeItem('outlook_code_verifier')

  const redirectUri = `${window.location.origin}/email-sync`

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code: authCode,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  })

  const response = await fetch(`${MS_AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      error.error_description ?? error.error ?? 'Token exchange failed'
    )
  }

  const data = await response.json()

  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt,
  }
}

/**
 * Refresh an expired access token using the stored refresh_token
 * Returns new access_token, refresh_token (rotated), and expires_in
 */
export async function refreshOutlookToken(
  clientId: string,
  refreshToken: string
): Promise<{
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
}> {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: OUTLOOK_SCOPES,
  })

  const response = await fetch(`${MS_AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      error.error_description ?? error.error ?? 'Token refresh failed'
    )
  }

  const data = await response.json()

  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt,
  }
}
