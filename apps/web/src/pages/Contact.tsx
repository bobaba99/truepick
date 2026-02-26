export default function Contact() {
  return (
    <section className="route-content">
      <div className="section-header">
        <h1>Contact Us</h1>
      </div>

      <h2>Get in touch</h2>

      <p>
        <strong>Support email:</strong>{' '}
        <a href="mailto:support@truepick.app">support@truepick.app</a>
      </p>

      <div className="profile-summary" style={{ marginTop: '1.5rem' }}>
        <p>
          TruePick is built and maintained by a solo developer.
          Expect a response within 48 hours.
        </p>
      </div>

      <h3 style={{ marginTop: '1.5rem' }}>Bug Reports</h3>
      <p>Please include:</p>
      <ul>
        <li>Device and browser/OS</li>
        <li>What you expected vs. what happened</li>
        <li>Screenshot if possible</li>
      </ul>

      <h3 style={{ marginTop: '1.5rem' }}>Feature Requests</h3>
      <p>
        We welcome suggestions! Please describe the feature and why it would help you.
      </p>

      <h3 style={{ marginTop: '1.5rem' }}>Before you email</h3>
      <p>
        Check the <a href="/faq">FAQ</a> for answers to common questions.
      </p>
    </section>
  )
}
