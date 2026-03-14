# Plan: UI Animation Polish for Premium Feel

## Context

The TruePick web app has a solid glassmorphism design system and GSAP-powered interaction primitives (LiquidButton, GlassCard, SplitText, etc.), but lacks scroll-triggered entrance animations, modal exit animations, and accessibility motion controls. Content appears instantly on all pages — no progressive reveals, no staggered card entrances, no animated stat counters. This makes the app feel static rather than premium. The goal is to add cohesive, scroll-driven entrance animations across high-impact pages while keeping the code DRY via reusable Kinematics hooks.

**Branch:** `feat/ui-animation-polish`
**Animation library:** GSAP 3.14.2 (npm, ES module imports — `import gsap from 'gsap'`)
**Key constraint:** `prefers-reduced-motion` must be respected globally (currently zero checks in codebase)

---

## Phase 0: Foundation — Accessibility + Reusable Primitives

**File:** `apps/web/src/components/Kinematics.tsx`
**File:** `apps/web/src/styles/components.css`

### 0A: `prefersReducedMotion` utility

```typescript
export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
```

Add early returns in existing hooks (`useMagnetic`, `CustomCursor`, `SplitText`, `LiquidButton`) when true. For `SplitText`, set words visible immediately with no animation.

Global CSS safety net in `components.css`:

```css
@media (prefers-reduced-motion: reduce) {
  .cursor-dot, .cursor-ring { display: none; }
}
```

### 0B: `useScrollReveal` hook

Single-element scroll-triggered entrance. Returns a ref.

- **from:** `{ opacity: 0, y: 40 }`
- **to:** `{ opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }`
- **trigger:** `start: 'top 88%'`
- Reduced motion: `gsap.set(el, { opacity: 1, y: 0 })` immediately
- Cleanup: `ctx.revert()`

### 0C: `ScrollReveal` wrapper component

For wrapping existing elements without restructuring JSX:

```tsx
<ScrollReveal delay={0.1}>
  <GlassCard>...</GlassCard>
</ScrollReveal>
```

Renders a `div.scroll-reveal-init` (starts `opacity: 0`) with the ref from `useScrollReveal`.

### 0D: `useStaggerReveal` hook

Grid/list staggered entrance. Takes a CSS selector for children.

- **from:** `{ opacity: 0, y: 30 }`
- **stagger:** `0.1s` default
- **duration:** `0.6s`, ease: `power3.out`
- **trigger:** `start: 'top 85%'`
- Returns a ref for the container element.

### 0E: `useCountUp` hook

Animated number counter on scroll. Takes `endValue`, optional `prefix`/`suffix`/`duration`.

- Uses `gsap.to(proxy, { val: endValue, onUpdate: ... })` with ScrollTrigger
- Updates `el.textContent` on each tick
- Duration: `1.5s`, ease: `power2.out`
- Reduced motion: sets final value immediately
- Returns a ref for the `<span>`.

### 0F: Initial CSS for scroll-reveal elements

```css
.scroll-reveal-init { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .scroll-reveal-init { opacity: 1; }
}
```

### Verification (Phase 0)

- Toggle "Reduce Motion" in OS settings → all pages load with content visible, cursor hidden
- Manually test `useScrollReveal` on one element before proceeding

---

## Phase 1: Landing Page Scroll Animations

**File:** `apps/web/src/pages/Landing.tsx`
**File:** `apps/web/src/pages/Landing.css`

### 1A: Hero entrance (on mount, not scroll)

Staggered `gsap.fromTo` calls scoped to `heroRef`:

| Element               | delay | duration | y  |
| --------------------- | ----- | -------- | -- |
| `.landing-badge`      | 0.1s  | 0.5s     | 20 |
| `.landing-headline`   | 0.25s | 0.7s     | 30 |
| `.landing-subheadline`| 0.45s | 0.6s     | 20 |
| `.landing-hero-actions`| 0.6s | 0.5s     | 20 |

CSS: set initial `opacity: 0` on these elements, with `prefers-reduced-motion` override to `opacity: 1`.

### 1B: "How It Works" staggered cards

```typescript
const stepsRef = useStaggerReveal('.landing-step-card', { stagger: 0.12, y: 30 })
```

CSS: `.landing-step-card { opacity: 0; }` with reduced-motion override.

### 1C: Stats counter animation

Three `useCountUp` refs for `$3,400` / `90%` / `44%` plus `useStaggerReveal` on the container.

```tsx
<span className="landing-stat-value" ref={statDollarRef}>$0</span>
```

### 1D: Waitlist + footer CTA entrance

Wrap with `<ScrollReveal>`.

### 1E: Section titles

Replace `<h2>` text content with `<SplitText>` (already exists, scroll-triggered per-word reveal).

