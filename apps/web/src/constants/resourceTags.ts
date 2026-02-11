/**
 * Recommended tags for resource articles
 * These tags help categorize and organize educational content
 */
export const RECOMMENDED_TAGS = [
  // Topic categories
  'neuroscience',
  'behavioral-economics',
  'psychology',
  'finance',
  'self-regulation',
  'cognitive-bias',
  'marketing',
  'consumer-behavior',

  // Specific concepts
  'dopamine',
  'cognitive-dissonance',
  'regret',
  'choice-architecture',
  'nudge-theory',
  'UX-design',
  'halo-effect',
  'pre-commitment',
  'impulse-control',
  'decision-making',
  'habit-formation',
  'spending-triggers',
  'mental-accounting',
  'loss-aversion',
  'hyperbolic-discounting',

  // Practical tags
  'money-saving',
  'budgeting',
  'financial-planning',
  'mindfulness',
  'productivity',
  'minimalism',
  'digital-wellness',
] as const

export type RecommendedTag = (typeof RECOMMENDED_TAGS)[number]
