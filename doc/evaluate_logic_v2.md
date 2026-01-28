# Purchase Evaluation Logic (v1)

This document explains the current rule-based logic used by `evaluatePurchase` in
`apps/web/src/api/verdictService.ts`. It uses LLM to compute a risk score from price,
category, justification, and urgency signals, then maps that score to a verdict
(`buy`, `hold`, or `skip`).

# How the scoring works

LLM model: gpt-5-nano

The LLM takes inputs from three sources:
1. New purchase query
  - Item name
  - Price
  - Category
  - Vendor, will be converted to a numerical mapping for basic/mid-tier/luxury categorization, preset lookup dictionary
  - Rationale
2. User profile: user values and corresponding ratings
3. Past purchases: regret and satisfied ratings
  - Difficulty with token size: how many purchases to include? Or simply just the similar purchases?
    - Focus on recency effect and user's growth overtime if just the 5 most recent purchases
    - Focus on product category
    - Focus on price
    - Or some sort of composite score

The LLM outputs a verdict (buy, hold, skip) and a short rationale.

# Values

Durability: "I value things that last several years."
Efficiency: "I value tools that saves time for me."
Aesthetics: "I value items that fit my existing environment’s visual language."
Interpersonal Value: "I value purchases that facilitate shared experiences."
Emotional Value: "I value purchases that provide meaningful emotional benefits."

# PROMPT

## SYSTEM PROMPT
Role: You are a purchase evaluator. Your responsibility is to identify unnecessary and risky purchases according to user's values and past purchase history. You will generate a verdict from these three options: buy, hold, and skip.

User values:
- Convenience ("How much this purchase saves time for you.")
- Durability ("How long you plan on keeping the item.")
- Experience ("How much happiness do you anticipate when purchasing a new item.")
- Impulse sensitivity ("How much trouble do you have when experiencing impulsive decisions.")

## USER PROMPT

With their past purchases of the similar function/category:

Their purchasing trend with the most recent purchases:

Now evaluate this purchase:
User rationale was:

Output the final verdict, scoring (0-5 with higher score indicate greater conflict or risk), and a 2-3 sentence rationale for final verdict in a json format.
```json
{
  "value_conflict_score": {
    "definition": "Degree to which making this purchase conflicts with the user's pre-committed values.",
    "scale": {
      "min": 0,
      "max": 5,
      "interpretation": {
        "0": "No conflict with stated values",
        "3": "Moderate tension with stated values",
        "5": "Direct contradiction of stated values"
      }
    },
    "explanation": ""
  },
  "pattern_repetition_risk": {
    "definition": "Degree to which this purchase resembles past purchases that the user later regretted.",
    "scale": {
      "min": 0,
      "max": 1,
      "interpretation": {
        "0": "No similarity to regretted purchases",
        "0.5": "Partial similarity",
        "1": "Highly similar to a known regret pattern"
      }
    },
    "explanation": ""
  },
  "final_verdict": {
    "decision": "buy | hold | skip",
    "rationale": "Because the user endorses values [XYZ]. Past purchase history indicates [XYZ]. This purchase [aligns with / partially conflicts with / contradicts] those values and [does not repeat / partially repeats / strongly repeats] prior regret patterns."
  }
}
```