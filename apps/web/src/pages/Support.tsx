import { LiquidButton } from '../components/Kinematics'
import { useNavigate } from 'react-router-dom'

export default function Support() {
  const navigate = useNavigate()

  return (
    <section className="route-content">
      <h1>Support</h1>

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
          className="primary"
          type="button"
          onClick={() => navigate('/contact-us')}
        >
          Contact Us
        </LiquidButton>
      </div>

      <h3>Common Topics</h3>
      <ul>
        <li>Getting started with TruePick</li>
        <li>Understanding your verdicts</li>
        <li>Email sync and privacy</li>
        <li>Account and data management</li>
      </ul>
    </section>
  )
}
