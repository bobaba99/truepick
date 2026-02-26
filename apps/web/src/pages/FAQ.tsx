import { useState } from 'react'
import { GlassCard } from '../components/Kinematics'

const faqData = [
  {
    question: 'Is my data sold to advertisers?',
    answer: 'No. We do not sell any user data to advertisers or third parties. See our Privacy Policy for details.',
  },
  {
    question: 'How accurate are the verdicts?',
    answer: 'Verdicts use LLM-based reasoning, not deterministic prediction. Accuracy improves with profile data.',
  },
  {
    question: 'Can I use it without creating an account?',
    answer: 'Yes. Web app verdicts require no account. Profile creation is optional.',
  },
  {
    question: 'What happens if the AI is wrong?',
    answer: 'Verdicts are guidance, not commands. Outcome feedback helps improve future verdicts.',
  },
  {
    question: 'Is the web app free?',
    answer: 'Yes, unlimited verdicts. Premium features (spending reports, unlimited personalized verdicts, email sync) require the iOS app subscription.',
  },
  {
    question: 'How is this different from a budgeting app?',
    answer: 'Truepick intervenes before the purchase, not after. It is a decision tool, not a tracking tool.',
  },
  {
    question: 'What does 智商税 mean?',
    answer: 'It refers to the "IQ tax" — the cost of poor purchase decisions. See the About page for more.',
  },
  {
    question: 'How do I delete my account and all data?',
    answer: 'Contact us to request deletion. All data will be removed within 30 days per GDPR.',
  },
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggleQuestion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section className="route-content">
      <div className="section-header">
        <h1>Frequently Asked Questions</h1>
      </div>

      <div className="dashboard-grid">
        <GlassCard className="verdict-result">
          {faqData.map((item, index) => (
            <div key={index} className="faq-item" style={{ marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => toggleQuestion(index)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '0.75rem 0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                {item.question}
                <span>{openIndex === index ? '−' : '+'}</span>
              </button>
              {openIndex === index && (
                <p style={{ padding: '0.5rem 0', color: 'var(--ink-700)' }}>
                  {item.answer}
                </p>
              )}
            </div>
          ))}
        </GlassCard>
      </div>
    </section>
  )
}
