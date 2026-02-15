import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
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
import { GlassCard, LiquidButton, VolumetricInput } from '../components/Kinematics'
import { GmailLogo, OutlookLogo } from '../components/EmailIcons'
import ListFilters from '../components/ListFilters'
import { type FilterState, INITIAL_FILTERS } from '../components/ListFilters.model'
import { useUserFormatting, useUserPreferences } from '../preferences/UserPreferencesContext'
import {
  CURRENCY_OPTIONS,
  HOLD_DURATION_OPTIONS,
  normalizeUserPreferences,
} from '../utils/userPreferences'

type ProfileProps = {
  session: Session | null
}

type ProfileTab = 'profile' | 'verdicts' | 'purchases'

const PURCHASE_PAGE_SIZE = 5

const coreValueOptions = [
  'Financial stability',
  'Minimalism / low clutter',
  'Emotional wellbeing',
  'Self-improvement',
  'Ethical consumption',
  'Aesthetic enjoyment',
  'Convenience',
  'Status / image',
  'Experiences over objects',
]

const regretPatternOptions = [
  'I bought impulsively',
  "It didn't get used",
  "It didn't match who I am",
  'It was too expensive for what it gave',
  'It was driven by stress, boredom, or FOMO',
  'It duplicated something I already had',
]

const satisfactionPatternOptions = [
  'Improves my daily routine',
  'Lasts a long time',
  'Supports my growth or habits',
  'Makes life calmer or easier',
  'Reflects my identity',
  'Saves time or energy',
]

const decisionStyleOptions = [
  'I plan carefully and delay',
  'I think briefly, then decide',
  'I often buy emotionally and justify later',
  'It depends heavily on mood',
]

const materialismItems = [
  {
    key: 'centrality',
    prompt: 'Do you think it\u2019s important to own expensive things?',
  },
  {
    key: 'happiness',
    prompt: 'Does buying expensive things make you happy?',
  },
  {
    key: 'success',
    prompt: 'Do you like people who have expensive things more than you like other people?',
  },
] as const

const locusOfControlItems = [
  {
    key: 'workHard',
    prompt: 'If I work hard, I will succeed.',
  },
  {
    key: 'destiny',
    prompt: 'Destiny often gets in the way of my plans.',
  },
] as const

const identityStabilityOptions = [
  'Not important',
  'Somewhat important',
  'Very important',
]

