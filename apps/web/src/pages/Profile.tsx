import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import type {
  OnboardingAnswers,
  PurchaseRow,
  UserPreferences,
  UserDecision,
  UserRow,
  VerdictRow,
} from '../api/core/types'
import { PURCHASE_CATEGORIES } from '../api/core/types'
import {
  getUserProfile,
  createUserProfile,
  updateUserProfile,
} from '../api/user/userProfileService'
import {
  getVerdictHistory,
  updateVerdictDecision,
  updateVerdictFeedback,
  deleteVerdict,
  evaluatePurchase,
  submitVerdict,
  inputFromVerdict,
} from '../api/verdict/verdictService'
import {
  getPurchaseHistory,
  createPurchase,
  updatePurchase,
  deletePurchase,
} from '../api/purchase/purchaseService'
import VerdictDetailModal from '../components/VerdictDetailModal'
import VerdictShareModal from '../components/VerdictShareModal'
import { GlassCard, LiquidButton, VolumetricInput } from '../components/Kinematics'
import { GmailLogo, OutlookLogo } from '../components/EmailIcons'
import { type FilterState, INITIAL_FILTERS } from '../components/ListFilters.model'
import { useUserFormatting, useUserPreferences } from '../preferences/UserPreferencesContext'
import {
  CURRENCY_OPTIONS,
  HOLD_DURATION_OPTIONS,
  normalizeUserPreferences,
} from '../utils/userPreferences'
import { analytics } from '../hooks/useAnalytics'
import {
  type ProfileTab,
  isProfileTab,
  PURCHASE_PAGE_SIZE,
  coreValueOptions,
  regretPatternOptions,
  satisfactionPatternOptions,
  decisionStyleOptions,
  materialismItems,
  locusOfControlItems,
  identityStabilityOptions,
  themeModeOptions,
  DEFAULT_ONBOARDING,
  normalizeOnboardingAnswers,
} from './profile/profileConstants'
import ProfileTabContent from './profile/ProfileTabContent'
import VerdictsTab from './profile/VerdictsTab'
import PurchasesTab from './profile/PurchasesTab'
import SettingsTab from './profile/SettingsTab'

type ProfileProps = {
  session: Session | null
}

