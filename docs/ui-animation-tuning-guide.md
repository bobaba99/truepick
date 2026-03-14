# UI Animation Tuning Guide

This guide covers all animation primitives, per-page animation inventories, and instructions for tuning durations, easing, stagger intervals, and scroll triggers across TruePick's web app.

---

## 1. Architecture Overview

All animation primitives live in `apps/web/src/components/Kinematics.tsx`. They are built on:

- **GSAP 3.14.2** (npm, ES module imports — `import gsap from 'gsap'`)
- **ScrollTrigger** plugin (`import { ScrollTrigger } from 'gsap/ScrollTrigger'`, registered at module scope)
- **`gsap.context()`** for animation cleanup — every hook returns a cleanup function via `ctx.revert()` to prevent stale animations on unmount or route changes

### Key Patterns

- **Scroll-triggered entrances**: `useScrollReveal`, `useStaggerReveal`, `useCountUp`, and `SplitText` all use `ScrollTrigger` to fire when elements enter the viewport
- **Mount-triggered entrances**: Hero animations and Dashboard verdict stagger run on mount/data-load via `useEffect`
- **Modal exit animations**: `useModalAnimation` uses a `shouldRender` state machine to delay React unmount until GSAP's exit animation completes
- **CSS-only transitions**: Profile tab fade uses `key={activeTab}` to force React remount, triggering a CSS `@keyframes` animation
- **Accessibility**: `prefersReducedMotion()` is checked before every animation; when true, elements are set to their final state immediately

---

## 2. Hook Reference

### `prefersReducedMotion()`

**File:** `Kinematics.tsx:36`

```typescript
export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
```

Returns `true` if the user has enabled "Reduce Motion" in their OS settings. Used as an early return guard in every animation hook.

---

### `useScrollReveal(options?)`

**File:** `Kinematics.tsx:50`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `y` | `number` | `40` | Starting Y offset (px) |
| `duration` | `number` | `0.7` | Animation duration (seconds) |
| `delay` | `number` | `0` | Delay before animation starts |
| `start` | `string` | `'top 88%'` | ScrollTrigger start position |

**Returns:** `ref` — attach to the element to animate.

**Example:**

```tsx
const ref = useScrollReveal({ y: 30, duration: 0.5 })
return <div ref={ref} className="scroll-reveal-init">Content</div>
```

**Important:** The element must have `opacity: 0` initially (via `.scroll-reveal-init` class or custom CSS). GSAP animates it to `opacity: 1`.

---

### `ScrollReveal` (Component)

**File:** `Kinematics.tsx:91`

Wrapper component that uses `useScrollReveal` internally. Accepts all props of `useScrollReveal` plus standard div props.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `y` | `number` | `40` | Starting Y offset |
| `duration` | `number` | `0.7` | Duration |
| `delay` | `number` | `0` | Delay |
| `start` | `string` | `'top 88%'` | ScrollTrigger start |
| `className` | `string` | `''` | Additional CSS classes |

**Example:**

```tsx
<ScrollReveal delay={0.1}>
  <GlassCard>...</GlassCard>
</ScrollReveal>
```

---

### `useStaggerReveal(itemSelector, options?)`

**File:** `Kinematics.tsx:115`

Staggered entrance for a group of children within a container.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `itemSelector` | `string` | (required) | CSS selector for children to animate |
| `y` | `number` | `30` | Starting Y offset per item |
| `stagger` | `number` | `0.1` | Delay between each item (seconds) |
| `duration` | `number` | `0.6` | Duration per item |
| `start` | `string` | `'top 85%'` | ScrollTrigger start |

**Returns:** `ref` — attach to the **container** element.

**Example:**

```tsx
const stepsRef = useStaggerReveal('.landing-step-card', { stagger: 0.12, y: 30 })
return (
  <div ref={stepsRef}>
    <GlassCard className="landing-step-card">...</GlassCard>
    <GlassCard className="landing-step-card">...</GlassCard>
    <GlassCard className="landing-step-card">...</GlassCard>
  </div>
)
```

**Important:** Each child matched by `itemSelector` must have `opacity: 0` in CSS.

---

### `useCountUp(endValue, options?)`

**File:** `Kinematics.tsx:161`

Animated number counter triggered on scroll.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `endValue` | `number` | (required) | Final number to count to |
| `prefix` | `string` | `''` | Text before number (e.g. `'$'`) |
| `suffix` | `string` | `''` | Text after number (e.g. `'%'`) |
| `duration` | `number` | `1.5` | Count-up duration |
| `decimals` | `number` | `undefined` | Fixed decimal places |

**Returns:** `ref` — attach to a `<span>`.

