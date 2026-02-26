import { GlassCard, LiquidButton } from '../components/Kinematics'
import { useNavigate } from 'react-router-dom'

export default function Support() {
  const navigate = useNavigate()

  return (
    <section className="route-content">
      <div className="section-header">
        <h1>Support</h1>
      </div>

      <div className="dashboard-grid">
        <GlassCard className="verdict-result">
          <h2>How can we help?</h2>
          <p>
            Find answers to common questions or get in touch with us.
          </p>

          <div className="values-actions" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
            <LiquidButton
              className="primary"
              type="button"
              onClick={() => navigate('/faq')}
            >
              View FAQ
            </LiquidButton>
            <LiquidButton
              className="ghost"
              type="button"
              onClick={() => navigate('/contact-us')}
            >
              Contact Us
            </LiquidButton>
          </div>

          <h3>Common Topics</h3>
          <ul>
            <li>Getting started with Truepick</li>
            <li>Understanding your verdicts</li>
            <li>Email sync and privacy</li>
            <li>Account and data management</li>
          </ul>
        </GlassCard>
      </div>
    </section>
  )
}
