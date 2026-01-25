# Regret-Based Purchase Reflection: Nopamine

This MVP is a behavioural feedback system that helps users reduce unnecessary purchases by learning from their own past regret patterns.
It does not attempt to “predict rational spending.” It reflects historical emotional outcomes and uses them to introduce friction at the point of purchase.

The product loop is:

> Import purchases → Swipe regret/satisfied → Learn personal patterns → Gate new purchases (🟢 Yes / 🟡 Hold / 🔴 No)

The strength of the MVP is not intelligence. It is **self-calibration at scale**.

---

## Core Features

### 1. Purchase Ingestion (Primary: Email API)

**What it does**

* Connects to the user’s email (read-only)
* Extracts receipts from whitelisted vendors (Amazon, Uber, App Store/Google Play, hotel, plane tickets, fashion)
* Parses:

  * Product name
  * Price
  * Date
  * Vendor
  * Order ID

> Purcahses without email reciepts is ignored (dining out, grocery, etc.)
> Consider the same products but from different brands, and to quantify vendors, I can collect a large database of brands and rank them with their price categories (e.g., class 0: luxury, class 1: best tier, class 2: medium tier, class 3: generic)

**Why it matters**

* Minimize manual entry
* High data quality
* Immediate swipe stack generation

---

### 2. Manual entry (Secondary Path)

**What it does**

> Assumption: motivated users would already be okay with expense tracking and manual entry is kept to a minimum.

* Users enters purchase info (item + price + date)
* Some big purchases don't have email reciepts

---

### 3. Swipe Deck (Purchased + Unpurchased)

**What it does**

* Binary swipe:
  * Right → Satisfied
  * Left → Regret
* Each swipe labels a purchase outcome

**Why it matters**

* Trains a personal regret model
* Low cognitive load
* Addictive interaction

This is the core behavioural engine.

---

### 4. Verdict Engine (powered by LLM, cheap nano models)

When the user considers buying something:

| Verdict   | Logic                                |
| --------- | ------------------------------------ |
| 🟢 Green  | Similar items historically satisfied, within budget range, fits into one's values |
| 🟡 Yellow | Uncertain → force 24h delay          |
| 🔴 Red    | Similar items historically regretted, outside budget range, doesn't fit into one's values |

Yellow is the primary intervention mechanism.

---

### 5. Pattern Feedback

After sufficient swipes, surface blunt insights:

* “You regret accessories 68% of the time.”
* “Items over $100 have high regret probability.”
* “You rarely regret experience purchases.”

This makes the system feel intelligent without adding complexity.

---

## User Journey

1. **Onboarding**

   * User chooses:
     * Connect email (recommended)
     * Or manual entry
   * App shows exactly what data is read
   * Value setup
        * “Spending on convenience is worth it.”
        * “I prefer durable goods over trendy ones.”
        * “I value experiences over objects.”
        * “I regret impulse buys more than planned purchases.”

2. **Deck Creation**

   * Purchases become swipe cards
   * Editable fields:
     * Name
     * Price
     * Category (LLM determined based on a preset of enums)
     * Delete

3. **Calibration Phase**

   * User swipes 20–50 cards
   * System starts showing pattern summaries

4. **Decision Phase**

   * User enters new product and justification:

     * Screenshot
     * URL
     * Manual entry
   * App outputs:

     * 🟢 Yes
     * 🟡 Hold 24h
     * 🔴 No

5. **Reinforcement**

   * Swiping continues
   * Model sharpens
   * Verdict confidence increases

---

## Feature-Based Vertical Sprints

(Each sprint is fully vertical: SQL → API → Model → UI)

1. User auth
  - CRUD user value
  - CRUD past purchases
2. Swiping
  - Swiping satisfied/regret
  - Undo
  - Update database
3. Email API connection
  - Gmail
  - Outlook

## What This MVP Is (and Is Not)

| It is                     | It is not                |
| ------------------------- | ------------------------ |
| Personal regret mirror    | Rational finance advisor |
| Behaviour shaping tool    | Budgeting app            |
| Addictive reflection loop | AI “wisdom” engine       |

Its value is psychological friction, not optimisation.

---

## Strategic Positioning

You are not telling users how to spend.
You are forcing them to confront their own historical emotional outcomes.

That is far more uncomfortable—and far more powerful.