**Example:**

```tsx
const statRef = useCountUp(3400, { prefix: '$' })
return <span ref={statRef}>$0</span>
```

The initial text content (`$0`) is visible before the scroll trigger fires. Once triggered, it counts from 0 to 3,400 over 1.5 seconds.

---

### `useModalAnimation(isOpen, duration?)`

**File:** `Kinematics.tsx:217`

Exit animation for modals. Delays React unmount until GSAP animation completes.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `isOpen` | `boolean` | (required) | Modal open state |
| `duration` | `number` | `0.2` | Exit animation duration (seconds) |

**Returns:** `{ shouldRender, backdropRef, contentRef }`

**Exit animation spec:** Backdrop fades out (`opacity → 0`). Content slides down 15px, scales to 0.98, fades out — all in 200ms with `power2.in` easing.

**Usage pattern:**

```tsx
function MyModal({ isOpen, onClose }) {
  const { shouldRender, backdropRef, contentRef } = useModalAnimation(isOpen)

  if (!shouldRender) return null  // ← replaces `if (!isOpen) return null`

  return (
    <div ref={backdropRef} className="modal-backdrop">
      <div ref={contentRef} className="modal-content">
        ...
      </div>
    </div>
  )
}
```

---

### `SplitText`

**File:** `Kinematics.tsx:365`

Per-word scroll-triggered text reveal animation.

| Prop | Type | Description |
|------|------|-------------|
| `children` | `string` | Text to animate (must be a plain string) |
| `className` | `string` | CSS class for the wrapper div |

**Animation:** Words slide up from 110% Y with a -40° X rotation, staggered 0.02s apart, over 0.8s with `power4.out` easing. Triggered when the wrapper enters 90% of the viewport.

**Note:** `SplitText` renders a `<div>` wrapper, not a heading element. Style with the class (e.g. `.landing-section-title`).

---

## 3. Per-Page Animation Inventory

### Landing Page

**Files:** `pages/Landing.tsx`, `pages/Landing.css`

| Element | Animation Type | Hook/Method | Key Parameters | Code Location |
|---------|---------------|-------------|----------------|---------------|
| `.landing-badge` | Mount entrance | `gsap.fromTo` | delay: 0.1 (mobile: 0.05), duration: 0.5, y: 20 | `Landing.tsx:41-52` |
| `.landing-headline` | Mount entrance | `gsap.fromTo` | delay: 0.25 (mobile: 0.15), duration: 0.7, y: 30 | `Landing.tsx:41-52` |
| `.landing-subheadline` | Mount entrance | `gsap.fromTo` | delay: 0.45 (mobile: 0.25), duration: 0.6, y: 20 | `Landing.tsx:41-52` |
| `.landing-hero-actions` | Mount entrance | `gsap.fromTo` | delay: 0.6 (mobile: 0.35), duration: 0.5, y: 20 | `Landing.tsx:41-52` |
| `.landing-step-card` (×3) | Scroll stagger | `useStaggerReveal` | stagger: 0.12, y: 30 | `Landing.tsx:59` |
| `.landing-stat-card` (×3) | Scroll stagger | `useStaggerReveal` | stagger: 0.12, y: 30 | `Landing.tsx:62` |
| Stat `$3,400` | Scroll counter | `useCountUp` | endValue: 3400, prefix: '$' | `Landing.tsx:65` |
| Stat `90%` | Scroll counter | `useCountUp` | endValue: 90, suffix: '%' | `Landing.tsx:66` |
| Stat `44%` | Scroll counter | `useCountUp` | endValue: 44, suffix: '%' | `Landing.tsx:67` |
| Section titles | Scroll word-reveal | `SplitText` | stagger: 0.02, duration: 0.8 | `Landing.tsx:140,168,198,234` |
| Waitlist section | Scroll fade-up | `ScrollReveal` | y: 40, duration: 0.7 | `Landing.tsx:196` |
| Footer CTA | Scroll fade-up | `ScrollReveal` | y: 40, duration: 0.7 | `Landing.tsx:233` |

**CSS initial states:** `Landing.css` — `.landing-badge`, `.landing-headline`, `.landing-subheadline`, `.landing-hero-actions`, `.landing-step-card`, `.landing-stat-card` all start `opacity: 0` with `prefers-reduced-motion` override to `opacity: 1`.

### Premium Page

**Files:** `pages/Premium.tsx`, `pages/Premium.css`

