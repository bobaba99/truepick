import { useCallback, useEffect, useRef, useState } from 'react'
import type { VerdictRow, ShareBackground, LLMEvaluationReasoning } from '../constants/verdictTypes'
import { createSharedVerdict, buildShareUrl } from '../api/verdict/shareService'
import { buildShareImageHtml, renderShareImageToBlob } from '../utils/verdictImageGenerator'
import {
  copyToClipboard,
  downloadBlob,
  shareViaWebShare,
  buildTwitterShareUrl,
  buildWhatsAppShareUrl,
  buildMessengerShareUrl,
  buildIMessageUrl,
} from '../utils/shareHelpers'
import { analytics } from '../hooks/useAnalytics'

type VerdictShareModalProps = {
  verdict: VerdictRow
  userId: string
  isOpen: boolean
  onClose: () => void
}

const BACKGROUNDS: { key: ShareBackground; label: string }[] = [
  { key: 'midnight', label: 'Night' },
  { key: 'aurora', label: 'Aurora' },
  { key: 'sunset', label: 'Sunset' },
  { key: 'nebula', label: 'Nebula' },
  { key: 'sunrise', label: 'Sunrise' },
]

const extractRationalePlain = (reasoning: Record<string, unknown> | null | undefined): string | null => {
  if (!reasoning) return null
  const typed = reasoning as LLMEvaluationReasoning
  if (typed.rationaleOneLiner) return typed.rationaleOneLiner
  const raw = typed.rationale
  if (!raw) return null
  const plain = raw.replace(/<[^>]*>/g, '').trim()
  return plain.length > 120 ? `${plain.slice(0, 117)}...` : plain
}

