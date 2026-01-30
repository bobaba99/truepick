import { useEffect, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Session } from '@supabase/supabase-js'
import type {
  OnboardingAnswers,
  PurchaseRow,
  UserDecision,
  UserRow,
  UserValueRow,
  VerdictRow,
} from '../api/types'
import { PURCHASE_CATEGORIES } from '../api/types'
import {
  getUserProfile,
  createUserProfile,
  updateUserProfile,
} from '../api/userProfileService'
import {
  getUserValues,
  createUserValue,
  updateUserValue,
  deleteUserValue,
} from '../api/userValueService'
import { getVerdictHistory, updateVerdictDecision, deleteVerdict } from '../api/verdictService'
import {
  getPurchaseHistory,
  createPurchase,
  updatePurchase,
  deletePurchase,
} from '../api/purchaseService'
import VerdictDetailModal from '../components/VerdictDetailModal'
import { GlassCard, LiquidButton, VolumetricInput } from '../components/Kinematics'
import ListFilters, { type FilterState, INITIAL_FILTERS } from '../components/ListFilters'

type ProfileProps = {
  session: Session | null
}

const valueOptions = [
  {
    value: 'durability',
    label: 'Durability',
    description: 'I value things that last several years.',
  },
  {
    value: 'efficiency',
    label: 'Efficiency',
    description: 'I value tools that saves time for me.',
  },
  {
    value: 'aesthetics',
    label: 'Aesthetics',
    description: "I value items that fit my existing environment's visual language.",
  },
  {
    value: 'interpersonal_value',
    label: 'Interpersonal Value',
    description: 'I value purchases that facilitate shared experiences.',
  },
  {
    value: 'emotional_value',
    label: 'Emotional Value',
    description: 'I value purchases that provide meaningful emotional benefits.',
  },
] as const

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
    prompt: 'Do you think it’s important to own expensive things?',
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
  const [userRow, setUserRow] = useState<UserRow | null>(null)
  const [userValues, setUserValues] = useState<UserValueRow[]>([])
  const [verdicts, setVerdicts] = useState<VerdictRow[]>([])
  const [purchases, setPurchases] = useState<PurchaseRow[]>([])
  const [status, setStatus] = useState<string>('')
  const [savingValueType, setSavingValueType] = useState<string | null>(null)
  const [purchaseTitle, setPurchaseTitle] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseVendor, setPurchaseVendor] = useState('')
  const [purchaseCategory, setPurchaseCategory] = useState('other')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [purchaseSaving, setPurchaseSaving] = useState(false)
  const [purchaseEditingId, setPurchaseEditingId] = useState<string | null>(null)
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [purchaseModalMode, setPurchaseModalMode] = useState<'add' | 'edit'>('add')
  const [verdictSavingId, setVerdictSavingId] = useState<string | null>(null)
  const [selectedVerdict, setSelectedVerdict] = useState<VerdictRow | null>(null)
  const [editingValues, setEditingValues] = useState(false)
  const [profileSummary, setProfileSummary] = useState('')
  const [weeklyFunBudget, setWeeklyFunBudget] = useState('')
  const [profileDraftSummary, setProfileDraftSummary] = useState('')
  const [profileDraftBudget, setProfileDraftBudget] = useState('')
  const [onboardingAnswers, setOnboardingAnswers] =
    useState<OnboardingAnswers>(DEFAULT_ONBOARDING)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)

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

  const loadProfile = async () => {
    if (!session) return

    try {
      const data = await getUserProfile(session.user.id)

      if (!data) {
        // Profile should be auto-created by database trigger on auth signup.
        // If missing, try to create it (handles edge cases / legacy accounts).
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

        await loadProfile()
        return
      }

      setUserRow(data)
      const summaryValue = data.profile_summary ?? ''
      const budgetValue =
        data.weekly_fun_budget !== null && data.weekly_fun_budget !== undefined
          ? String(data.weekly_fun_budget)
          : ''

      setProfileSummary(summaryValue)
      setWeeklyFunBudget(
        budgetValue,
      )
      setProfileDraftSummary(summaryValue)
      setProfileDraftBudget(budgetValue)
      setOnboardingAnswers(normalizeOnboardingAnswers(data.onboarding_answers ?? null))
      setStatus('')
    } catch (err) {
      console.error('Profile load error', err)
      setStatus(`Profile load error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const loadUserValues = async () => {
    if (!session) return

    try {
      const data = await getUserValues(session.user.id)
      setUserValues(data)
    } catch (err) {
      setStatus('Unable to load values from Supabase. Check RLS policies.')
    }
  }

  const loadVerdicts = async () => {
    if (!session) return

    try {
      const data = await getVerdictHistory(session.user.id, 10)
      setVerdicts(data)
    } catch (err) {
      setStatus('Unable to load verdicts from Supabase. Check RLS policies.')
    }
  }

  const loadPurchases = async () => {
    if (!session) return

    try {
      const data = await getPurchaseHistory(session.user.id, 10)
      setPurchases(data)
    } catch (err) {
      setStatus('Unable to load purchases from Supabase. Check RLS policies.')
    }
  }

  useEffect(() => {
    if (!session) {
      return
    }

    void loadProfile()
    void loadUserValues()
    void loadVerdicts()
    void loadPurchases()
  }, [session])

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

  const getValueForType = (valueType: string): UserValueRow | undefined => {
    return userValues.find((v) => v.value_type === valueType)
  }

  const handleValueChange = async (valueType: string, score: number | null) => {
    if (!session) return

    setSavingValueType(valueType)
    setStatus('')

    const existingValue = getValueForType(valueType)

    if (score === null) {
      // Delete the value
      if (existingValue) {
        const { error } = await deleteUserValue(session.user.id, existingValue.id)
        if (error) {
          setStatus(error)
          setSavingValueType(null)
          return
        }
      }
    } else if (existingValue) {
      // Update existing value
      const { error } = await updateUserValue(session.user.id, existingValue.id, score)
      if (error) {
        setStatus(error)
        setSavingValueType(null)
        return
      }
    } else {
      // Create new value
      const { error } = await createUserValue(valueType, score)
      if (error) {
        setStatus(error)
        setSavingValueType(null)
        return
      }
    }

    await loadUserValues()
    setSavingValueType(null)
  }

  const toggleSelection = (items: string[], value: string) => {
    if (items.includes(value)) {
      return items.filter((item) => item !== value)
    }
    return [...items, value]
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

    const { error } = purchaseEditingId
      ? await updatePurchase(session.user.id, purchaseEditingId, payload)
      : await createPurchase(payload)

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
    await loadVerdicts() // Reload verdicts in case a verdict-sourced purchase was deleted
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
    await loadPurchases() // Reload purchases since decision may add/remove a purchase
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
    await loadPurchases() // Reload purchases in case a linked purchase existed
    setVerdictSavingId(null)
  }

  return (
    <section className="route-content">
      <h1>Profile</h1>

      {status && <div className="status error">{status}</div>}

      <div className="profile-grid">
        <div>
          <span className="label">Auth user</span>
          <br></br>
          <span className="value">{session?.user.email}</span>
        </div>
      </div>

      <div className="values-section">
        <div className="section-header">
          <h2>Decision profile</h2>
          <div className="header-actions">
            <LiquidButton
              type="button"
              className="ghost"
              onClick={() => setProfileModalOpen(true)}
            >
              Edit Decision Profile
            </LiquidButton>
          </div>
        </div>
        <p className="values-description">
          Capture who you are and what you care about. This summary guides your verdicts.
        </p>
        <p className="profile-hint">
          Example: I'm a cashier and undergraduate student, I'm thinking about saving for
          my next semester's tuition.
        </p>
        <div className="profile-summary">
          <div>
            <span className="label">Personal summary</span>
            <br></br>
            <span className="value">{profileSummary || 'Not set'}</span>
          </div>
          <div>
            <span className="label">Weekly fun budget</span>
            <br></br>
            <span className="value">
              {weeklyFunBudget ? `$${Number(weeklyFunBudget).toFixed(2)}` : 'Not set'}
            </span>
          </div>
        </div>
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
            <span className="label">Regret triggers</span>
            <span className="value">
              {onboardingAnswers.regretPatterns.length > 0
                ? onboardingAnswers.regretPatterns.join(', ')
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

      {/* Previous simple 5-facet value setting */}

      {/* <div className="values-section">
        <div className="section-header">
          <h2>Values</h2>
          <button
            type="button"
            className="link"
            onClick={() => setEditingValues(!editingValues)}
          >
            {editingValues ? 'Done' : 'Edit'}
          </button>
        </div>
        {editingValues && (
          <p className="values-description">
            Rate how much each factor matters to you (1 = low, 5 = high)
          </p>
        )}
        <div className="values-grid">
          {valueOptions.map((option) => {
            const existingValue = getValueForType(option.value)
            const currentScore = existingValue?.preference_score ?? null
            const isSaving = savingValueType === option.value

            return (
              <div key={option.value} className={`value-card ${editingValues ? 'editing' : ''}`}>
                <div className="value-card-content">
                  <span className="value-label">{option.label}</span>
                  <span className="description-label">{option.description}</span>
                </div>
                <div className="value-card-footer">
                  {editingValues ? (
                    <div className="slider-container">
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={currentScore ?? 3}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          handleValueChange(option.value, Number(e.target.value))
                        }
                        disabled={isSaving}
                        className="value-slider"
                      />
                      <div className="slider-labels">
                        <span>1</span>
                        <span>2</span>
                        <span>3</span>
                        <span>4</span>
                        <span>5</span>
                      </div>
                      <div className="slider-actions">
                        {currentScore !== null && (
                          <button
                            type="button"
                            className="link danger"
                            disabled={isSaving}
                            onClick={() => handleValueChange(option.value, null)}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="score-display">
                      {currentScore !== null ? `${currentScore}/5` : 'Not set'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div> */}

      <div className="dashboard-grid">
        <div className="verdict-result">
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
                          className={`decision-btn bought ${verdict.user_decision === 'bought' ? 'active' : ''}`}
                          onClick={() => handleVerdictDecision(verdict.id, 'bought')}
                          disabled={isSaving}
                        >
                          Bought
                        </LiquidButton>
                        <LiquidButton
                          type="button"
                          className={`decision-btn hold ${verdict.user_decision === 'hold' ? 'active' : ''}`}
                          onClick={() => handleVerdictDecision(verdict.id, 'hold')}
                          disabled={isSaving}
                        >
                          Hold 24h
                        </LiquidButton>
                        <LiquidButton
                          type="button"
                          className={`decision-btn skip ${verdict.user_decision === 'skip' ? 'active' : ''}`}
                          onClick={() => handleVerdictDecision(verdict.id, 'skip')}
                          disabled={isSaving}
                        >
                          Skip
                        </LiquidButton>
                      </div>
                      <LiquidButton
                        type="button"
                        className="link danger"
                        onClick={() => handleVerdictDelete(verdict.id)}
                        disabled={isSaving}
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

        <div className="verdict-result">
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
            <div className="verdict-list">
              {filteredPurchases.map((purchase) => (
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
          )}
        </div>
      </div>

      {selectedVerdict && createPortal(
        <VerdictDetailModal
          verdict={selectedVerdict}
          isOpen={selectedVerdict !== null}
          onClose={() => setSelectedVerdict(null)}
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
    </section>
  )
}
