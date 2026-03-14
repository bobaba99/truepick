import { ScrollReveal, SplitText } from '../components/Kinematics'

export default function HowItWorks() {
  return (
    <section className="route-content">
      <div className="section-header">
        <h1><SplitText>How It Works</SplitText></h1>
      </div>

      <ScrollReveal>
        <h2>The Verdict Engine</h2>
        <p>
          (Boilerplate) This page explains how the verdict system works transparently.
        </p>
      </ScrollReveal>

      <ScrollReveal>
        <h3>What inputs we collect</h3>
        <ul>
          <li>Product name</li>
          <li>Price</li>
          <li>Your reason for considering the purchase</li>
        </ul>
      </ScrollReveal>

      <ScrollReveal>
        <h3>What the AI evaluates</h3>
        <ul>
          <li>Price-to-value ratio</li>
          <li>Impulse indicators</li>
          <li>Necessity assessment</li>
          <li>Values alignment (if profiled)</li>
        </ul>
      </ScrollReveal>

      <ScrollReveal>
        <h3>A worked example</h3>
        <p>(Boilerplate) Input → Reasoning → Output</p>
      </ScrollReveal>

      <ScrollReveal>
        <h3>How personalization improves verdicts</h3>
        <p>(Boilerplate) Profile → Better context → Better recommendations</p>
      </ScrollReveal>

      <ScrollReveal>
        <h3>What we do NOT do</h3>
        <ul>
          <li>No purchase tracking without consent</li>
          <li>No selling data to advertisers</li>
          <li>No affiliate-biased recommendations</li>
        </ul>
      </ScrollReveal>
    </section>
  )
}
