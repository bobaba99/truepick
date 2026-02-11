import { GlassCard } from '../components/Kinematics'

export default function EmailSync() {
  return (
    <section className="route-content">
      <div className="section-header">
        <h1>How Email Sync Works</h1>
      </div>

      <div className="dashboard-grid">
        <GlassCard className="verdict-result">
          <h2>Technical transparency</h2>
          <p>
            This page explains the full email integration workflow.
          </p>

          <h3>Step-by-step workflow</h3>
          <ol>
            <li>OAuth prompt — you authorize access</li>
            <li>Permission grant — limited scope only</li>
            <li>Receipt scan — only order confirmations</li>
            <li>Data extraction — product details only</li>
            <li>Storage — encrypted at rest</li>
            <li>Access revocation — you control access</li>
          </ol>

          <h3>What OAuth permissions are requested</h3>
          <p>(Boilerplate) Explain each permission and why it is necessary.</p>

          <h3>What emails are scanned</h3>
          <p>
            Only receipt and order confirmation patterns (matching subject lines like 
            &quot;Order confirmation,&quot; &quot;Your receipt,&quot; &quot;Shipping notification&quot;).
          </p>

          <h3>What data is extracted</h3>
          <ul>
            <li>Product name</li>
            <li>Price</li>
            <li>Vendor</li>
            <li>Date</li>
            <li>Order ID</li>
          </ul>

          <h3>What is never read or stored</h3>
          <ul>
            <li>Email body content beyond receipts</li>
            <li>Personal messages</li>
            <li>Attachments</li>
            <li>Contacts</li>
            <li>Drafts</li>
          </ul>

          <h3>Security</h3>
          <p>Extracted data is encrypted at rest (AES-256) and user-deletable on request.</p>

          <h3>How to revoke access</h3>
          <p>(Boilerplate) Step-by-step instructions to disconnect.</p>

          <h3>Data retention</h3>
          <p>(Boilerplate) What happens to data after disconnection.</p>
        </GlassCard>
      </div>
    </section>
  )
}