### Verification (Phase 1)

- Desktop: scroll through landing, each section reveals progressively
- Hero animates on load (above the fold, no scroll needed)
- Stats count from 0 to final value
- Mobile: test on 375px — all content accessible, no invisible sections
- Reduced motion: all content visible immediately

---

## Phase 2: Premium Page Scroll Animations

**File:** `apps/web/src/pages/Premium.tsx`
**File:** `apps/web/src/pages/Premium.css`

### 2A: Hero entrance

Same cascading `delay` pattern as Landing hero, scoped to `.premium-hero`.

### 2B: Feature card stagger per section

Each `.premium-features` grid gets its own `useStaggerReveal` call. Since there are 3 separate grid sections, assign distinct refs via unique wrapper `data-*` attributes or direct ref assignment.

### 2C: Section titles → `SplitText`

### 2D: Comparison table + waitlist card

Wrap with `<ScrollReveal>`.

### CSS

`.premium-badge, .premium-headline, .premium-subheadline, .premium-feature-card { opacity: 0; }` with reduced-motion overrides.

### Verification (Phase 2)

- Scroll through Premium — sections reveal sequentially
- Feature cards stagger within each section
- Mobile: all content accessible

---

## Phase 3: Modal Exit Animations

**File:** `apps/web/src/components/Kinematics.tsx` (new hook)
**Files:** All modal components (PaywallModal, VerdictDetailModal, VerdictShareModal, GuestPromptModal, EvaluatingModal)

### 3A: `useModalAnimation` hook

Solves the core problem: React unmounts on `isOpen=false`, but we need the DOM to persist during exit animation.

```typescript
export const useModalAnimation = (isOpen: boolean, duration = 0.2) => {
  const [shouldRender, setShouldRender] = useState(isOpen)
  const backdropRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
    } else if (shouldRender) {
      if (prefersReducedMotion() || !backdropRef.current) {
        setShouldRender(false)
        return
      }
      gsap.to(backdropRef.current, { opacity: 0, duration, ease: 'power2.in' })
      gsap.to(contentRef.current, {
        opacity: 0, y: 15, scale: 0.98,
        duration, ease: 'power2.in',
        onComplete: () => setShouldRender(false),
      })
    }
  }, [isOpen])

  return { shouldRender, backdropRef, contentRef }
}
```

### 3B: Apply to each modal

Change `if (!isOpen) return null` → `if (!shouldRender) return null`. Attach `backdropRef` to the backdrop div, `contentRef` to the modal content div.

**Exit animation spec:** backdrop fades out + content slides down 15px, scales to 0.98, fades out — all in 200ms.

### Verification (Phase 3)

- Open/close each modal type — smooth exit instead of instant unmount
- Rapid open/close — no visual glitches
- EvaluatingModal: smooth fade-out when verdict processing completes

---

## Phase 4: Dashboard Polish

**File:** `apps/web/src/pages/Dashboard.tsx`
**File:** `apps/web/src/styles/components.css`

### 4A: Verdict card stagger entrance

Data-load-triggered (not scroll). When `recentVerdicts` changes, animate `.verdict-card` children:

```typescript
useEffect(() => {
  if (recentVerdicts.length === 0 || prefersReducedMotion()) return
  gsap.fromTo('.verdict-stack-vertical .verdict-card',
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, stagger: 0.08, duration: 0.5, ease: 'power3.out' }
  )
}, [recentVerdicts.length])
```

CSS: `.verdict-stack-vertical .verdict-card { opacity: 0; }` with reduced-motion override.

### 4B: Form section fade-in on mount

Subtle `fromTo` on `.decision-section`: `opacity 0→1, y 15→0, duration 0.6, delay 0.2`.

### Verification (Phase 4)

- Load dashboard with verdicts — cards stagger in
- No verdicts — empty state visible immediately
- New verdict submitted — card appears with animation after modal closes

---

## Phase 5: Profile Tab Transitions

**File:** `apps/web/src/pages/Profile.tsx`
**File:** `apps/web/src/styles/components.css`

### 5A: CSS-only tab content fade

Add `key={activeTab}` to force remount on tab switch, triggering CSS animation:

```tsx
<div key={activeTab} className="profile-tab-content" role="tabpanel">
```

```css
.profile-tab-content {
  animation: tabFadeIn 0.25s ease;
}

@keyframes tabFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .profile-tab-content { animation: none; }
}
```

### Verification (Phase 5)

- Switch tabs — content fades in smoothly
- No flash of empty content between tabs
- Reduced motion: instant switch

---

## Phase 6: HowItWorks Page

**File:** `apps/web/src/pages/HowItWorks.tsx`