const themeModeOptions: Array<{ value: UserPreferences['theme']; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const DEFAULT_ONBOARDING: OnboardingAnswers = {
  coreValues: [],
  regretPatterns: [],
  satisfactionPatterns: [],
  decisionStyle: '',
  neuroticismScore: 3,
  materialism: {
    centrality: 2,
    happiness: 2,
    success: 2,
  },
  locusOfControl: {
    workHard: 3,
    destiny: 3,
  },
  identityStability: '',
}

const normalizeOnboardingAnswers = (
  answers: OnboardingAnswers | null | undefined,
): OnboardingAnswers => {
  if (!answers) return DEFAULT_ONBOARDING
  return {
    ...DEFAULT_ONBOARDING,
    ...answers,
    coreValues: answers.coreValues ?? [],
    regretPatterns: answers.regretPatterns ?? [],
    satisfactionPatterns: answers.satisfactionPatterns ?? [],
    materialism: {
      ...DEFAULT_ONBOARDING.materialism,
      ...answers.materialism,
    },
    locusOfControl: {
      ...DEFAULT_ONBOARDING.locusOfControl,
      ...answers.locusOfControl,
    },
  }
}

export default function Profile({ session }: ProfileProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile')
  const { preferences, setPreferences: setGlobalPreferences } = useUserPreferences()
  const { formatCurrency, formatDate } = useUserFormatting()
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
          setStatus('Profile not found and user email is missing.')
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
    } catch (err) {
      console.error('Profile load error', err)
      setStatus(`Profile load error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [session, setGlobalPreferences])

  const loadVerdicts = useCallback(async () => {
    if (!session) return

    try {
      const data = await getVerdictHistory(session.user.id, 10)
      setVerdicts(data)
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
      void loadProfile()
      void loadVerdicts()
      void loadPurchases()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [session, loadProfile, loadVerdicts, loadPurchases])

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

  const openProfileModal = () => {
    setProfileDraftSummary(profileSummary)
    setProfileDraftBudget(weeklyFunBudget)
    setProfileModalOpen(true)
  }

  const openPreferencesModal = () => {
    setProfileDraftPreferences(profilePreferences)
    setPreferencesModalOpen(true)
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

    await loadPurchases()
    await loadVerdicts()
    setPurchaseSaving(false)
  }

  const handleVerdictDecision = async (verdictId: string, decision: UserDecision) => {
    if (!session) return

    setVerdictSavingId(verdictId)
    setStatus('')

    const { error } = await updateVerdictDecision(session.user.id, verdictId, decision)

    if (error) {
      setStatus(error)
      setVerdictSavingId(null)
      return
    }

    await loadVerdicts()
    await loadPurchases()
    setVerdictSavingId(null)
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

    try {
      const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined
      const input = inputFromVerdict(verdict)
      const evaluation = await evaluatePurchase(session.user.id, input, openaiApiKey)
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

      setVerdicts((previousVerdicts) =>
        previousVerdicts.map((previousVerdict) =>
          previousVerdict.id === data.id ? data : previousVerdict
        )
      )
      if (selectedVerdict?.id === data.id) {
        setSelectedVerdict(data)
      }
    } catch {
      setStatus('Failed to regenerate verdict.')
    } finally {
      setVerdictRegeneratingId((currentVerdictId) =>
        currentVerdictId === verdict.id ? null : currentVerdictId
      )
    }
  }

  const renderProfileTab = () => (
    <>
      <div className="profile-summary-card">
        <div className="profile-summary-row">
          <div>
            <span className="label">Personal summary</span>
            <br />
            <span className="value">{profileSummary || 'Not set'}</span>
          </div>
          <div>
            <span className="label">Weekly fun budget</span>
            <br />
            <span className="value">
              {weeklyFunBudget ? `$${Number(weeklyFunBudget).toFixed(2)}` : 'Not set'}
            </span>
          </div>
        </div>
        <div className="profile-summary-actions">
          <LiquidButton
            type="button"
            className="ghost"
            onClick={() => setProfileModalOpen(true)}
          >
            Edit Decision Profile
          </LiquidButton>
          <LiquidButton
            type="button"
            className="ghost"
            onClick={() => setProfileDetailExpanded((prev) => !prev)}
          >
            {profileDetailExpanded ? 'Hide details' : 'View full profile'}
          </LiquidButton>
        </div>
      </div>

      <div className={`collapsible ${profileDetailExpanded ? 'open' : ''}`}>
        <div>
          <div className="profile-detail-sections">
            <div className="profile-detail-group">
              <h3 className="profile-group-label">What I value</h3>
              <div className="profile-answer-grid">
                <GlassCard className="profile-answer">
                  <span className="label">Core values</span>
                  <span className="value">
                    {onboardingAnswers.coreValues.length > 0
                      ? onboardingAnswers.coreValues.join(', ')
                      : 'Not set'}
                  </span>
                </GlassCard>
                <GlassCard className="profile-answer">
                  <span className="label">Satisfaction pattern</span>
                  <span className="value">
                    {onboardingAnswers.satisfactionPatterns.length > 0
                      ? onboardingAnswers.satisfactionPatterns.join(', ')
                      : 'Not set'}
                  </span>
                </GlassCard>
              </div>
            </div>

            <div className="profile-detail-group">
              <h3 className="profile-group-label">What I avoid</h3>
              <div className="profile-answer-grid">
                <GlassCard className="profile-answer">
                  <span className="label">Regret triggers</span>
                  <span className="value">
                    {onboardingAnswers.regretPatterns.length > 0
                      ? onboardingAnswers.regretPatterns.join(', ')
                      : 'Not set'}
                  </span>
                </GlassCard>
              </div>
            </div>

            <div className="profile-detail-group">
              <h3 className="profile-group-label">Decision psychology</h3>
              <div className="profile-answer-grid">
                <GlassCard className="profile-answer">
                  <span className="label">Decision approach</span>
                  <span className="value">
                    {onboardingAnswers.decisionStyle || 'Not set'}
                  </span>
                </GlassCard>
                <GlassCard className="profile-answer">
                  <span className="label">Stress response</span>
                  <span className="value">{onboardingAnswers.neuroticismScore}/5</span>
                </GlassCard>
                <GlassCard className="profile-answer">
                  <span className="label">Views on expensive things</span>
                  <span className="value">{materialismAverage.toFixed(1)}/4</span>
                </GlassCard>
                <GlassCard className="profile-answer">
                  <span className="label">Sense of control</span>
                  <span className="value">{locusSummary}</span>
                </GlassCard>
                <GlassCard className="profile-answer">
                  <span className="label">Identity alignment</span>
                  <span className="value">
                    {onboardingAnswers.identityStability || 'Not set'}
                  </span>
                </GlassCard>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )

  const renderVerdictsTab = () => (
    <div className="verdict-result" style={{ marginTop: 0 }}>
      <div className="section-header">
        <h2>Verdict history</h2>
        <LiquidButton
          type="button"
          className="ghost"
          onClick={() => setVerdictFiltersOpen((o) => !o)}
        >
          {verdictFiltersOpen ? 'Hide filters' : 'Filter / Search'}
        </LiquidButton>
      </div>
      <div className={`collapsible ${verdictFiltersOpen ? 'open' : ''}`}>
        <ListFilters
          search={verdictSearch}
          onSearchChange={setVerdictSearch}
          filters={verdictFilters}
          onFilterChange={setVerdictFilters}
          type="verdict"
        />
      </div>
      {filteredVerdicts.length === 0 ? (
        <div className="empty-card">
          {verdicts.length === 0 ? 'No verdicts logged yet.' : 'No verdicts match your filters.'}
        </div>
      ) : (
        <div className="verdict-list">
          {filteredVerdicts.map((verdict) => {
            const isSaving = verdictSavingId === verdict.id
            const isRegenerating = verdictRegeneratingId === verdict.id
            const isBusy = isSaving || isRegenerating
            return (
              <GlassCard key={verdict.id} className="verdict-card">
                <div
                  className="verdict-card-clickable"
                  onClick={() => setSelectedVerdict(verdict)}
                  onKeyDown={(e: KeyboardEvent<HTMLDivElement>) =>
                    e.key === 'Enter' && setSelectedVerdict(verdict)
                  }
                  role="button"
                  tabIndex={0}
                >
                  <div>
                    <span className="stat-label">Item </span>
                    <span className="stat-value">{verdict.candidate_title}</span>
                  </div>
                  <div className="verdict-meta">
                    <span>
                      Price:{' '}
                      {verdict.candidate_price === null
                        ? '—'
                        : `$${verdict.candidate_price.toFixed(2)}`}
                    </span>
                    <span>Vendor: {verdict.candidate_vendor ?? '—'}</span>
                    <span>Category: {verdict.candidate_category ?? '—'}</span>
                    <span>Recommendation: {verdict.predicted_outcome ?? '—'}</span>
                    <span>
                      Date:{' '}
                      {verdict.created_at
                        ? new Date(verdict.created_at).toLocaleDateString()
                        : '—'}
                    </span>
                  </div>
                </div>
                <div className="verdict-actions">
                  <div className="decision-buttons">
                    <LiquidButton
                      type="button"
                      className="link"
                      onClick={() => handleVerdictRegenerate(verdict)}
                      disabled={verdictRegeneratingId !== null || isBusy}
                    >
                      {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                    </LiquidButton>
                    <LiquidButton
                      type="button"
                      className={`decision-btn bought ${verdict.user_decision === 'bought' ? 'active' : ''}`}
                      onClick={() => handleVerdictDecision(verdict.id, 'bought')}
                      disabled={isBusy}
                    >
                      Bought
                    </LiquidButton>
                    <LiquidButton
                      type="button"
                      className={`decision-btn hold ${verdict.user_decision === 'hold' ? 'active' : ''}`}
                      onClick={() => handleVerdictDecision(verdict.id, 'hold')}
                      disabled={isBusy}
                    >
                      Hold 24h
                    </LiquidButton>
                    <LiquidButton
                      type="button"
                      className={`decision-btn skip ${verdict.user_decision === 'skip' ? 'active' : ''}`}
                      onClick={() => handleVerdictDecision(verdict.id, 'skip')}
                      disabled={isBusy}
                    >
                      Skip
                    </LiquidButton>
                  </div>
                  <LiquidButton
                    type="button"
                    className="link danger"
                    onClick={() => handleVerdictDelete(verdict.id)}
                    disabled={isBusy}
                  >
                    Delete
                  </LiquidButton>
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}
    </div>
  )

  const renderPurchasesTab = () => (
    <div className="verdict-result" style={{ marginTop: 0 }}>
      <div className="section-header">
        <h2>Purchase history</h2>
        <div className="header-actions">
          <LiquidButton
            type="button"
            className="ghost"
            onClick={() => setPurchaseFiltersOpen((o) => !o)}
          >
            {purchaseFiltersOpen ? 'Hide filters' : 'Filter / Search'}
          </LiquidButton>
          <LiquidButton
            type="button"
            className="ghost"
            onClick={() => setEmailImportModalOpen(true)}
          >
            Import from email
          </LiquidButton>
          <LiquidButton
            type="button"
            className="ghost"
            onClick={() => {
              resetPurchaseForm()
              setPurchaseModalMode('add')
              setPurchaseModalOpen(true)
            }}
          >
            Add
          </LiquidButton>
        </div>
      </div>
      <div className={`collapsible ${purchaseFiltersOpen ? 'open' : ''}`}>
        <ListFilters
          search={purchaseSearch}
          onSearchChange={setPurchaseSearch}
          filters={purchaseFilters}
          onFilterChange={setPurchaseFilters}
          type="purchase"
        />
      </div>
      {filteredPurchases.length === 0 ? (
        <div className="empty-card">
          {purchases.length === 0 ? 'No purchases logged yet.' : 'No purchases match your filters.'}
        </div>
      ) : (
        <>
          <div className="verdict-list">
            {visiblePurchases.map((purchase) => (
              <GlassCard key={purchase.id} className="verdict-card">
                <div className="verdict-card-content">
                  <div>
                    <span className="stat-label">Item </span>
                    <span className="stat-value">{purchase.title}</span>
                  </div>
                  <div className="verdict-meta">
                    <span>
                      Price: ${Number(purchase.price).toFixed(2)}
                    </span>
                    <span>Vendor: {purchase.vendor ?? '—'}</span>
                    <span>Category: {purchase.category ?? '—'}</span>
                    <span>Source: {purchase.source ?? '—'}</span>
                    <span>
                      Date:{' '}
                      {purchase.purchase_date
                        ? new Date(purchase.purchase_date).toLocaleDateString()
                        : '—'}
                    </span>
                  </div>
                </div>
                <div className="verdict-actions">
                  <LiquidButton
                    className="link"
                    type="button"
                    onClick={() => handlePurchaseEdit(purchase)}
                  >
                    Edit
                  </LiquidButton>
                  <LiquidButton
                    className="link danger"
                    type="button"
                    onClick={() => handlePurchaseDelete(purchase.id)}
                    disabled={purchaseSaving}
                  >
                    Delete
                  </LiquidButton>
                </div>
              </GlassCard>
            ))}
          </div>
          {hasMorePurchases && (
            <div className="load-more-row">
              <LiquidButton
                type="button"
                className="ghost"
                onClick={() => setPurchaseVisibleCount((prev) => prev + PURCHASE_PAGE_SIZE)}
              >
                Load more ({filteredPurchases.length - purchaseVisibleCount} remaining)
              </LiquidButton>
            </div>
          )}
        </>
      )}
    </div>
  )

  return (
    <section className="route-content">
      <h1>Profile</h1>

      {status && <div className="status error">{status}</div>}

      <div className="profile-header-card">
        <span className="value">{session?.user.email}</span>
      </div>

      <div className="profile-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'profile'}
          className={`profile-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'verdicts'}
          className={`profile-tab ${activeTab === 'verdicts' ? 'active' : ''}`}
          onClick={() => setActiveTab('verdicts')}
        >
          Verdicts
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'purchases'}
          className={`profile-tab ${activeTab === 'purchases' ? 'active' : ''}`}
          onClick={() => setActiveTab('purchases')}
        >
          Purchases
        </button>
      </div>

      <div className="profile-tab-content" role="tabpanel">
        {activeTab === 'profile' && renderProfileTab()}
        {activeTab === 'verdicts' && renderVerdictsTab()}
        {activeTab === 'purchases' && renderPurchasesTab()}
      </div>
      </div>

      {selectedVerdict && createPortal(
        <VerdictDetailModal
          verdict={selectedVerdict}
          isOpen={selectedVerdict !== null}
          onClose={() => setSelectedVerdict(null)}
          onRegenerate={handleVerdictRegenerate}
          isRegenerating={verdictRegeneratingId === selectedVerdict.id}
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
              setProfileModalOpen(false)
            }
          }}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'Escape') {
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
                onClick={() => setProfileModalOpen(false)}
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
                      onClick={() =>
                        setProfileDraftPreferences((prev) => ({
                          ...prev,
                          theme: option.value,
                        }))
                      }
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