export default function Profile({ session }: ProfileProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<ProfileTab>(isProfileTab(initialTab) ? initialTab : 'profile')
  const { preferences, setPreferences: setGlobalPreferences } = useUserPreferences()
  const { formatCurrency, formatDate } = useUserFormatting()

  const profileModalOpenTimeRef = useRef<number>(0)
  const profileLoadedRef = useRef(false)
  const modalParamHandledRef = useRef(false)
  const regenStartRef = useRef<number>(0)
  const [, setUserRow] = useState<UserRow | null>(null)
  const [verdicts, setVerdicts] = useState<VerdictRow[]>([])
  const [purchases, setPurchases] = useState<PurchaseRow[]>([])
  const [status, setStatus] = useState<string>('')
  const [purchaseTitle, setPurchaseTitle] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseVendor, setPurchaseVendor] = useState('')
  const [purchaseCategory, setPurchaseCategory] = useState('other')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [purchaseSaving, setPurchaseSaving] = useState(false)
  const [purchaseEditingId, setPurchaseEditingId] = useState<string | null>(null)
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [purchaseModalMode, setPurchaseModalMode] = useState<'add' | 'edit'>('add')
  const [purchaseVisibleCount, setPurchaseVisibleCount] = useState(PURCHASE_PAGE_SIZE)
  const [verdictSavingId, setVerdictSavingId] = useState<string | null>(null)
  const [verdictRegeneratingId, setVerdictRegeneratingId] = useState<string | null>(null)
  const [selectedVerdict, setSelectedVerdict] = useState<VerdictRow | null>(null)
  const [shareModalVerdict, setShareModalVerdict] = useState<VerdictRow | null>(null)
  const [profileSummary, setProfileSummary] = useState('')
  const [weeklyFunBudget, setWeeklyFunBudget] = useState('')
  const [profilePreferences, setProfilePreferences] = useState<UserPreferences>(preferences)
  const [profileDraftSummary, setProfileDraftSummary] = useState('')
  const [profileDraftBudget, setProfileDraftBudget] = useState('')
  const [profileDraftPreferences, setProfileDraftPreferences] =
    useState<UserPreferences>(preferences)
  const [onboardingAnswers, setOnboardingAnswers] =
    useState<OnboardingAnswers>(DEFAULT_ONBOARDING)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [preferencesModalOpen, setPreferencesModalOpen] = useState(false)
  const [preferencesSaving, setPreferencesSaving] = useState(false)
  const [emailImportModalOpen, setEmailImportModalOpen] = useState(false)
  const [profileDetailExpanded, setProfileDetailExpanded] = useState(false)

  const materialismAverage =
    (onboardingAnswers.materialism.centrality +
      onboardingAnswers.materialism.happiness +
      onboardingAnswers.materialism.success) /
    3
  const locusSummary = `Work hard ${onboardingAnswers.locusOfControl.workHard}/5, destiny ${onboardingAnswers.locusOfControl.destiny}/5`
  const [verdictSearch, setVerdictSearch] = useState('')
  const [verdictFilters, setVerdictFilters] = useState<FilterState>(INITIAL_FILTERS)
  const [purchaseSearch, setPurchaseSearch] = useState('')
  const [purchaseFilters, setPurchaseFilters] = useState<FilterState>(INITIAL_FILTERS)
  const [verdictFiltersOpen, setVerdictFiltersOpen] = useState(false)
  const [purchaseFiltersOpen, setPurchaseFiltersOpen] = useState(false)
  const [verdictsRemainingToday, setVerdictsRemainingToday] = useState<number | null>(null)
  const regenerateLockMessage =
    'Another verdict is currently being regenerated. Please wait for it to finish.'

  useEffect(() => {
    setProfilePreferences(preferences)
    setProfileDraftPreferences(preferences)
  }, [preferences])

  const matchesSearch = (text: string, query: string) =>
    text.toLowerCase().includes(query.toLowerCase())

  const matchesFilters = (
    item: { candidate_price?: number | null; price?: number; candidate_vendor?: string | null; vendor?: string | null; candidate_category?: string | null; category?: string | null; created_at?: string | null; purchase_date?: string; predicted_outcome?: string | null; user_decision?: string | null; source?: string | null },
    filters: FilterState,
  ) => {
    const price = item.candidate_price ?? item.price ?? null
    const vendor = item.candidate_vendor ?? item.vendor ?? ''
    const category = item.candidate_category ?? item.category ?? ''
    const date = item.created_at ?? item.purchase_date ?? ''

    if (filters.vendor && !matchesSearch(vendor ?? '', filters.vendor)) return false
    if (filters.category && category?.toLowerCase() !== filters.category.toLowerCase()) return false
    if (filters.priceMin && (price === null || price < Number(filters.priceMin))) return false
    if (filters.priceMax && (price === null || price > Number(filters.priceMax))) return false
    if (filters.date && date && !date.startsWith(filters.date)) return false
    if (filters.recommendation && item.predicted_outcome !== filters.recommendation) return false
    if (filters.decision && item.user_decision !== filters.decision) return false
    if (filters.source && item.source !== filters.source) return false
    return true
  }

  const filteredVerdicts = verdicts.filter((v) => {
    if (verdictSearch && !matchesSearch(v.candidate_title, verdictSearch)) return false
    return matchesFilters(v, verdictFilters)
  })

  const filteredPurchases = purchases.filter((p) => {
    if (purchaseSearch && !matchesSearch(p.title, purchaseSearch)) return false
    return matchesFilters(p, purchaseFilters)
  })

  const visiblePurchases = filteredPurchases.slice(0, purchaseVisibleCount)
  const hasMorePurchases = filteredPurchases.length > purchaseVisibleCount

  const loadProfile = useCallback(async () => {
    if (!session) return

    try {
      const data = await getUserProfile(session.user.id)

      if (!data) {
        if (!session.user.email) {
          setUserRow(null)
          return
        }

        const { error: insertError, isConflict } = await createUserProfile(
          session.user.id,
          session.user.email,
        )

        if (insertError) {
          setUserRow(null)
          if (isConflict) {
            console.error(
              'Email conflict: a users row exists with this email but a different ID.',
              'Run the sync_auth_users migration to fix this.',
            )
            setStatus(
              'Profile sync issue. Please contact support or try signing out and back in.',
            )
            return
          }

          setStatus(`Profile creation failed: ${insertError}`)
          return
        }

        const refreshedProfile = await getUserProfile(session.user.id)
        if (!refreshedProfile) {
          setStatus('Profile created but could not be fetched yet. Please refresh.')
          return
        }

        setUserRow(refreshedProfile)
        const summaryValue = refreshedProfile.profile_summary ?? ''
        const budgetValue =
          refreshedProfile.weekly_fun_budget !== null &&
          refreshedProfile.weekly_fun_budget !== undefined
            ? String(refreshedProfile.weekly_fun_budget)
            : ''
        const normalizedPreferences = normalizeUserPreferences(
          refreshedProfile.preferences ?? null,
        )

        setProfileSummary(summaryValue)
        setWeeklyFunBudget(budgetValue)
        setProfileDraftSummary(summaryValue)
        setProfileDraftBudget(budgetValue)
        setProfilePreferences(normalizedPreferences)
        setProfileDraftPreferences(normalizedPreferences)
        setGlobalPreferences(normalizedPreferences)
        setOnboardingAnswers(
          normalizeOnboardingAnswers(refreshedProfile.onboarding_answers ?? null),
        )
        setStatus('')
        profileLoadedRef.current = true
        return
      }

      setUserRow(data)
      const summaryValue = data.profile_summary ?? ''
      const budgetValue =
        data.weekly_fun_budget !== null && data.weekly_fun_budget !== undefined
          ? String(data.weekly_fun_budget)
          : ''
      const normalizedPreferences = normalizeUserPreferences(data.preferences ?? null)

      setProfileSummary(summaryValue)
      setWeeklyFunBudget(
        budgetValue,
      )
      setProfileDraftSummary(summaryValue)
      setProfileDraftBudget(budgetValue)
      setProfilePreferences(normalizedPreferences)
      setProfileDraftPreferences(normalizedPreferences)
      setGlobalPreferences(normalizedPreferences)
      setOnboardingAnswers(normalizeOnboardingAnswers(data.onboarding_answers ?? null))
      setStatus('')
      profileLoadedRef.current = true
    } catch (err) {
      console.error('Profile load error', err)
      setStatus(`Profile load error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [session, setGlobalPreferences])

  const DAILY_LIMIT = 3

  const loadVerdicts = useCallback(async () => {
    if (!session) return

    try {
      const data = await getVerdictHistory(session.user.id, 10)
      setVerdicts(data)

      const todayUtc = new Date()
      todayUtc.setUTCHours(0, 0, 0, 0)
      const usedToday = data.filter(
        (v) =>
          v.created_at !== null &&
          new Date(v.created_at).getTime() >= todayUtc.getTime() &&
          v.scoring_model !== 'heuristic_fallback'
      ).length
      setVerdictsRemainingToday(Math.max(0, DAILY_LIMIT - usedToday))
    } catch {
      setStatus('Unable to load verdicts from Supabase. Check RLS policies.')
    }
  }, [session])

  const loadPurchases = useCallback(async () => {
    if (!session) return

    try {
      const data = await getPurchaseHistory(session.user.id, 50)
      setPurchases(data)
    } catch {
      setStatus('Unable to load purchases from Supabase. Check RLS policies.')
    }
  }, [session])

  useEffect(() => {
    if (!session) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void loadProfile().then(() => {
        if (
          profileLoadedRef.current &&
          !modalParamHandledRef.current &&
          searchParams.get('modal') === 'quiz'
        ) {
          modalParamHandledRef.current = true
          analytics.trackProfileModalOpened()
          profileModalOpenTimeRef.current = Date.now()
          setProfileModalOpen(true)
        }
      })
      void loadVerdicts()
      void loadPurchases()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [session, loadProfile, loadVerdicts, loadPurchases, searchParams])

  // Track empty states once data has loaded
  const emptyVerdictTrackedRef = useRef(false)
  const emptyPurchaseTrackedRef = useRef(false)
  useEffect(() => {
    if (!session) return
    if (verdicts.length === 0 && !emptyVerdictTrackedRef.current) {
      emptyVerdictTrackedRef.current = true
      analytics.trackEmptyStateShown('profile', 'no_verdicts')
    }
    if (purchases.length === 0 && !emptyPurchaseTrackedRef.current) {
      emptyPurchaseTrackedRef.current = true
      analytics.trackEmptyStateShown('profile', 'no_purchases')
    }
  }, [session, verdicts.length, purchases.length])

  const resetPurchaseForm = () => {
    setPurchaseTitle('')
    setPurchasePrice('')
    setPurchaseVendor('')
    setPurchaseCategory('other')
    setPurchaseDate('')
    setPurchaseEditingId(null)
    setPurchaseModalOpen(false)
    setPurchaseModalMode('add')
  }

  const toggleSelection = (items: string[], value: string) => {
    if (items.includes(value)) {
      return items.filter((item) => item !== value)
    }
    return [...items, value]
  }

  const handleTabSwitch = (tab: ProfileTab) => {
    analytics.trackProfileTabSwitched(tab)
    setActiveTab(tab)
  }

  const openProfileModal = () => {
    analytics.trackProfileModalOpened()
    profileModalOpenTimeRef.current = Date.now()
    setProfileDraftSummary(profileSummary)
    setProfileDraftBudget(weeklyFunBudget)
    setProfileModalOpen(true)
  }

  const _openPreferencesModal = () => {
    setProfileDraftPreferences(profilePreferences)
    setPreferencesModalOpen(true)
  }

  const handleThemeSelection = (theme: UserPreferences['theme']) => {
    setProfileDraftPreferences((prev) => ({
      ...prev,
      theme,
    }))
    setGlobalPreferences({
      ...preferences,
      theme,
    })
  }

  const handleProfileSave = async () => {
    if (!session) return

    const budgetValue =
      profileDraftBudget.trim() === '' ? null : Number(profileDraftBudget)
    if (budgetValue !== null && (Number.isNaN(budgetValue) || budgetValue < 0)) {
      setStatus('Weekly fun budget must be a positive number.')
      return
    }

    setProfileSaving(true)
    setStatus('')

    const { error } = await updateUserProfile(session.user.id, {
      profileSummary:
        profileDraftSummary.trim() === '' ? null : profileDraftSummary.trim(),
      weeklyFunBudget: budgetValue,
    })

    if (error) {
      setStatus(error)
      setProfileSaving(false)
      return { error }
    }

    analytics.trackProfileUpdated(
      budgetValue !== null,
      onboardingAnswers.coreValues.length > 0 ? 1 : 0,
    )
    await loadProfile()
    setProfileModalOpen(false)
    setProfileSaving(false)
    return { error: null }
  }

  const handlePreferencesSave = async () => {
    if (!session) return

    setPreferencesSaving(true)
    setStatus('')

    const { error } = await updateUserProfile(session.user.id, {
      preferences: profileDraftPreferences,
    })

    if (error) {
      setStatus(error)
      setPreferencesSaving(false)
      return { error }
    }

    // Track each changed setting
    if (profileDraftPreferences.theme !== profilePreferences.theme) {
      analytics.trackSettingsChanged('theme', profileDraftPreferences.theme)
    }
    if (profileDraftPreferences.currency !== profilePreferences.currency) {
      analytics.trackSettingsChanged('currency', profileDraftPreferences.currency)
    }
    if (profileDraftPreferences.locale !== profilePreferences.locale) {
      analytics.trackSettingsChanged('locale', profileDraftPreferences.locale)
    }
    if (profileDraftPreferences.hold_duration_hours !== profilePreferences.hold_duration_hours) {
      analytics.trackSettingsChanged('hold_duration_hours', String(profileDraftPreferences.hold_duration_hours))
    }
    if (profileDraftPreferences.hold_reminders_enabled !== profilePreferences.hold_reminders_enabled) {
      analytics.trackSettingsChanged('hold_reminders_enabled', String(profileDraftPreferences.hold_reminders_enabled))
    }

    setProfilePreferences(profileDraftPreferences)
    setGlobalPreferences(profileDraftPreferences)
    await loadProfile()
    setPreferencesModalOpen(false)
    setPreferencesSaving(false)
    return { error: null }
  }

  const handleOnboardingSave = async () => {
    if (!session) return

    setProfileSaving(true)
    setStatus('')

    const { error } = await updateUserProfile(session.user.id, {
      onboardingAnswers,
    })

    if (error) {
      setStatus(error)
      setProfileSaving(false)
      return { error }
    }

    await loadProfile()
    setProfileModalOpen(false)
    setProfileSaving(false)
    return { error: null }
  }

  const handlePurchaseSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    if (!session) {
      return
    }

    const priceValue = Number(purchasePrice)
    if (!purchaseTitle.trim()) {
      setStatus('Purchase title is required.')
      return
    }
    if (Number.isNaN(priceValue) || priceValue <= 0) {
      setStatus('Purchase price must be a positive number.')
      return
    }
    if (!purchaseDate) {
      setStatus('Purchase date is required.')
      return
    }

    setPurchaseSaving(true)
    setStatus('')

    const payload = {
      title: purchaseTitle.trim(),
      price: priceValue,
      vendor: purchaseVendor.trim() || null,
      category: purchaseCategory.trim() || null,
      purchaseDate: purchaseDate,
      source: 'manual',
    }

    const { error, isDuplicate } = purchaseEditingId
      ? await updatePurchase(session.user.id, purchaseEditingId, payload)
      : await createPurchase(payload)

    if (isDuplicate) {
      setStatus('This purchase already exists.')
      setPurchaseSaving(false)
      return
    }

    if (error) {
      setStatus(error)
      setPurchaseSaving(false)
      return
    }

    if (!purchaseEditingId) {
      analytics.trackPurchaseAdded('manual')
    }
    await loadPurchases()
    resetPurchaseForm()
    setPurchaseSaving(false)
  }

  const handlePurchaseEdit = (purchase: PurchaseRow) => {
    setPurchaseEditingId(purchase.id)
    setPurchaseTitle(purchase.title)
    setPurchasePrice(purchase.price.toString())
    setPurchaseVendor(purchase.vendor ?? '')
    setPurchaseCategory(purchase.category ?? 'other')
    setPurchaseDate(purchase.purchase_date)
    setPurchaseModalMode('edit')
    setPurchaseModalOpen(true)
  }

  const handlePurchaseDelete = async (purchaseId: string) => {
    if (!session) return

    setPurchaseSaving(true)
    setStatus('')

    const { error } = await deletePurchase(session.user.id, purchaseId)

    if (error) {
      setStatus(error)
      setPurchaseSaving(false)
      return
    }

    analytics.trackPurchaseDeleted()
    await loadPurchases()
    await loadVerdicts()
    setPurchaseSaving(false)
  }

  const handleVerdictDecision = async (verdictId: string, decision: UserDecision) => {
    if (!session) return

    setVerdictSavingId(verdictId)
    setStatus('')

    const verdict = verdicts.find((v) => v.id === verdictId)
    const verdictAgeSeconds = verdict?.created_at
      ? (Date.now() - new Date(verdict.created_at).getTime()) / 1000
      : 0

    const { error } = await updateVerdictDecision(session.user.id, verdictId, decision)

    if (error) {
      setStatus(error)
      setVerdictSavingId(null)
      return
    }

    analytics.trackVerdictDecision(decision, verdictAgeSeconds)

    const isOverride =
      (verdict?.predicted_outcome === 'buy' && decision === 'skip') ||
      (verdict?.predicted_outcome === 'skip' && decision === 'bought')
    if (isOverride && verdict) {
      analytics.trackVerdictOverride({
        verdict_id: verdictId,
        original_verdict: verdict.predicted_outcome ?? 'unknown',
        user_action: decision === 'skip' ? 'skipped_anyway' : 'bought_anyway',
        time_since_verdict_ms: verdictAgeSeconds * 1000,
      })
    }

    await loadVerdicts()
    await loadPurchases()
    setVerdictSavingId(null)
  }

  const handleVerdictFeedback = async (verdict: VerdictRow, value: 1 | -1) => {
    if (!session) return

    const newFeedback = verdict.verdict_feedback === value ? null : value
    const previous = verdict.verdict_feedback ?? null

    setVerdicts((prev) =>
      prev.map((v) =>
        v.id === verdict.id ? { ...v, verdict_feedback: newFeedback } : v
      )
    )

    const feedbackLabel = newFeedback === 1 ? 'up' : newFeedback === -1 ? 'down' : 'removed'
    analytics.trackVerdictFeedback(feedbackLabel, verdict.predicted_outcome ?? 'unknown')

    const { error } = await updateVerdictFeedback(session.user.id, verdict.id, newFeedback)

    if (error) {
      setVerdicts((prev) =>
        prev.map((v) =>
          v.id === verdict.id ? { ...v, verdict_feedback: previous } : v
        )
      )
      setStatus(error)
    }
  }

  const handleVerdictDelete = async (verdictId: string) => {
    if (!session) return

    setVerdictSavingId(verdictId)
    setStatus('')

    const { error } = await deleteVerdict(session.user.id, verdictId)

    if (error) {
      setStatus(error)
      setVerdictSavingId(null)
      return
    }

    await loadVerdicts()
    await loadPurchases()
    setVerdictSavingId(null)
  }

  const handleVerdictRegenerate = async (verdict: VerdictRow) => {
    if (!session) return
    if (verdictRegeneratingId) {
      window.alert(regenerateLockMessage)
      return
    }

    setVerdictRegeneratingId(verdict.id)
    setStatus('')
    regenStartRef.current = Date.now()

    try {
      const input = inputFromVerdict(verdict)
      const evaluation = await evaluatePurchase(session.user.id, input, verdict.id)
      const { data, error } = await submitVerdict(
        session.user.id,
        input,
        evaluation,
        verdict.id
      )

      if (error || !data) {
        setStatus(error ?? 'Failed to regenerate verdict.')
        return
      }

      analytics.trackVerdictRegenDuration(Date.now() - regenStartRef.current)
      analytics.trackVerdictRegenerated()

      if (evaluation.verdictsRemaining !== undefined) {
        setVerdictsRemainingToday(evaluation.verdictsRemaining)
      }

      setVerdicts((previousVerdicts) =>
        previousVerdicts.map((previousVerdict) =>
          previousVerdict.id === data.id ? data : previousVerdict
        )
      )
      if (selectedVerdict?.id === data.id) {
        setSelectedVerdict(data)
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'daily_limit_reached' &&
        'paywallData' in error
      ) {
        const pd = (error as Error & { paywallData: Record<string, unknown> }).paywallData
        setVerdictsRemainingToday(0)
        void pd
      }
      setStatus('Failed to regenerate verdict.')
    } finally {
      setVerdictRegeneratingId((currentVerdictId) =>
        currentVerdictId === verdict.id ? null : currentVerdictId
      )
    }
  }

  /* Profile tab content rendered via <ProfileTabContent /> */

  /* Verdicts tab content rendered via <VerdictsTab /> */

  /* Purchases tab content rendered via <PurchasesTab /> */

  return (
    <section className="route-content">
      <h1>Profile</h1>

      {status && <div className="status error">{status}</div>}

      {session?.user.is_anonymous ? (
        <GlassCard className="guest-profile-cta">
          <h2>You're browsing as a guest</h2>
          <p>
            Sign up with email, Google, or Apple to save your verdicts,
            quiz results, and preferences across devices.
          </p>
          <LiquidButton
            className="primary"
            type="button"
            onClick={() => navigate('/auth?mode=sign_up')}
          >
            Create an account
          </LiquidButton>
        </GlassCard>
      ) : (
        <div className="profile-header-card">
          <span className="value">{session?.user.email}</span>
          {verdictsRemainingToday !== null && (
            <span className={`verdicts-remaining-pill${verdictsRemainingToday === 0 ? ' exhausted' : ''}`}>
              {verdictsRemainingToday === 0
                ? 'Daily limit reached'
                : `${verdictsRemainingToday} free verdict${verdictsRemainingToday === 1 ? '' : 's'} remaining today`}
            </span>
          )}
        </div>
      )}

      <div className="profile-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'profile'}
          className={`profile-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('profile')}
        >
          Profile
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'verdicts'}
          className={`profile-tab ${activeTab === 'verdicts' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('verdicts')}
        >
          Verdicts
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'purchases'}
          className={`profile-tab ${activeTab === 'purchases' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('purchases')}
        >
          Purchases
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'settings'}
          className={`profile-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('settings')}
        >
          Settings
        </button>
      </div>

      <div key={activeTab} className="profile-tab-content" role="tabpanel">
        {activeTab === 'profile' && (
          <ProfileTabContent
            profileSummary={profileSummary}
            weeklyFunBudget={weeklyFunBudget}
            onboardingAnswers={onboardingAnswers}
            materialismAverage={materialismAverage}
            locusSummary={locusSummary}
            profileDetailExpanded={profileDetailExpanded}
            onToggleDetail={() => setProfileDetailExpanded((prev) => !prev)}
            onEditProfile={openProfileModal}
            formatCurrency={formatCurrency}
          />
        )}
        {activeTab === 'verdicts' && (
          <VerdictsTab
            verdicts={verdicts}
            filteredVerdicts={filteredVerdicts}
            verdictsRemainingToday={verdictsRemainingToday}
            verdictSavingId={verdictSavingId}
            verdictRegeneratingId={verdictRegeneratingId}
            verdictSearch={verdictSearch}
            verdictFilters={verdictFilters}
            verdictFiltersOpen={verdictFiltersOpen}
            holdDurationHours={profileDraftPreferences.hold_duration_hours}
            onSearchChange={setVerdictSearch}
            onFilterChange={setVerdictFilters}
            onToggleFilters={() => setVerdictFiltersOpen((prev) => !prev)}
            onSelectVerdict={setSelectedVerdict}
            onShareVerdict={setShareModalVerdict}
            onRegenerateVerdict={handleVerdictRegenerate}
            onDecision={handleVerdictDecision}
            onFeedback={handleVerdictFeedback}
            onDeleteVerdict={handleVerdictDelete}
            formatCurrency={(v) => formatCurrency(v ?? 0)}
            formatDate={(v) => (v ? formatDate(v) : '')}
          />
        )}
        {activeTab === 'purchases' && (
          <PurchasesTab
            purchases={purchases}
            filteredPurchases={filteredPurchases}
            purchaseVisibleCount={purchaseVisibleCount}
            purchaseSaving={purchaseSaving}
            purchaseSearch={purchaseSearch}
            purchaseFilters={purchaseFilters}
            purchaseFiltersOpen={purchaseFiltersOpen}
            onSearchChange={setPurchaseSearch}
            onFilterChange={setPurchaseFilters}
            onToggleFilters={() => setPurchaseFiltersOpen((prev) => !prev)}
            onOpenEmailImport={() => setEmailImportModalOpen(true)}
            onAddPurchase={() => {
              setPurchaseModalMode('add')
              setPurchaseModalOpen(true)
            }}
            onEditPurchase={handlePurchaseEdit}
            onDeletePurchase={handlePurchaseDelete}
            onLoadMore={() => setPurchaseVisibleCount((prev) => prev + PURCHASE_PAGE_SIZE)}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            session={session}
            profileDraftPreferences={profileDraftPreferences}
            preferencesSaving={preferencesSaving}
            onThemeSelection={handleThemeSelection}
            onPreferenceChange={setProfileDraftPreferences}
            onSave={() => { void handlePreferencesSave() }}
            onNavigate={navigate}
          />
        )}
      </div>

      {selectedVerdict && createPortal(
        <VerdictDetailModal
          verdict={selectedVerdict}
          isOpen={selectedVerdict !== null}
          onClose={() => setSelectedVerdict(null)}
          onRegenerate={handleVerdictRegenerate}
          onShare={(v) => {
            setSelectedVerdict(null)
            setShareModalVerdict(v)
          }}
          onFeedback={(v, value) => {
            handleVerdictFeedback(v, value)
            const newFeedback = v.verdict_feedback === value ? null : value
            setSelectedVerdict({ ...v, verdict_feedback: newFeedback })
          }}
          isRegenerating={verdictRegeneratingId === selectedVerdict.id}
        />,
        document.body
      )}

      {shareModalVerdict && session && createPortal(
        <VerdictShareModal
          verdict={shareModalVerdict}
          userId={session.user.id}
          isOpen={shareModalVerdict !== null}
          onClose={() => setShareModalVerdict(null)}
        />,
        document.body
      )}

      {purchaseModalOpen && createPortal(
        <div
          className="modal-backdrop"
          onClick={(event: MouseEvent<HTMLDivElement>) => {
            if (event.target === event.currentTarget) {
              setPurchaseModalOpen(false)
            }
          }}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'Escape') {
              setPurchaseModalOpen(false)
            }
          }}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h2>{purchaseModalMode === 'edit' ? 'Edit purchase' : 'Add purchase'}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setPurchaseModalOpen(false)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <form className="purchase-form" onSubmit={handlePurchaseSubmit}>
                <label>
                  Item title
                  <VolumetricInput
                    as="input"
                    value={purchaseTitle}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setPurchaseTitle(event.target.value)
                    }
                    placeholder="Noise cancelling headphones"
                    required
                  />
                </label>
                <label>
                  Price
                  <VolumetricInput
                    as="input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={purchasePrice}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setPurchasePrice(event.target.value)
                    }
                    placeholder="129.00"
                    required
                  />
                </label>
                <label>
                  Vendor
                  <VolumetricInput
                    as="input"
                    value={purchaseVendor}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setPurchaseVendor(event.target.value)
                    }
                    placeholder="Amazon"
                  />
                </label>
                <label>
                  Category
                  <VolumetricInput
                    as="select"
                    className="purchase-select"
                    value={purchaseCategory || 'other'}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      setPurchaseCategory(event.target.value)
                    }
                  >
                    {PURCHASE_CATEGORIES.map((cat: { value: string; label: string }) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </VolumetricInput>
                </label>
                <label>
                  Purchase date
                  <VolumetricInput
                    as="input"
                    type="date"
                    value={purchaseDate}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setPurchaseDate(event.target.value)
                    }
                    required
                  />
                </label>
                <div className="values-actions">
                  <LiquidButton className="primary" type="submit" disabled={purchaseSaving}>
                    {purchaseSaving
                      ? 'Saving...'
                      : purchaseModalMode === 'edit'
                        ? 'Update purchase'
                        : 'Add purchase'}
                  </LiquidButton>
                  <LiquidButton
                    className="ghost"
                    type="button"
                    onClick={resetPurchaseForm}
                    disabled={purchaseSaving}
                  >
                    Cancel
                  </LiquidButton>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {profileModalOpen && createPortal(
        <div
          className="modal-backdrop"
          onClick={(event: MouseEvent<HTMLDivElement>) => {
            if (event.target === event.currentTarget) {
              analytics.trackProfileModalAbandoned(
                (Date.now() - profileModalOpenTimeRef.current) / 1000,
                0,
              )
              setProfileModalOpen(false)
            }
          }}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'Escape') {
              analytics.trackProfileModalAbandoned(
                (Date.now() - profileModalOpenTimeRef.current) / 1000,
                0,
              )
              setProfileModalOpen(false)
            }
          }}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h2>Profile details</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  analytics.trackProfileModalAbandoned(
                    (Date.now() - profileModalOpenTimeRef.current) / 1000,
                    0,
                  )
                  setProfileModalOpen(false)
                }}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="quiz-section">
                <h3>Personal summary</h3>
                <p>Describe who you are and what you are optimizing for.</p>
                <label className="modal-field">
                  <VolumetricInput
                    as="textarea"
                    value={profileDraftSummary}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                      setProfileDraftSummary(event.target.value)
                    }
                    placeholder="The user prioritises financial stability and minimalism, often regrets impulse tech purchases, is most satisfied with durable functional items, and has a moderately deliberate decision style."
                    rows={4}
                  />
                </label>
              </div>

              <div className="quiz-section">
                <h3>Weekly fun budget</h3>
                <p>Set a weekly ceiling for fun and entertainment purchases.</p>
                <label className="modal-field">
                  <VolumetricInput
                    as="input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={profileDraftBudget}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setProfileDraftBudget(event.target.value)
                    }
                    placeholder="120.00"
                  />
                </label>
              </div>

              <div className="quiz-section">
                <h3>1. Core Values</h3>
                <p>Which of these matter most to you when buying something?</p>
                <div className="quiz-options">
                  {coreValueOptions.map((option) => {
                    const selected = onboardingAnswers.coreValues.includes(option)
                    return (
                      <LiquidButton
                        key={option}
                        type="button"
                        className={`quiz-chip ${selected ? 'selected' : ''}`}
                        onClick={() =>
                          setOnboardingAnswers((prev) => ({
                            ...prev,
                            coreValues: toggleSelection(prev.coreValues, option),
                          }))
                        }
                      >
                        {option}
                      </LiquidButton>
                    )
                  })}
                </div>
              </div>

              <div className="quiz-section">
                <h3>2. Typical Regret Pattern</h3>
                <p>When you regret a purchase, it is usually because…</p>
                <div className="quiz-options">
                  {regretPatternOptions.map((option) => {
                    const selected = onboardingAnswers.regretPatterns.includes(option)
                    return (
                      <LiquidButton
                        key={option}
                        type="button"
                        className={`quiz-chip ${selected ? 'selected' : ''}`}
                        onClick={() =>
                          setOnboardingAnswers((prev) => ({
                            ...prev,
                            regretPatterns: toggleSelection(prev.regretPatterns, option),
                          }))
                        }
                      >
                        {option}
                      </LiquidButton>
                    )
                  })}
                </div>
              </div>

              <div className="quiz-section">
                <h3>3. Typical Satisfaction Pattern</h3>
                <p>When a purchase feels truly worth it, it usually…</p>
                <div className="quiz-options">
                  {satisfactionPatternOptions.map((option) => {
                    const selected = onboardingAnswers.satisfactionPatterns.includes(option)
                    return (
                      <LiquidButton
                        key={option}
                        type="button"
                        className={`quiz-chip ${selected ? 'selected' : ''}`}
                        onClick={() =>
                          setOnboardingAnswers((prev) => ({
                            ...prev,
                            satisfactionPatterns: selected
                              ? prev.satisfactionPatterns.filter((item) => item !== option)
                              : [...prev.satisfactionPatterns, option],
                          }))
                        }
                      >
                        {option}
                      </LiquidButton>
                    )
                  })}
                </div>
              </div>

              <div className="quiz-section">
                <h3>4. How you decide</h3>
                <p>Which best describes how you usually decide?</p>
                <div className="quiz-options">
                  {decisionStyleOptions.map((option) => (
                    <LiquidButton
                      key={option}
                      type="button"
                      className={`quiz-chip ${onboardingAnswers.decisionStyle === option ? 'selected' : ''
                        }`}
                      onClick={() =>
                        setOnboardingAnswers((prev) => ({
                          ...prev,
                          decisionStyle: option,
                        }))
                      }
                    >
                      {option}
                    </LiquidButton>
                  ))}
                </div>
              </div>

              <div className="quiz-section">
                <h3>5. Under stress</h3>
                <p>
                  I tend to experience negative emotions easily (e.g., worry, nervousness,
                  tension, sadness), and I find it difficult to stay calm or emotionally steady
                  under stress.
                </p>
                <div className="quiz-range">
                  <label>
                    Scale: 1 = Disagree a lot, 5 = Agree a lot
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={onboardingAnswers.neuroticismScore}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setOnboardingAnswers((prev) => ({
                          ...prev,
                          neuroticismScore: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <span className="range-value">{onboardingAnswers.neuroticismScore}</span>
                </div>
              </div>

              <div className="quiz-section">
                <h3>6. Views on expensive things</h3>
                <p>Rate each 1–4 (1 = No, not at all; 4 = Yes, very much).</p>
                {materialismItems.map((item) => (
                  <div key={item.key} className="quiz-range">
                    <label>
                      {item.prompt}
                      <input
                        type="range"
                        min="1"
                        max="4"
                        step="1"
                        value={onboardingAnswers.materialism[item.key]}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setOnboardingAnswers((prev) => ({
                            ...prev,
                            materialism: {
                              ...prev.materialism,
                              [item.key]: Number(event.target.value),
                            },
                          }))
                        }
                      />
                    </label>
                    <span className="range-value">
                      {onboardingAnswers.materialism[item.key]}
                    </span>
                  </div>
                ))}
              </div>

              <div className="quiz-section">
                <h3>7. Sense of control</h3>
                <p>Scale: 1 = does not apply at all, 5 = applies completely.</p>
                {locusOfControlItems.map((item) => (
                  <div key={item.key} className="quiz-range">
                    <label>
                      {item.prompt}
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={onboardingAnswers.locusOfControl[item.key]}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setOnboardingAnswers((prev) => ({
                            ...prev,
                            locusOfControl: {
                              ...prev.locusOfControl,
                              [item.key]: Number(event.target.value),
                            },
                          }))
                        }
                      />
                    </label>
                    <span className="range-value">
                      {onboardingAnswers.locusOfControl[item.key]}
                    </span>
                  </div>
                ))}
              </div>

              <div className="quiz-section">
                <h3>8. Identity alignment</h3>
                <p>
                  How important is it that your purchases reflect who you believe you are?
                </p>
                <div className="quiz-options">
                  {identityStabilityOptions.map((option) => (
                    <LiquidButton
                      key={option}
                      type="button"
                      className={`quiz-chip ${onboardingAnswers.identityStability === option ? 'selected' : ''
                        }`}
                      onClick={() =>
                        setOnboardingAnswers((prev) => ({
                          ...prev,
                          identityStability: option,
                        }))
                      }
                    >
                      {option}
                    </LiquidButton>
                  ))}
                </div>
              </div>

              <div className="values-actions">
                <LiquidButton
                  className="primary"
                  type="button"
                  onClick={async () => {
                    const profileResult = await handleProfileSave()
                    if (profileResult?.error) {
                      return
                    }
                    await handleOnboardingSave()
                  }}
                  disabled={profileSaving}
                >
                  {profileSaving ? 'Saving...' : 'Save profile'}
                </LiquidButton>
                <LiquidButton
                  className="ghost"
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                >
                  Close
                </LiquidButton>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {preferencesModalOpen && createPortal(
        <div
          className="modal-backdrop"
          onClick={(event: MouseEvent<HTMLDivElement>) => {
            if (event.target === event.currentTarget) {
              setPreferencesModalOpen(false)
            }
          }}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'Escape') {
              setPreferencesModalOpen(false)
            }
          }}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h2>User preferences</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setPreferencesModalOpen(false)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="quiz-section">
                <h3>Theme mode</h3>
                <p>Choose your app theme.</p>
                <div className="quiz-options">
                  {themeModeOptions.map((option) => (
                    <LiquidButton
                      key={option.value}
                      type="button"
                      className={`quiz-chip ${profileDraftPreferences.theme === option.value ? 'selected' : ''}`}
                      onClick={() => handleThemeSelection(option.value)}
                    >
                      {option.label}
                    </LiquidButton>
                  ))}
                </div>
              </div>

              <div className="quiz-section">
                <h3>Formatting</h3>
                <p>Set your preferred currency for amount formatting.</p>
                <label className="modal-field">
                  Currency
                  <VolumetricInput
                    as="select"
                    className="purchase-select"
                    value={profileDraftPreferences.currency}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      setProfileDraftPreferences((prev) => ({
                        ...prev,
                        currency: event.target.value,
                      }))
                    }
                  >
                    {CURRENCY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </VolumetricInput>
                </label>
              </div>

              <div className="quiz-section">
                <h3>Hold behavior</h3>
                <p>Control your default hold window and reminder setting.</p>
                <label className="modal-field">
                  Hold duration
                  <VolumetricInput
                    as="select"
                    className="purchase-select"
                    value={profileDraftPreferences.hold_duration_hours}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      setProfileDraftPreferences((prev) => ({
                        ...prev,
                        hold_duration_hours: Number(event.target.value) as UserPreferences['hold_duration_hours'],
                      }))
                    }
                  >
                    {HOLD_DURATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </VolumetricInput>
                </label>
                <div className="modal-field">
                  <span>Hold reminders</span>
                  <div className="quiz-options">
                    <LiquidButton
                      type="button"
                      className={`quiz-chip ${profileDraftPreferences.hold_reminders_enabled ? 'selected' : ''}`}
                      onClick={() =>
                        setProfileDraftPreferences((prev) => ({
                          ...prev,
                          hold_reminders_enabled: true,
                        }))
                      }
                    >
                      Enabled
                    </LiquidButton>
                    <LiquidButton
                      type="button"
                      className={`quiz-chip ${!profileDraftPreferences.hold_reminders_enabled ? 'selected' : ''}`}
                      onClick={() =>
                        setProfileDraftPreferences((prev) => ({
                          ...prev,
                          hold_reminders_enabled: false,
                        }))
                      }
                    >
                      Disabled
                    </LiquidButton>
                  </div>
                </div>
              </div>

              <div className="values-actions">
                <LiquidButton
                  className="primary"
                  type="button"
                  onClick={() => {
                    void handlePreferencesSave()
                  }}
                  disabled={preferencesSaving}
                >
                  {preferencesSaving ? 'Saving...' : 'Save preferences'}
                </LiquidButton>
                <LiquidButton
                  className="ghost"
                  type="button"
                  onClick={() => setPreferencesModalOpen(false)}
                  disabled={preferencesSaving}
                >
                  Cancel
                </LiquidButton>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {emailImportModalOpen && createPortal(
        <div
          className="modal-backdrop"
          onClick={(event: MouseEvent<HTMLDivElement>) => {
            if (event.target === event.currentTarget) {
              setEmailImportModalOpen(false)
            }
          }}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'Escape') {
              setEmailImportModalOpen(false)
            }
          }}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h2>Import from email</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setEmailImportModalOpen(false)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="quiz-section">
                <p className="import-description">
                  Connect your email to automatically import recent purchase receipts.
                </p>

                <div className="import-options">
                  <button
                    type="button"
                    className="import-option-btn gmail"
                    onClick={() => {
                      setEmailImportModalOpen(false)
                      navigate('/email-sync')
                    }}
                  >
                    <GmailLogo className="import-logo" />
                    <span className="import-label">Connect Gmail</span>
                  </button>

                  <button
                    type="button"
                    className="import-option-btn outlook"
                    onClick={() => {
                      setEmailImportModalOpen(false)
                      navigate('/email-sync?provider=outlook')
                    }}
                  >
                    <OutlookLogo className="import-logo" />
                    <span className="import-label">Connect Outlook</span>
                  </button>
                </div>

                <div className="import-privacy-notice">
                  <p>🔒 <strong>Privacy Notice:</strong></p>
                  <p>
                    The API only reads the last 10 purchase receipts and does not store data
                    other than item name, price, vendor, category, and date for the purchases.
                    One time connection only. Reimporting would require your manual authorization again.
                    Read more on how we fetch your reciepts.
                  </p>
                </div>
              </div>

              <div className="values-actions">
                <LiquidButton
                  className="ghost"
                  type="button"
                  onClick={() => setEmailImportModalOpen(false)}
                >
                  Close
                </LiquidButton>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  )
}