Low priority — currently boilerplate. Wrap sections in `<ScrollReveal>` and use `<SplitText>` for headings. Quick pass once Phase 0 primitives exist.

---

## Mobile & Tablet Analysis

Every animation phase must be evaluated against the 4 breakpoints: `≤1024px` (tablet), `≤900px` (small tablet), `≤600px` (phone), `≤380px` (small phone), plus touch devices `(hover: none) and (pointer: coarse)`.

### Scroll-Triggered Animations (Phases 0-2, 4, 6)

**Issue: Content invisible until scroll on small viewports.**
On desktop, `start: 'top 88%'` means the element triggers when its top reaches 88% down the viewport (~160px from the bottom of a 1080p screen). On a 667px phone viewport, that's ~80px from bottom — still fine. But if the user scrolls fast or if the element is tall, it might appear cut off.

**Mitigation:** The hooks accept `start` as a parameter. No breakpoint-specific overrides needed inside the hook — the trigger position works proportionally across viewport sizes since it's percentage-based. GSAP ScrollTrigger automatically recalculates on resize.

**Stagger on single-column layouts:** At `≤900px`, Landing steps and Premium features collapse from multi-column grid to single-column (`grid-template-columns: 1fr`). Stagger still works — cards appear one after another vertically. The stagger timing (0.1–0.12s) is fast enough to not feel slow even with 3 sequential cards.

### Hero Entrance (Phase 1A, 2A)

**Issue: Hero animations on slow mobile connections.**
The hero `gsap.fromTo` runs on mount, not on scroll. On mobile, elements start `opacity: 0` in CSS and GSAP reveals them. If GSAP is slow to initialize (though unlikely with npm bundling), content would be invisible.

**Mitigation:** GSAP is bundled via npm and loaded synchronously with the component — no CDN race condition. The `opacity: 0` initial state is safe because GSAP runs in the same tick as React's `useEffect`.

**Issue: Hero delay feels sluggish on mobile.**
The desktop hero stagger totals ~1.1s (last element at delay 0.6s + duration 0.5s). On mobile, users expect faster feedback.

**Mitigation:** Detect mobile via `matchMedia('(max-width: 600px)')` in the mount effect. Reduce all delays by ~40% on mobile:

| Element                | Desktop delay | Mobile delay (≤600px) |
| ---------------------- | ------------- | --------------------- |
| `.landing-badge`       | 0.1s          | 0.05s                 |
| `.landing-headline`    | 0.25s         | 0.15s                 |
| `.landing-subheadline` | 0.45s         | 0.25s                 |
| `.landing-hero-actions`| 0.6s          | 0.35s                 |

### Counter Animation (Phase 1C)

**Issue: Counter `useCountUp` on small stat cards.**
At `≤600px`, stat values shrink to `font-size: 1.75rem` and at `≤380px` to `1.5rem`. The counter animation uses `textContent` updates — this is a text-only operation with zero layout impact. Works identically at all sizes.

