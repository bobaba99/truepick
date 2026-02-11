-- Seed data for nopamine resources
-- This script creates 5 example articles about impulse buying and post-purchase dissonance

INSERT INTO resources (
  slug,
  title,
  summary,
  body_markdown,
  tags,
  reading_time_minutes,
  canonical_url,
  cover_image_url,
  cta_url,
  is_published,
  published_at,
  created_at,
  updated_at
) VALUES
-- Article 1: The Neurobiology of Spontaneous Acquisition
(
  'neurobiology-of-impulse-acquisition',
  'The Dopaminergic Pathways of Impulse Buying',
  'An examination of how the ventral striatum and prefrontal cortex interact during unplanned retail encounters.',
  E'<h2>The Neurobiological Underpinning of Impulse Buying</h2>
<p>The neurobiological underpinning of impulse buying is defined by an acute asymmetry within the <strong>mesocorticolimbic circuit</strong>. When a consumer is exposed to a high-salience stimulus, the ventral striatum (specifically the nucleus accumbens) triggers a rapid dopaminergic surge. This "wanting" system is distinct from the "liking" system; it prioritizes immediate acquisition over hedonic satisfaction. This process often bypasses the dorsolateral prefrontal cortex (dlPFC), the region responsible for executive function and inhibitory control.</p>

<p>In high-arousal retail environments, the brain enters a state of <strong>hypofrontality</strong>, where the cognitive resources required for long-term deliberation are temporarily downregulated. The ventromedial prefrontal cortex (vmPFC), which typically integrates value and risk, becomes biased toward immediate reward signal processing. This results in a "temporal myopia," where future financial consequences are heavily discounted in favor of the immediate neurochemical payoff.</p>

<h3>Analysis of Rationales</h3>
<ul>
<li><strong>Dopaminergic Hyper-reactivity:</strong> Elevated activity in the nucleus accumbens serves as a significant predictor for immediate acquisition (Source: empirical research). Rating: 9/10.</li>
<li><strong>PFC Hypofrontality:</strong> A temporary downregulation of executive control facilitates spontaneous spending under high-arousal conditions (Source: scientific theory). Rating: 8/10.</li>
<li><strong>Reward Circuitry Dominance:</strong> The mesolimbic pathway can override top-down cognitive signals during acute exposure to reward-predicting cues (Source: research synthesis). Rating: 9/10.</li>
</ul>

<p>Ultimately, impulse buying is a manifestation of an evolutionary survival mechanism—designed for resource scarcity—operating within a modern environment of artificial abundance. When the stimulus is removed, the dopaminergic "pulse" fades, and the individual is left to reconcile the behavior with their broader self-concept.</p>',
  ARRAY['neuroscience', 'dopamine', 'behavioral-economics', 'psychology'],
  8,
  NULL,
  NULL,
  NULL,
  true,
  NOW(),
  NOW(),
  NOW()
),

-- Article 2: Deconstructing Post-Purchase Dissonance
(
  'cognitive-dissonance-purchase-regret',
  'The Mechanics of Post-Purchase Dissonance',
  'Understanding the psychological discomfort that follows high-involvement impulse decisions.',
  E'<h2>Post-Purchase Regret as Cognitive Dissonance</h2>
<p>Post-purchase regret is formally understood as <strong>cognitive dissonance</strong>—a state of psychological tension that arises when an individual''s behavior (the purchase) conflicts with their internal values or financial goals. This dissonance typically emerges during the "post-decisional" phase, as the consumer transitions from an affective, reward-seeking state to a deliberative, evaluative state. The discomfort is driven by the realization that choosing one alternative necessitated the rejection of others, leading to what is known as the <strong>spreading of alternatives</strong>.</p>

<p>As the consumer evaluates the item, they often encounter an <strong>affective forecasting error</strong>. They overestimated the long-term happiness the item would provide, and the subsequent "hedonic adaptation" occurs faster than anticipated. To resolve this tension, individuals may employ post-hoc rationalization, mentally inflating the product''s benefits while ignoring its flaws. If this fails, the result is "buyer''s remorse," a form of regret amplified by <strong>counterfactual thinking</strong>—the mental simulation of how much better life would be had the money been saved or spent elsewhere.</p>

<h3>Analysis of Rationales</h3>
<ul>
<li><strong>Festinger''s Dissonance Theory:</strong> Human agents possess an innate drive to maintain consistency between behavior and internal value systems (Source: scientific theory). Rating: 10/10.</li>
<li><strong>Counterfactual Thinking:</strong> The intensity of regret is amplified by the ease with which one can simulate "better" alternative outcomes (Source: research synthesis). Rating: 9/10.</li>
<li><strong>Spreading of Alternatives:</strong> Following a decision, individuals tend to increase their preference for the chosen item and decrease it for the rejected ones to justify the choice (Source: empirical research). Rating: 8/10.</li>
</ul>

<p>The magnitude of this dissonance is proportional to the <strong>irrevocability of the decision</strong>. In an era of easy returns, dissonance is often deferred, but in high-stakes or non-refundable contexts, it can lead to significant psychological stress and a permanent shift in future consumption patterns.</p>',
  ARRAY['cognitive-dissonance', 'consumer-behavior', 'regret', 'psychology'],
  7,
  NULL,
  NULL,
  NULL,
  true,
  NOW(),
  NOW(),
  NOW()
),

