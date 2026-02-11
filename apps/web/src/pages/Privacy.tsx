import { GlassCard } from '../components/Kinematics'

export default function Privacy() {
  return (
    <section className="route-content">
      <div className="section-header">
        <h1>Privacy Policy</h1>
      </div>

      <div className="dashboard-grid">
        <GlassCard className="verdict-result">
          <h2>Plain-language summary</h2>
          <p>
            We collect only what we need to provide the service. We do not sell your data. 
            You can delete your account and data at any time.
          </p>

          <hr style={{ margin: '2rem 0', borderColor: 'var(--glass-border)' }} />

          <h2>Full Privacy Policy</h2>

          <h3>Data types collected</h3>
          <ul>
            <li>Profile data (your preferences and values)</li>
            <li>Verdict inputs (products you evaluate)</li>
            <li>Email-extracted purchase data (if you connect email)</li>
            <li>Usage analytics</li>
          </ul>

          <h3>Legal basis for processing</h3>
          <p>Consent and legitimate interest.</p>

          <h3>Third-party processors</h3>
          <ul>
            <li>Supabase (database hosting)</li>
            <li>LLM API provider (AI verdicts)</li>
            <li>Analytics provider</li>
          </ul>

          <h3>Data retention periods</h3>
          <p>(Boilerplate) Specify retention periods for each data type.</p>

          <h3>Your rights</h3>
          <ul>
            <li>Access — request a copy of your data</li>
            <li>Export — download your data</li>
            <li>Deletion — delete your account and data</li>
            <li>Objection — object to certain processing</li>
          </ul>

          <h3>Cookie policy</h3>
          <p>(Boilerplate) Explain cookie usage.</p>

          <h3>CCPA disclosures</h3>
          <p>(Boilerplate) Do Not Sell, categories of personal information.</p>

          <h3>Contact</h3>
          <p>For data protection inquiries: <a href="mailto:privacy@nopamine.app">privacy@nopamine.app</a></p>
        </GlassCard>
      </div>
    </section>
  )
}