**Issue: Stats go single-column at ≤900px.**
Cards stack vertically, each triggering its own ScrollTrigger (via the container's `useStaggerReveal`). The stagger effect becomes a top-to-bottom cascade — visually appropriate for vertical layout.

### Modal Exit Animations (Phase 3)

**Fully responsive — no breakpoint concerns.** Modals are already viewport-centered overlays. The exit animation (opacity fade + slight translateY + scale) is GPU-composited and works identically across all screen sizes. The 200ms duration is fast enough that touch users won't feel delayed.

### Profile Tab Transitions (Phase 5)

**CSS `key={activeTab}` remount approach works at all sizes.** The `tabFadeIn` animation is 0.25s with `translateY(8px)` — subtle enough to not cause visual jumping on small screens where tab content is taller and scrolls further.

**Issue: Tab bar wrapping on ≤380px.**
If profile tabs wrap to 2 lines, the sliding indicator (Phase 5B stretch goal) breaks. **Decision:** Skip the sliding indicator in this plan. Keep the existing `.active` border-bottom approach. The CSS fade animation (Phase 5A) is the safe win.

### Touch Devices

**No touch-specific animation changes needed.** All animations use `opacity` and `transform` — no hover-dependent triggers. The existing `(hover: none) and (pointer: coarse)` media query handles touch tap targets but doesn't affect scroll-triggered GSAP animations.

**Custom cursor:** Already desktop-only by behavior (follows mouse position). The `prefersReducedMotion` check adds an explicit `display: none` via CSS, but the cursor is already invisible on touch devices since there's no mouse movement.

### Summary: No Breakpoint-Specific Overrides Needed in Hooks

All animation primitives work proportionally across viewports because:
1. ScrollTrigger `start` is percentage-based (scales with viewport height)
2. `transform` and `opacity` are resolution-independent
3. Stagger timing is the same for both grid and single-column layouts (0.1s per item)
4. The only breakpoint-aware code is the hero entrance delay reduction on `≤600px`

---

## Post-Implementation Deliverable: Animation Tuning Guide

After all phases are implemented, write `docs/ui-animation-tuning-guide.md` containing:

1. **Architecture overview** — how Kinematics hooks work, the GSAP + ScrollTrigger lifecycle, `ctx.revert()` cleanup pattern
2. **Hook reference** — each new hook (`useScrollReveal`, `useStaggerReveal`, `useCountUp`, `useModalAnimation`, `prefersReducedMotion`) with:
   - Parameter table (name, type, default, description)
   - Code example showing how to add it to a new page
   - File location and line numbers
3. **Per-page animation inventory** — for each page, list every animated element with:
   - CSS class/selector
   - Animation type (entrance, stagger, counter, exit)
   - Tunable parameters and their current values
   - Code location (file:line)
4. **Common tuning recipes** — "how to make X feel faster/slower/bouncier":
   - Change durations (with recommended ranges)
   - Change easing curves (with visual descriptions)
   - Change stagger intervals
   - Change ScrollTrigger start positions
   - Change hero entrance sequence
5. **Troubleshooting** — common issues (content invisible, animation not triggering, stale ScrollTriggers, mobile quirks)
6. **Accessibility** — how `prefers-reduced-motion` works, how to test it, what happens when it's enabled

---

## Files Summary

| File | Change |
| ---- | ------ |
| `apps/web/src/components/Kinematics.tsx` | Add `prefersReducedMotion`, `useScrollReveal`, `ScrollReveal`, `useStaggerReveal`, `useCountUp`, `useModalAnimation` |
| `apps/web/src/styles/components.css` | Reduced-motion global rules, `.scroll-reveal-init`, tab animation keyframes, verdict card initial opacity |
| `apps/web/src/pages/Landing.tsx` | Hero entrance, stagger cards, counter stats, section title SplitText, ScrollReveal wrappers |
| `apps/web/src/pages/Landing.css` | Initial opacity states for hero elements, step cards; reduced-motion overrides |
| `apps/web/src/pages/Premium.tsx` | Hero entrance, feature card stagger, section title SplitText, ScrollReveal wrappers |
| `apps/web/src/pages/Premium.css` | Initial opacity states; reduced-motion overrides |
| `apps/web/src/pages/Dashboard.tsx` | Verdict card stagger, form fade-in |
| `apps/web/src/pages/Profile.tsx` | Add `key={activeTab}` to tab content wrapper |
| `apps/web/src/components/PaywallModal.tsx` | Use `useModalAnimation` for exit animation |
| `apps/web/src/components/VerdictDetailModal.tsx` | Use `useModalAnimation` for exit animation |
| `apps/web/src/components/VerdictShareModal.tsx` | Use `useModalAnimation` for exit animation |
| `apps/web/src/components/GuestPromptModal.tsx` | Use `useModalAnimation` for exit animation |
| `apps/web/src/components/EvaluatingModal.tsx` | Use `useModalAnimation` for exit animation |
| `apps/web/src/pages/HowItWorks.tsx` | ScrollReveal + SplitText wrappers |
| `docs/ui-animation-tuning-guide.md` | **New** — comprehensive tuning guide with code segments and instructions |

## Deliberately Excluded

- **Route transition animations** — requires wrapping React Router with AnimatePresence or similar; high complexity, modest payoff, risk of auth redirect bugs
- **Parallax/depth effects** — fights the glassmorphism depth system already in place
- **Skeleton loaders** — separate feature involving API response handling, not animation work
- **Swipe page changes** — already has good touch animation; diminishing returns
- **Sliding tab indicator** — breaks when tabs wrap on ≤380px; not worth the complexity

## Verification (End-to-End)

1. `npx tsc --noEmit --project apps/web/tsconfig.app.json` — no new type errors
2. `npm run build:web` — builds cleanly
3. Manual scroll test on Landing, Premium, Dashboard — progressive reveals work
4. Open/close all 5 modal types — exit animations play smoothly
5. Switch Profile tabs — fade transition
6. Enable OS "Reduce Motion" — all content visible immediately, no animations, cursor hidden
7. Test on mobile (375px) — all content accessible, no invisible/clipped sections
8. Test on tablet (768px, 1024px) — stagger and reveal work in single-column layouts
9. Navigate between pages — no stale ScrollTriggers (GSAP `ctx.revert()` cleanup)
10. Verify `docs/ui-animation-tuning-guide.md` covers all hooks, pages, and tuning recipes