| Element | Animation Type | Hook/Method | Key Parameters | Code Location |
|---------|---------------|-------------|----------------|---------------|
| `.premium-badge` | Mount entrance | `gsap.fromTo` | delay: 0.1 (mobile: 0.05), y: 20 | `Premium.tsx:32-46` |
| `.premium-headline` | Mount entrance | `gsap.fromTo` | delay: 0.25 (mobile: 0.15), y: 30 | `Premium.tsx:32-46` |
| `.premium-subheadline` | Mount entrance | `gsap.fromTo` | delay: 0.45 (mobile: 0.25), y: 20 | `Premium.tsx:32-46` |
| Chrome Extension cards (×3) | Scroll stagger | `useStaggerReveal` | stagger: 0.1, y: 30 | `Premium.tsx:49` |
| Verdicts cards (×2) | Scroll stagger | `useStaggerReveal` | stagger: 0.1, y: 30 | `Premium.tsx:50` |
| Analytics cards (×3) | Scroll stagger | `useStaggerReveal` | stagger: 0.1, y: 30 | `Premium.tsx:51` |
| Section titles | Scroll word-reveal | `SplitText` | stagger: 0.02, duration: 0.8 | Multiple locations |
| Comparison table | Scroll fade-up | `ScrollReveal` | y: 40, duration: 0.7 | `Premium.tsx` |
| Waitlist section | Scroll fade-up | `ScrollReveal` | y: 40, duration: 0.7 | `Premium.tsx` |

**CSS initial states:** `Premium.css` — `.premium-badge`, `.premium-headline`, `.premium-subheadline`, `.premium-feature-card` start `opacity: 0`.

### Dashboard

**Files:** `pages/Dashboard.tsx`, `styles/components.css`

| Element | Animation Type | Hook/Method | Key Parameters | Code Location |
|---------|---------------|-------------|----------------|---------------|
| `.verdict-card` (×3) | Data-load stagger | `gsap.fromTo` | stagger: 0.08, y: 20, duration: 0.5 | `Dashboard.tsx` (search for "Verdict card stagger") |
| `.decision-section` | Mount fade-in | `gsap.fromTo` | y: 15, duration: 0.6, delay: 0.2 | `Dashboard.tsx` (search for "Form section fade-in") |

**CSS initial states:** `components.css` — `.verdict-stack-vertical .verdict-card` and `.decision-section` start `opacity: 0`.

### Profile

**Files:** `pages/Profile.tsx`, `styles/components.css`

| Element | Animation Type | Method | Key Parameters |
|---------|---------------|--------|----------------|
| `.profile-tab-content` | CSS fade on tab switch | `key={activeTab}` remount + CSS `@keyframes tabFadeIn` | duration: 0.25s, translateY: 8px |

### HowItWorks

**File:** `pages/HowItWorks.tsx`

| Element | Animation Type | Hook/Method |
|---------|---------------|-------------|
| Page heading | Word reveal | `SplitText` |
| Each content section | Scroll fade-up | `ScrollReveal` (default params) |

### Modals (All 5)

**Files:** `components/PaywallModal.tsx`, `VerdictDetailModal.tsx`, `VerdictShareModal.tsx`, `GuestPromptModal.tsx`, `EvaluatingModal.tsx`

All use `useModalAnimation(isOpen)` with default 200ms duration. Exit animation: backdrop fades, content slides down 15px + scales to 0.98 + fades.

---

## 4. Common Tuning Recipes

### Make animations faster/slower

Change the `duration` parameter:

```typescript
// Faster (snappy)
const ref = useScrollReveal({ duration: 0.4 })

// Slower (luxurious)
const ref = useScrollReveal({ duration: 1.0 })
```

**Recommended ranges:**
- Entrance animations: 0.4–0.8s
- Stagger intervals: 0.06–0.15s
- Counter animations: 1.0–2.5s
- Modal exits: 0.15–0.3s

### Change easing curves

Find `ease: 'power3.out'` in the hook and replace:

| Easing | Feel |
|--------|------|
| `'power1.out'` | Gentle, barely noticeable deceleration |
| `'power2.out'` | Moderate deceleration (good for counters) |
| `'power3.out'` | Noticeable deceleration (current default for entrances) |
| `'power4.out'` | Dramatic deceleration (used by SplitText) |
| `'back.out(1.2)'` | Slight overshoot, bouncy feel |
| `'elastic.out(1, 0.3)'` | Spring bounce (used by LiquidButton release) |
| `'circ.out'` | Quick start, smooth stop |

### Change stagger intervals

```typescript
// Tighter stagger (cards appear almost simultaneously)
const ref = useStaggerReveal('.card', { stagger: 0.05 })

// Wider stagger (noticeable cascade)
const ref = useStaggerReveal('.card', { stagger: 0.18 })
```

### Change ScrollTrigger start positions

The `start` parameter controls when the animation fires relative to the viewport:

```typescript
// Fires earlier (when top of element reaches 95% down the viewport)
const ref = useScrollReveal({ start: 'top 95%' })

// Fires later (when top of element reaches 70% down)
const ref = useScrollReveal({ start: 'top 70%' })
```

`'top 88%'` means "when the top of the element reaches 88% from the top of the viewport" — so lower percentages fire later (element must be more visible).

### Change hero entrance sequence

Edit the delay arrays in `Landing.tsx` or `Premium.tsx`:

```typescript
// Desktop delays  [badge, headline, subheadline, actions]
const d = isMobile ? [0.05, 0.15, 0.25, 0.35] : [0.1, 0.25, 0.45, 0.6]
```

To make the cascade faster, reduce the gaps:

```typescript
const d = isMobile ? [0.03, 0.08, 0.14, 0.2] : [0.05, 0.12, 0.2, 0.3]
```

### Change modal exit animation

In `Kinematics.tsx:217`, adjust the `useModalAnimation` defaults or pass a custom duration:

```typescript
// Slower modal exit (300ms)
const { shouldRender, backdropRef, contentRef } = useModalAnimation(isOpen, 0.3)
```

To change the exit transform, edit the `gsap.to` call inside `useModalAnimation`:

```typescript
gsap.to(contentRef.current, {
  opacity: 0,
  y: 15,      // ← increase for more dramatic slide
  scale: 0.98, // ← decrease for more dramatic shrink
  duration,
  ease: 'power2.in',
  onComplete: () => { setShouldRender(false) },
})
```

### Change Profile tab transition

In `components.css`, find `@keyframes tabFadeIn`:

```css
@keyframes tabFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px); /* ← increase for more slide */
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.profile-tab-content {
  animation: tabFadeIn 0.25s ease; /* ← change duration here */
}
```

---

## 5. Troubleshooting

### Content is invisible (not animating in)

**Cause:** CSS sets `opacity: 0` but the GSAP animation didn't fire.

1. Check that the element's container has the correct `ref` attached
2. Verify ScrollTrigger is registered: `gsap.registerPlugin(ScrollTrigger)` must be at module scope in `Kinematics.tsx`
3. Check that `prefersReducedMotion()` isn't returning `true` — toggle "Reduce Motion" in OS settings

### Animation not triggering on scroll

**Cause:** ScrollTrigger `start` position is too restrictive or the element is above the fold.

1. Lower the start threshold: `{ start: 'top 95%' }`
2. For above-the-fold elements, use mount-triggered animations (no ScrollTrigger)

### Stale ScrollTriggers after navigation

**Cause:** `ctx.revert()` cleanup not running.

1. Every `useEffect` that creates GSAP animations must return `() => ctx.revert()`
2. Check that the hook's dependency array is correct (usually `[]` for one-time animations)

### Mobile: content clipped or invisible

1. Verify `@media (prefers-reduced-motion: reduce)` overrides set `opacity: 1`
2. Check that ScrollTrigger `start` percentages work on small viewports (they scale proportionally)
3. Test on 375px width — all content should be visible

### Rapid modal open/close glitch

The `useModalAnimation` state machine handles this: if `isOpen` flips back to `true` during exit animation, `shouldRender` stays `true` and the content remains visible. The exit `gsap.to` calls will be overridden by the next open state change.

---

## 6. Accessibility

### How `prefers-reduced-motion` works

1. **JS guard:** `prefersReducedMotion()` returns `true` when the OS setting is enabled. Every animation hook checks this and either skips the animation or calls `gsap.set()` to show the final state immediately.

2. **CSS fallback:** All `opacity: 0` initial states have a `@media (prefers-reduced-motion: reduce)` override that sets `opacity: 1`. This ensures content is visible even if JavaScript fails to load.

3. **Custom cursor:** Hidden via CSS `display: none` on `.cursor-dot` and `.cursor-ring` when reduced motion is enabled.

### How to test

- **macOS:** System Settings → Accessibility → Display → Reduce motion
- **Windows:** Settings → Ease of Access → Display → Show animations in Windows → Off
- **iOS:** Settings → Accessibility → Motion → Reduce Motion
- **Chrome DevTools:** Rendering tab → Emulate CSS media feature `prefers-reduced-motion`

### What happens when reduced motion is enabled

- All scroll-triggered animations are skipped — elements appear at their final position
- Hero entrance cascade is skipped — all elements visible immediately
- Counter values show the final number without counting up
- Modal exit animations are skipped — instant unmount
- Profile tab transitions have no animation (`animation: none`)
- Custom cursor is hidden
- `SplitText` words appear at their final position without sliding in