-- Article 3: Algorithmic Nudging and Choice Architecture
(
  'choice-architecture-e-commerce',
  'Choice Architecture: Engineering the Impulse',
  'How digital environments are structured to maximize spontaneous conversions through behavioral design.',
  E'<h2>The Intentional Design of Impulse Buying</h2>
<p>In contemporary digital markets, impulse buying is frequently the <strong>intentional product</strong> of sophisticated choice architecture. By manipulating "default" settings and minimizing transactional friction (e.g., biometric one-click payments), e-commerce platforms exploit cognitive shortcuts to facilitate immediate action. This is a practical application of <strong>Nudge Theory</strong>, where the environment is designed to alter behavior without explicitly restricting choice.</p>

<p>However, many modern interfaces utilize <strong>"dark patterns"</strong>—design choices that lean toward sludge rather than helpful nudges. For example, "confirmshaming" or "hidden costs" increase the cognitive load on the user, making it harder for the System 2 (deliberative) brain to intervene. "Real-time" stock counters and countdown timers create artificial scarcity, which triggers a "fear of missing out" (FOMO) and forces a rapid decision-making window.</p>

<h3>Analysis of Rationales</h3>
<ul>
<li><strong>Scarcity Heuristics:</strong> Implementing "real-time stock counters" triggers an urgency response that bypasses deliberative reasoning (Source: empirical research). Rating: 9/10.</li>
<li><strong>Transactional Frictionlessness:</strong> The removal of payment hurdles reduces the time window available for cognitive intervention (Source: online community consensus). Rating: 7/10.</li>
<li><strong>Cognitive Load Manipulation:</strong> Increasing the complexity of the cancellation process makes "continuing" the easier path (Source: research synthesis). Rating: 8/10.</li>
</ul>

<p>The integration of <strong>interstitial triggers</strong>—pop-ups that appear during moments of high engagement—effectively disrupts the consumer''s evaluative process. By the time the user reaches the confirmation page, the "sunk cost" of time and effort already invested often compels them to finalize the purchase, even if the initial intent was merely passive browsing. This represents a systematic exploitation of human behavioral vulnerabilities.</p>',
  ARRAY['choice-architecture', 'nudge-theory', 'UX-design', 'finance'],
  6,
  NULL,
  NULL,
  NULL,
  true,
  NOW(),
  NOW(),
  NOW()
),