export default function VerdictShareModal({
  verdict,
  userId,
  isOpen,
  onClose,
}: VerdictShareModalProps) {
  const [background, setBackground] = useState<ShareBackground>('midnight')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const shareLinkStartRef = useRef<number>(0)

  const outcome = verdict.predicted_outcome ?? 'hold'
  const rationale = extractRationalePlain(verdict.reasoning)

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const prepare = async () => {
      setPreparing(true)
      shareLinkStartRef.current = Date.now()
      const result = await createSharedVerdict(verdict, userId)
      if (cancelled) return
      if (result.token) {
        analytics.trackShareLinkCreated(Date.now() - shareLinkStartRef.current)
        analytics.trackShareCardGenerated({
          verdict_id: verdict.id,
          share_destination: null,
          theme_selected: background,
        })
        setShareUrl(buildShareUrl(result.token))
      } else {
        showToast(result.error ?? 'Could not create share link')
      }
      setPreparing(false)
    }
    void prepare()
    return () => { cancelled = true }
  }, [isOpen, verdict, userId, showToast])

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  if (!isOpen) return null

  const imageHtml = buildShareImageHtml({
    product: verdict.candidate_title,
    outcome,
    rationale,
    background,
  })

  const getImageElement = (): HTMLElement | null =>
    previewRef.current?.querySelector('#shareImageInner') ?? null

  const renderAndDownload = async (_filename: string): Promise<Blob | null> => {
    const el = getImageElement()
    if (!el) {
      showToast('Preview not ready')
      return null
    }
    try {
      const renderStart = Date.now()
      const blob = await renderShareImageToBlob(el, 1080)
      analytics.trackShareImageRenderDuration(Date.now() - renderStart)
      return blob
    } catch {
      showToast('Image render failed')
      return null
    }
  }

  const handleDownload = async () => {
    setActionLoading('download')
    const blob = await renderAndDownload(`truepick-${outcome}.png`)
    if (blob) {
      downloadBlob(blob, `truepick-${outcome}.png`)
      analytics.trackVerdictShared('download')
      showToast('Image saved')
    }
    setActionLoading(null)
  }

  const handleNativeShare = async () => {
    setActionLoading('share')
    const blob = await renderAndDownload(`truepick-${outcome}.png`)
    if (!blob) { setActionLoading(null); return }

    const file = new File([blob], `truepick-${outcome}.png`, { type: 'image/png' })
    const shareText = `I asked TruePick about "${verdict.candidate_title}" — verdict: ${outcome.toUpperCase()}`
    const ok = await shareViaWebShare({
      title: 'TruePick Verdict',
      text: shareText,
      url: shareUrl ?? 'https://gettruepick.com',
      files: [file],
    })

    if (!ok) {
      downloadBlob(blob, `truepick-${outcome}.png`)
      showToast('Downloaded — share manually')
    } else {
      analytics.trackVerdictShared('native')
    }
    setActionLoading(null)
  }

  const handleCopyLink = async () => {
    if (!shareUrl) { showToast('Link not ready'); return }
    setActionLoading('copy')
    const ok = await copyToClipboard(shareUrl)
    if (ok) analytics.trackVerdictShared('copy_link')
    showToast(ok ? 'Link copied' : 'Copy failed')
    setActionLoading(null)
  }

  const handleTwitter = () => {
    if (!shareUrl) return
    analytics.trackVerdictShared('twitter')
    const text = `I asked @TruePick about "${verdict.candidate_title}" — verdict: ${outcome.toUpperCase()}`
    window.open(buildTwitterShareUrl(text, shareUrl), '_blank', 'noopener')
  }

  const handleWhatsApp = () => {
    if (!shareUrl) return
    analytics.trackVerdictShared('whatsapp')
    const text = `Check out my TruePick verdict for "${verdict.candidate_title}": ${shareUrl}`
    window.open(buildWhatsAppShareUrl(text), '_blank', 'noopener')
  }

  const handleMessenger = () => {
    if (!shareUrl) return
    analytics.trackVerdictShared('messenger')
    window.open(buildMessengerShareUrl(shareUrl), '_blank', 'noopener')
  }

  const handleIMessage = () => {
    if (!shareUrl) return
    analytics.trackVerdictShared('imessage')
    const text = `Check out my TruePick verdict for "${verdict.candidate_title}": ${shareUrl}`
    window.location.href = buildIMessageUrl(text)
  }

  const handleInstagram = async () => {
    setActionLoading('instagram')
    const blob = await renderAndDownload(`truepick-${outcome}.png`)
    if (blob) {
      downloadBlob(blob, `truepick-${outcome}.png`)
      analytics.trackVerdictShared('instagram')
      showToast('Image saved — open Instagram to share')
    }
    setActionLoading(null)
  }

  const handleTikTok = async () => {
    setActionLoading('tiktok')
    const blob = await renderAndDownload(`truepick-${outcome}.png`)
    if (blob) {
      downloadBlob(blob, `truepick-${outcome}.png`)
      analytics.trackVerdictShared('tiktok')
      showToast('Image saved — open TikTok to share')
    }
    setActionLoading(null)
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  return (
    <>
      <div
        className="share-modal-overlay open"
        onClick={handleBackdropClick}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Share verdict"
        tabIndex={-1}
      >
        <div className="share-modal">
          <div className="share-modal-header">
            <span className="share-modal-title">Share Verdict</span>
            <button
              type="button"
              className="share-modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <div
            className="share-modal-preview"
            ref={previewRef}
            dangerouslySetInnerHTML={{ __html: imageHtml }}
          />

          <div className="share-bg-selector">
            <div className="share-bg-label">Background</div>
            <div className="share-bg-options">
              {BACKGROUNDS.map((bg) => (
                <button
                  key={bg.key}
                  type="button"
                  className={`share-bg-opt${background === bg.key ? ' active' : ''}`}
                  onClick={() => setBackground(bg.key)}
                >
                  <div className="share-bg-swatch" data-bg={bg.key} />
                  <span className="share-bg-opt-label">{bg.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="share-modal-actions">
            {/* Native share (mobile only) */}
            <button
              type="button"
              className="share-modal-btn share-modal-btn--primary share-modal-btn--native"
              onClick={handleNativeShare}
              disabled={preparing || actionLoading !== null}
            >
              {actionLoading === 'share' ? 'Sharing...' : '\u2197 Share'}
            </button>

            {/* Platform grid */}
            <div className="share-platform-grid">
              <PlatformButton icon={PLATFORM_ICONS.iMessage} label="iMessage" onClick={handleIMessage} disabled={!shareUrl || preparing} />
              <PlatformButton icon={PLATFORM_ICONS.messenger} label="Messenger" onClick={handleMessenger} disabled={!shareUrl || preparing} />
              <PlatformButton
                icon={PLATFORM_ICONS.instagram}
                label="Instagram"
                onClick={handleInstagram}
                disabled={preparing || actionLoading !== null}
              />
              <PlatformButton
                icon={PLATFORM_ICONS.tiktok}
                label="TikTok"
                onClick={handleTikTok}
                disabled={preparing || actionLoading !== null}
              />
              <PlatformButton icon={PLATFORM_ICONS.whatsapp} label="WhatsApp" onClick={handleWhatsApp} disabled={!shareUrl || preparing} />
              <PlatformButton icon={PLATFORM_ICONS.twitter} label="X" onClick={handleTwitter} disabled={!shareUrl || preparing} />
            </div>

            {/* Utility actions */}
            <div className="share-utility-row">
              <button
                type="button"
                className="share-modal-btn share-modal-btn--glass"
                onClick={handleDownload}
                disabled={preparing || actionLoading !== null}
              >
                {actionLoading === 'download' ? 'Saving...' : '\u2193 Save Image'}
              </button>

              <button
                type="button"
                className="share-modal-btn share-modal-btn--glass"
                onClick={handleCopyLink}
                disabled={!shareUrl || preparing}
              >
                {preparing ? 'Creating...' : '\u2291 Copy Link'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`share-toast${toast ? ' show' : ''}`}>
        {toast}
      </div>
    </>
  )
}

const PLATFORM_ICONS = {
  iMessage: (
    <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
      <path d="M12 2C6.477 2 2 5.813 2 10.5c0 2.65 1.418 5.008 3.637 6.574L4.5 21.5l4.108-2.396c1.06.332 2.196.517 3.392.517 5.523 0 10-3.813 10-8.621C22 5.813 17.523 2 12 2z" fill="#34D058"/>
      <path d="M12 2C6.477 2 2 5.813 2 10.5c0 2.65 1.418 5.008 3.637 6.574L4.5 21.5l4.108-2.396c1.06.332 2.196.517 3.392.517 5.523 0 10-3.813 10-8.621C22 5.813 17.523 2 12 2z" fill="none" stroke="#2DA44E" strokeWidth="0.5"/>
    </svg>
  ),
  messenger: (
    <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
      <defs>
        <linearGradient id="msg-grad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#00C6FF"/>
          <stop offset="100%" stopColor="#A855F7"/>
        </linearGradient>
      </defs>
      <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.873 1.394 5.435 3.587 7.12V22l3.274-1.797A10.7 10.7 0 0012 20.486c5.523 0 10-4.145 10-9.243C22 6.145 17.523 2 12 2z" fill="url(#msg-grad)"/>
      <path d="M6.5 13.5L10 9.5l2 2 3.5-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
      <defs>
        <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497"/>
          <stop offset="5%" stopColor="#fdf497"/>
          <stop offset="45%" stopColor="#fd5949"/>
          <stop offset="60%" stopColor="#d6249f"/>
          <stop offset="90%" stopColor="#285AEB"/>
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#ig-grad)"/>
      <circle cx="12" cy="12" r="4.5" stroke="#fff" strokeWidth="1.6" fill="none"/>
      <circle cx="17.5" cy="6.5" r="1.2" fill="#fff"/>
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
      <path d="M16.6 5.82A4.1 4.1 0 0113.4 2h-3v13.38a2.56 2.56 0 01-2.56 2.18 2.56 2.56 0 01-2.56-2.56 2.56 2.56 0 012.56-2.56c.28 0 .54.05.79.13V9.38a5.74 5.74 0 00-.79-.06A5.76 5.76 0 002.08 15a5.76 5.76 0 005.76 5.76 5.76 5.76 0 005.76-5.76V9.7a7.3 7.3 0 004.28 1.38V7.9a4.1 4.1 0 01-1.28-.08v0z" fill="#fff"/>
      <path d="M16.6 5.82A4.1 4.1 0 0113.4 2h-3v13.38a2.56 2.56 0 01-2.56 2.18 2.56 2.56 0 01-2.56-2.56 2.56 2.56 0 012.56-2.56c.28 0 .54.05.79.13V9.38a5.74 5.74 0 00-.79-.06A5.76 5.76 0 002.08 15a5.76 5.76 0 005.76 5.76 5.76 5.76 0 005.76-5.76V9.7a7.3 7.3 0 004.28 1.38V7.9a4.1 4.1 0 01-1.28-.08v0z" fill="#25F4EE" style={{transform: 'translate(-1px, -1px)'}}/>
      <path d="M16.6 5.82A4.1 4.1 0 0113.4 2h-3v13.38a2.56 2.56 0 01-2.56 2.18 2.56 2.56 0 01-2.56-2.56 2.56 2.56 0 012.56-2.56c.28 0 .54.05.79.13V9.38a5.74 5.74 0 00-.79-.06A5.76 5.76 0 002.08 15a5.76 5.76 0 005.76 5.76 5.76 5.76 0 005.76-5.76V9.7a7.3 7.3 0 004.28 1.38V7.9a4.1 4.1 0 01-1.28-.08v0z" fill="#FE2C55" style={{transform: 'translate(1px, 1px)'}}/>
      <path d="M16.6 5.82A4.1 4.1 0 0113.4 2h-3v13.38a2.56 2.56 0 01-2.56 2.18 2.56 2.56 0 01-2.56-2.56 2.56 2.56 0 012.56-2.56c.28 0 .54.05.79.13V9.38a5.74 5.74 0 00-.79-.06A5.76 5.76 0 002.08 15a5.76 5.76 0 005.76 5.76 5.76 5.76 0 005.76-5.76V9.7a7.3 7.3 0 004.28 1.38V7.9a4.1 4.1 0 01-1.28-.08v0z" fill="#000"/>
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.86 9.86 0 004.74 1.2h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2z" fill="#25D366"/>
      <path d="M17.47 14.38c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.49-.89-.8-1.5-1.78-1.67-2.08-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.58c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35z" fill="#fff"/>
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" fill="currentColor"/>
    </svg>
  ),
}

function PlatformButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      className="share-platform-btn"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  )
}
