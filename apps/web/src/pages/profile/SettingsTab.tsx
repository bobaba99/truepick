import type { ChangeEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { UserPreferences } from '../../api/core/types'
import { LiquidButton, VolumetricInput } from '../../components/Kinematics'
import { clearOnboardingCompletion } from '../../components/onboarding/useOnboardingTutorial'
import {
  CURRENCY_OPTIONS,
  HOLD_DURATION_OPTIONS,
  LOCALE_OPTIONS,
} from '../../utils/userPreferences'
import { themeModeOptions } from './profileConstants'

type SettingsTabProps = {
  session: Session | null
  profileDraftPreferences: UserPreferences
  preferencesSaving: boolean
  onThemeSelection: (theme: UserPreferences['theme']) => void
  onPreferenceChange: (updater: (prev: UserPreferences) => UserPreferences) => void
  onSave: () => void
  onNavigate: (path: string) => void
}

export default function SettingsTab({
  session,
  profileDraftPreferences,
  preferencesSaving,
  onThemeSelection,
  onPreferenceChange,
  onSave,
  onNavigate,
}: SettingsTabProps) {
  return (
    <div className="settings-tab-content">
      <div className="quiz-section">
        <h3>Theme</h3>
        <p>Choose your app appearance.</p>
        <div className="quiz-options">
          {themeModeOptions.map((option) => (
            <LiquidButton
              key={option.value}
              type="button"
              className={`quiz-chip ${profileDraftPreferences.theme === option.value ? 'selected' : ''}`}
              onClick={() => onThemeSelection(option.value)}
            >
              {option.label}
            </LiquidButton>
          ))}
        </div>
      </div>

      <div className="quiz-section">
        <h3>Locale</h3>
        <p>Set your preferred locale for date and number formatting.</p>
        <label className="modal-field">
          <VolumetricInput
            as="select"
            className="purchase-select"
            value={profileDraftPreferences.locale}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              onPreferenceChange((prev) => ({
                ...prev,
                locale: event.target.value,
              }))
            }
          >
            {LOCALE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </VolumetricInput>
        </label>
      </div>

      <div className="quiz-section">
        <h3>Currency</h3>
        <p>Set your preferred currency for amount formatting.</p>
        <label className="modal-field">
          <VolumetricInput
            as="select"
            className="purchase-select"
            value={profileDraftPreferences.currency}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              onPreferenceChange((prev) => ({
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
              onPreferenceChange((prev) => ({
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
                onPreferenceChange((prev) => ({
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
                onPreferenceChange((prev) => ({
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

      <div className="quiz-section">
        <h3>Onboarding</h3>
        <p>Revisit the welcome tutorial to learn about TruePick features.</p>
        <LiquidButton
          type="button"
          className="quiz-chip"
          onClick={() => {
            const userId = session?.user.id
            if (userId) clearOnboardingCompletion(userId)
            onNavigate('/dashboard')
          }}
        >
          Replay tutorial
        </LiquidButton>
      </div>

      <div className="values-actions">
        <LiquidButton
          className="primary"
          type="button"
          onClick={onSave}
          disabled={preferencesSaving}
        >
          {preferencesSaving ? 'Saving...' : 'Save settings'}
        </LiquidButton>
      </div>
    </div>
  )
}