-- Article 4: The Halo Effect in Spontaneous Valuation
(
  'halo-effect-product-valuation',
  'The Halo Effect: Cognitive Bias in Rapid Appraisal',
  'Exploring how a single positive attribute can lead to an irrational overestimation of a product''s utility.',
  E'<h2>The Halo Effect in Consumer Decision-Making</h2>
<p>The <strong>Halo Effect</strong> is a pervasive cognitive bias where a singular positive impression of a product influences thoughts about its properties in other unrelated dimensions. In the context of impulse purchasing, this manifests when a consumer is attracted to a "hero feature"—such as an elegant aesthetic design or a prestigious brand logo—and subsequently assumes the product possesses high utility, durability, and ethical standards across all metrics.</p>

<p>This bias is driven by the <strong>affect heuristic</strong>, where a positive emotional response to a product''s appearance leads to an automatic underestimation of its functional risks or long-term costs. The consumer''s brain uses the "beauty" or "prestige" of the item as a proxy for quality, effectively bypassing the need for a technical evaluation. This represents a "substitution" of a hard question (Is this product functionally worth $500?) with an easier one (Do I like how this looks?).</p>

<h3>Analysis of Rationales</h3>
<ul>
<li><strong>Affect Heuristic:</strong> A positive emotional response to a product''s appearance leads to an underestimation of its functional risks or costs (Source: research synthesis). Rating: 8/10.</li>
<li><strong>Brand Equity Transference:</strong> Consumers use brand prestige as a heuristic shortcut to avoid the cognitive load of technical verification (Source: expert opinion). Rating: 7/10.</li>
<li><strong>Attribute Substitution:</strong> Individuals simplify complex decisions by substituting a difficult attribute with a more easily calculated one (Source: scientific theory). Rating: 9/10.</li>
</ul>

<p>This "halo" creates a temporary blind spot regarding the product''s actual necessity. Regret typically emerges once the halo effect diminishes—usually when the consumer interacts with the product in a utilitarian context and discovers that the peripheral aesthetic attributes do not compensate for core functional deficiencies or the resulting financial strain.</p>',
  ARRAY['halo-effect', 'cognitive-bias', 'marketing', 'psychology'],
  7,
  NULL,
  NULL,
  NULL,
  true,
  NOW(),
  NOW(),
  NOW()
),

-- Article 5: Ulysses Contracts and Pre-commitment
(
  'pre-commitment-mitigation-strategies',
  'Ulysses Contracts: Strategies for Mitigation',
  'Using behavioral interventions to bridge the gap between "hot" and "cold" emotional states.',
  E'<h2>Pre-commitment Strategies for Impulse Control</h2>
<p>To combat the deleterious effects of impulse buying, behavioral economists recommend the implementation of <strong>pre-commitment strategies</strong>, colloquially known as "Ulysses Contracts." These are voluntary constraints that individuals place on their future selves to prevent "System 1" impulses from overriding long-term "System 2" financial objectives. These strategies acknowledge the <strong>hot-cold empathy gap</strong>, where an individual in a "cold" (rational) state underestimates how they will feel and act when in a "hot" (aroused) state.</p>

<p>Effective pre-commitment involves creating <strong>artificial friction</strong> to slow down the decision-making process. For example, deleting saved credit card information from browsers or setting up mandatory 24-hour "cooling-off" periods for purchases over a certain amount. Another effective tool is the use of <strong>implementation intentions</strong>—specific "if-then" plans (e.g., "If I am tempted to buy an item on sale, I will first check my existing inventory") that automate the desired behavior and reduce the need for active willpower.</p>

<h3>Analysis of Rationales</h3>
<ul>
<li><strong>Cooling-off Periods:</strong> Mandatory 24-hour delays between cart addition and final checkout significantly reduce spontaneous conversion rates (Source: empirical research). Rating: 9/10.</li>
<li><strong>Implementation Intentions:</strong> Creating "if-then" plans strengthens self-regulatory capacity by automating the rejection of impulsive cues (Source: research synthesis). Rating: 9/10.</li>
<li><strong>Hot-Cold Empathy Gap:</strong> Individuals consistently fail to predict their behavior when in a state of high emotional arousal (Source: scientific theory). Rating: 10/10.</li>
</ul>

<p>By forcing a transition from an affective state to a deliberative state, these contracts allow for a more accurate assessment of opportunity cost. When the gap between the "experiencing self" and the "planning self" is bridged, the probability of post-purchase dissonance is minimized, and financial decisions become anchored in sustained utility rather than transient neurochemical spikes.</p>',
  ARRAY['behavioral-finance', 'self-regulation', 'pre-commitment', 'finance'],
  8,
  NULL,
  NULL,
  NULL,
  true,
  NOW(),
  NOW(),
  NOW()
);
