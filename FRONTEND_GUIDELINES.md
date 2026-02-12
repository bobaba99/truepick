# Frontend Guidelines

## 1. Project Structure

```
src/
├── api/               # Supabase client, service modules, shared types
│   ├── supabaseClient.ts
│   ├── types.ts
│   ├── swipeService.ts
│   ├── verdictService.ts
│   ├── purchaseService.ts
│   ├── statsService.ts
│   ├── userProfileService.ts
│   ├── userValueService.ts
│   ├── embeddingService.ts
│   └── utils.ts
├── assets/            # Static assets (images, SVGs)
├── components/        # Reusable UI components (Kinematics, ListFilters, modals)
├── pages/             # Route-level page components (Dashboard, Swipe, Profile)
├── styles/            # Global CSS files
│   ├── index.css      # Reset, fonts, root variables (light-mode base)
│   └── App.css        # App-wide layout, component styles, dark glass theme
└── utils/             # Pure utility / helper functions (sanitizeHtml, text)
```

---

## 2. Naming Conventions

| Entity | Convention | Example |
|--------|-----------|---------|
| Components | PascalCase | `VerdictDetailModal.tsx` |
| Service modules | camelCase | `verdictService.ts`, `swipeService.ts` |
| Utilities | camelCase | `sanitizeHtml.ts` |
| Constants | UPPER_SNAKE_CASE | `PURCHASE_CATEGORIES`, `USER_VALUE_DESCRIPTIONS` |
| CSS / Style files | Flat in `styles/` | `App.css`, `index.css` |
| CSS classes | kebab-case | `.auth-card`, `.swipe-container`, `.verdict-card` |
| CSS custom properties | `--kebab-case` | `--ink-900`, `--glass-border`, `--surface-padding` |
| Type aliases | PascalCase | `SwipeOutcome`, `VerdictRow`, `PurchaseInput` |

---

## 3. Component Guidelines

### 3.1 Component Design Principles
- Functional components with hooks only (no class components).
- Keep components small and single-responsibility.
- Page components (`pages/`) own data fetching and pass data down as props.
- Reusable interaction primitives live in `components/Kinematics.tsx` (`LiquidButton`, `VolumetricInput`, `GlassCard`, `CustomCursor`, `SplitText`).

### 3.2 Props
- Define explicit TypeScript types for all props (inline type literals are acceptable for page-level components).
- Use destructuring with default values.
- `session: Session` is threaded from `App` to page components; avoid deeper prop drilling.

### 3.3 State Management
- **React built-ins only** — `useState`, `useEffect`, `useMemo`. No external state library.
- Supabase is the remote source of truth; local state holds UI concerns (loading flags, form values, auth mode).
- Auth state is managed via `supabase.auth.onAuthStateChange` in `App.tsx` and passed to routes via props.

---

## 4. Styling Guidelines

### 4.1 Approach
- **Plain CSS** in two global files (`index.css` and `App.css`). No CSS Modules, Tailwind, or CSS-in-JS.
- **Glassmorphism** is the primary visual language: translucent backgrounds, `backdrop-filter: blur()`, subtle borders, and layered box shadows.
- Reusable visual patterns are encoded as CSS classes (`.glass-shimmer`, `.liquid-button`, `.volumetric-input`) paired with JS-driven mouse-tracking in `Kinematics.tsx`.

### 4.2 Theming & Design Tokens

**Color tokens** (defined in `:root` and overridden in `.page`):

| Token | Light base (`index.css`) | Dark override (`App.css .page`) | Usage |
|-------|-------------------------|--------------------------------|-------|
| `--ink-900` | `#0f172a` | `#ffffff` | Primary text |
| `--ink-800` | — | `#f8fafc` | Secondary text, headings |
| `--ink-700` | `#1f2937` | `#cbd5e1` | Labels, muted text |
| `--ink-600` | `#4b5563` | `#94a3b8` | Descriptions, metadata |
| `--ink-500` | `#6b7280` | `#64748b` | Hints, disabled text |
| `--glass-border` | — | `rgba(255,255,255,0.15)` | Card/surface borders |
| `--glass-bg` | — | `rgba(255,255,255,0.03)` | Card/surface backgrounds |
| `--glass-shadow` | — | complex multi-layer | Card depth & inset glow |

**Typography**:
- Body: `'Outfit', 'Figtree', sans-serif` — currently a fallback stack declared in `index.css` (not imported there).
- Brand / headings: `'DM Serif Display', serif` — used on `.brand`.
- Base `line-height: 1.6`, `font-weight: 400`.
- Fluid heading sizes via `clamp()` (e.g., `clamp(2.6rem, 3vw + 1.2rem, 3.6rem)`).

**Spacing**: No formal scale — values are ad hoc `rem`-based. Common recurring gaps: `0.5rem`, `0.75rem`, `1rem`, `1.5rem`, `2rem`.

**Border radius conventions**:
- Pills / chips / nav links: `999px`
- Cards / surfaces: `16px`–`28px`
- Inputs: `10px`–`12px`
- Modals: `24px`

### 4.3 Responsive Design

Desktop-first with two breakpoints:

| Breakpoint | Behavior |
|-----------|----------|
| `max-width: 900px` | Auth layout collapses to single column; dashboard grid stacks; page padding reduces |
| `max-width: 600px` | Topbar stacks vertically; swipe buttons go horizontal/full-width; card max-width constrained |

### 4.4 Animation & Motion
- **GSAP 3.12.5** loaded via CDN at runtime (`Kinematics.tsx`). Provides:
  - `CustomCursor` — dot + trailing ring with `mix-blend-mode: difference`
  - `LiquidButton` — scale spring on press, radial glow on hover, ripple on click
  - `VolumetricInput` — proximity glow that tracks cursor distance within 150px
  - `GlassCard` — radial shimmer following mouse position via CSS custom properties
  - `SplitText` — scroll-triggered per-word reveal animation
  - `MagneticButton` — subtly attracted toward cursor via `gsap.quickTo`
- CSS `transition` on most interactive elements (hover lift, color shifts, box-shadow).
- CSS `@keyframes` for swipe card exit (`swipeFadeOut`), toast entrance (`slideIn`), modal entrance (`slideUp`, `fadeIn`).

### 4.5 Accessibility (a11y)
- Semantic HTML: `<nav>`, `<main>`, `<section>`, `<form>`, `<label>`.
- Keyboard navigability: focusable verdict cards with `tabIndex` and `onKeyDown`.
- Focus outlines: `2px solid rgba(59, 130, 246, 0.45)` on inputs; `outline-offset: 2px` on toggle controls.
- `aria-*` attributes where semantic HTML alone is insufficient.
- `:disabled` styles and `cursor: not-allowed` on all interactive elements.

---

## 5. Routing

- **react-router-dom v7** with `<BrowserRouter>` wrapping the app.
- Route definitions are declared in `App.tsx` via `<Routes>` / `<Route>`.
- Auth guard: `<RequireAuth>` component redirects to `/auth` when `session` is null.
- `<PublicOnly>` wrapper for the auth page.
- Authenticated routes nest inside `<AppShell>` (provides the glassmorphic route surface).
- Active nav links styled via `<NavLink>` with the `.active` class.
- No lazy loading configured yet.

---

## 6. API Integration

### 6.1 HTTP Client
- **Supabase JS client** (`@supabase/supabase-js`) for all auth, database, and RPC calls. Initialized in `api/supabaseClient.ts`.
- **Native `fetch`** for OpenAI API calls (Chat Completions and Embeddings) in `verdictService.ts` and `embeddingService.ts`.
- No Axios, tRPC, or wrapper library.

### 6.2 Error Handling
- Service functions return `{ error: string | null }` or throw on failure.
- UI surfaces errors via inline `.status` banners (`error` / `success` / `info` variants).
- `console.error` / `console.warn` for non-user-facing failures.
- Fallback evaluation logic when OpenAI API is unavailable or fails.

### 6.3 Loading States
- Boolean `loading` flags in component state.
- Buttons show "Working..." text and become `:disabled` during async operations.
- No skeleton screens or Suspense boundaries yet.

---

## 7. Testing Strategy

Not yet configured. Recommended setup:

| Level | Tool | Scope |
|-------|------|-------|
| Unit | Vitest | Service functions, utility helpers, scoring logic |
| Component | Vitest + React Testing Library | Isolated component rendering and interaction |
| Integration | Vitest + React Testing Library | Multi-component flows (auth, swipe, verdict) |
| E2E | Playwright | Full user flows against local Supabase |

---

## 8. Performance Guidelines
- GSAP loaded asynchronously via CDN — does not block initial render.
- `useMemo` for derived values (e.g., headline text based on auth state).
- No route-level code splitting yet — consider `React.lazy` for `Dashboard`, `Swipe`, `Profile` pages.
- Monitor bundle size; Vite's tree-shaking handles unused Supabase modules.

---

## 9. Code Quality & Linting

- **ESLint 9** with flat config (`eslint.config.js`):
  - `@eslint/js` recommended rules
  - `typescript-eslint` recommended rules
  - `eslint-plugin-react-hooks` (flat recommended)
  - `eslint-plugin-react-refresh` (Vite config)
- **Prettier**: not yet configured (recommended).
- **Pre-commit hooks**: not yet configured (Husky + lint-staged recommended).

---

## 10. Git & PR Conventions

### 10.1 Branch Naming
- Use short, descriptive, kebab-case names.
- Prefix by intent:
  - `feat/<scope>-<change>` (new UI/behavior)
  - `fix/<scope>-<bug>` (bug fix)
  - `refactor/<scope>-<change>` (no behavior change)
  - `docs/<scope>-<change>` (documentation only)
- Examples: `feat/web-swipe-filters`, `fix/profile-form-validation`, `docs/frontend-guidelines`.

### 10.2 Commit Messages
- Follow Conventional Commits:
  - `feat(web): add swipe queue progress indicator`
  - `fix(web): prevent duplicate verdict submission`
  - `docs(frontend): clarify typography fallback stack`
- Keep commits scoped to one concern (UI styling, routing, API wiring, or docs).
- Message should explain why the change exists, not only what changed.

### 10.3 Pull Request Scope
- Prefer small PRs (< 400 changed lines when possible).
- One user-facing change per PR unless changes are tightly coupled.
- If UI and behavior both change, describe each impact explicitly in PR summary.

### 10.4 PR Checklist
- [ ] `npm --workspace apps/web run lint` passes.
- [ ] Manual smoke test completed for affected routes (`/auth`, `/`, `/swipe`, `/profile`).
- [ ] Styling still follows existing glassmorphism patterns and token usage.
- [ ] No hardcoded secrets, keys, or environment values.
- [ ] Documentation updated when conventions, routes, or UX behavior changed.

### 10.5 Review Expectations
- Include before/after screenshots or short recordings for visible UI changes.
- Call out risk areas (auth flow, verdict scoring, swipe queue state, form validation).
- Add rollback notes for risky changes (what to revert if behavior regresses).

### 10.6 Merge Policy
- Require at least one review before merging.
- Do not merge with unresolved HIGH/CRITICAL findings from code review.
- Rebase or merge main before final merge if branch is stale.

---

## 11. Component Reference

### 11.1 Kinematics Components (`components/Kinematics.tsx`)

#### LiquidButton
Interactive button with scale spring, radial glow, and ripple effect.

```tsx
import { LiquidButton } from '../components/Kinematics'

// Primary action button
<LiquidButton className="primary" onClick={handleSubmit}>
  Submit Decision
</LiquidButton>

// Ghost/secondary button
<LiquidButton className="ghost" onClick={handleCancel}>
  Cancel
</LiquidButton>

// As a link (polymorphic)
<LiquidButton as={Link} to="/profile" className="primary">
  View Profile
</LiquidButton>
```

| Prop | Type | Description |
|------|------|-------------|
| `as` | `ElementType` | Render as different element (default: `button`) |
| `className` | `string` | CSS classes (`primary`, `ghost`, `link`, `danger`) |
| `children` | `ReactNode` | Button content |

**Used in:** Dashboard, Profile, Swipe, EmailSync, AdminResources
**CSS Classes:** `.liquid-button`, `.primary`, `.ghost`, `.link`

---

#### GlassCard
Container with mouse-tracking shimmer effect.

```tsx
import { GlassCard } from '../components/Kinematics'

<GlassCard className="verdict-result">
  <h2>Latest Verdicts</h2>
  {/* Content */}
</GlassCard>
```

| Prop | Type | Description |
|------|------|-------------|
| `className` | `string` | Additional CSS classes |
| `children` | `ReactNode` | Card content |

**Used in:** All page components
**CSS Classes:** `.glass-shimmer`
**Appearance:** Dark translucent card with radial gradient that follows cursor

---

#### VolumetricInput
Input field with proximity-based glow effect.

```tsx
import { VolumetricInput } from '../components/Kinematics'

<VolumetricInput
  type="text"
  placeholder="Enter purchase title"
  value={title}
  onChange={(e) => setTitle(e.target.value)}
/>

// As textarea (polymorphic)
<VolumetricInput
  as="textarea"
  rows={4}
  placeholder="Why do you want this?"
  value={justification}
  onChange={(e) => setJustification(e.target.value)}
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `as` | `ElementType` | Render as different element (default: `input`) |
| `className` | `string` | Additional CSS classes |

**Used in:** Dashboard (decision form), Profile (edit modals), AdminResources
**CSS Classes:** `.volumetric-input`
**Appearance:** Input with blue glow that intensifies as cursor approaches (within 150px)

---

#### SplitText
Animated text with per-word reveal on scroll.

```tsx
import { SplitText } from '../components/Kinematics'

<SplitText className="hero-heading">
  Make better purchase decisions
</SplitText>
```

**Used in:** Dashboard (headline)
**Appearance:** Words fade in with staggered Y rotation animation

---

#### CustomCursor
Global custom cursor with dot and trailing ring.

```tsx
import { CustomCursor } from '../components/Kinematics'

// Usually placed once in App.tsx
<CustomCursor />
```

**CSS Classes:** `.cursor-dot`, `.cursor-ring`
**Appearance:** White dot (8px) with trailing ring (32px), `mix-blend-mode: difference`

---

### 11.2 ListFilters (`components/ListFilters.tsx`)

Multi-input filter panel for verdicts and purchases.

```tsx
import ListFilters, { FilterState } from '../components/ListFilters'

const [filters, setFilters] = useState<FilterState>({
  category: '',
  vendor: '',
  priceMin: '',
  priceMax: '',
  date: '',
  recommendation: '',
  decision: '',
  source: '',
})

<ListFilters
  search={search}
  onSearchChange={setSearch}
  filters={filters}
  onFilterChange={setFilters}
  type="verdict"  // or "purchase"
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `search` | `string` | Current search term |
| `onSearchChange` | `(value: string) => void` | Search change handler |
| `filters` | `FilterState` | Current filter values |
| `onFilterChange` | `(filters: FilterState) => void` | Filter change handler |
| `type` | `'verdict' \| 'purchase'` | Mode (affects which filters show) |

**Used in:** Profile (verdict/purchase history sections)
**CSS Classes:** `.list-filters`, `.filter-grid`, `.filter-group`, `.filter-search`
**Appearance:** Collapsible panel with search bar and filter dropdowns

---

### 11.3 VerdictDetailModal (`components/VerdictDetailModal.tsx`)

Modal displaying detailed verdict analysis and AI reasoning.

```tsx
import VerdictDetailModal from '../components/VerdictDetailModal'

<VerdictDetailModal
  verdict={selectedVerdict}
  isOpen={modalOpen}
  onClose={() => setModalOpen(false)}
  onRegenerate={handleRegenerate}
  isRegenerating={regenerating}
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `verdict` | `VerdictRow` | Verdict data to display |
| `isOpen` | `boolean` | Modal visibility |
| `onClose` | `() => void` | Close handler |
| `onRegenerate` | `(verdict: VerdictRow) => void` | Optional regenerate handler |
| `isRegenerating` | `boolean` | Loading state for regenerate |

**Used in:** Dashboard, Profile
**CSS Classes:** `.modal-backdrop`, `.modal-content`, `.analysis-card`, `.outcome-badge`
**Appearance:** Centered modal with blur backdrop, showing verdict metadata, AI scores, and rationale

---

### 11.4 EmailIcons (`components/EmailIcons.tsx`)

SVG icon components for email providers.

```tsx
import { GmailLogo, OutlookLogo } from '../components/EmailIcons'

<GmailLogo className="provider-logo" />
<OutlookLogo className="button-icon" />
```

**Used in:** EmailSync, Profile (import modal)
**Appearance:** 24x24 colored SVG logos

---

## 12. Page Reference

### 12.1 Dashboard (`pages/Dashboard.tsx`)

**Route:** `/` (authenticated)
**Purpose:** Main evaluation interface for new purchase decisions

**Key Sections:**
1. Stats bar (swipes completed, regret rate, active holds)
2. Decision form (title, vendor, price, category, justification, importance)
3. Latest verdicts (3 most recent)

```
┌─────────────────────────────────────────────────────────┐
│  Stats: [Swipes: 24] [Regret: 12%] [Holds: 3]           │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐       │
│  │ New Decision        │  │ Latest Verdicts     │       │
│  │ [Title input]       │  │ ┌─────────────────┐ │       │
│  │ [Vendor] [Price]    │  │ │ Verdict Card 1  │ │       │
│  │ [Category dropdown] │  │ └─────────────────┘ │       │
│  │ [Justification]     │  │ ┌─────────────────┐ │       │
│  │ [☐ Important]       │  │ │ Verdict Card 2  │ │       │
│  │ [Evaluate Button]   │  │ └─────────────────┘ │       │
│  └─────────────────────┘  └─────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

**CSS Classes Used:**
- `.route-content` - Main wrapper
- `.stat-grid`, `.stat-card` - Stats display
- `.dashboard-grid` - Two-column layout
- `.decision-section`, `.decision-form` - Form container
- `.verdict-result`, `.verdict-list` - Verdicts container
- `.verdict-card.outcome-{buy|hold|skip}` - Color-coded cards

---

### 12.2 Swipe (`pages/Swipe.tsx`)

**Route:** `/swipe` (authenticated)
**Purpose:** Card-based UI for rating past purchases

**Key Features:**
- Swipe cards left (regret), right (satisfied), down (unsure)
- Keyboard shortcuts: arrow keys, Ctrl/Cmd+Z for undo
- Progress bar showing completion
- Timing filters (immediate, 3 days, 3 weeks, 3 months)

```
┌─────────────────────────────────────────────────────────┐
│  Progress: ████████░░ 80%                               │
│  Filters: [All] [Immediate] [3 Days] [3 Weeks]          │
├─────────────────────────────────────────────────────────┤
│           ┌───────────────────────┐                     │
│           │    Current Card       │                     │
│           │   "iPhone Case"       │                     │
│           │   $29.99 • Amazon     │                     │
│           └───────────────────────┘                     │
│                                                         │
│  [← Regret]    [↓ Unsure]    [Satisfied →]              │
├─────────────────────────────────────────────────────────┤
│  Upcoming (3 items)                                     │
│  [Card] [Card] [Card]                                   │
└─────────────────────────────────────────────────────────┘
```

**CSS Classes Used:**
- `.swipe-progress-container`, `.swipe-progress-bar` - Progress indicator
- `.swipe-filter`, `.filter-chip.active` - Timing filters
- `.swipe-container` - Main swipe area
- `.swipe-card`, `.swiping-{left|right|unsure}` - Animated card
- `.swipe-button.{regret|satisfied|unsure}` - Action buttons
- `.upcoming-section`, `.upcoming-card` - Upcoming queue

---

### 12.3 Profile (`pages/Profile.tsx`)

**Route:** `/profile` (authenticated)
**Purpose:** User profile, settings, and history

**Key Sections:**
1. Profile summary (email, budget)
2. Decision profile (quiz answers)
3. Verdict history with filters
4. Purchase history with filters

```
┌─────────────────────────────────────────────────────────┐
│  Profile: user@email.com                                │
│  Weekly Budget: $150                                    │
├─────────────────────────────────────────────────────────┤
│  Decision Profile                      [Edit]           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │Core Vals│ │Regret   │ │Satisfy  │ │Decision │        │
│  │Quality  │ │Buyer's  │ │Function │ │Deliberat│        │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
├─────────────────────────────────────────────────────────┤
│  Verdict History              Purchase History          │
│  [Filters...]                 [Filters...]              │
│  [Verdict List]               [Purchase List]           │
└─────────────────────────────────────────────────────────┘
```

**CSS Classes Used:**
- `.profile-grid` - Layout container
- `.values-section`, `.section-header` - Section wrappers
- `.profile-answer-grid`, `.profile-answer` - Quiz display
- `.dashboard-grid` - Two-column history layout
- `.collapsible` - Expandable filter panel
- `.modal-backdrop`, `.modal-content` - Edit modals

---

### 12.4 EmailSync (`pages/EmailSync.tsx`)

**Route:** `/email-sync`
**Purpose:** Connect Gmail and import receipts

**Key Features:**
- OAuth connection flow
- Import receipts with AI parsing
- View import results
- Download debug log

```
┌─────────────────────────────────────────────────────────┐
│  Connect Email                │  How It Works           │
│  ┌──────────────────────────┐ │  1. OAuth prompt        │
│  │ [Gmail Logo] Connected   │ │  2. Permission grant    │
│  │ [Import] [Disconnect]    │ │  3. Receipt scan        │
│  └──────────────────────────┘ │  4. AI extraction       │
│                               │  5. Deduplication       │
│  5 receipts imported          │                         │
│  Last sync: Jan 15, 2024      │  What we scan:          │
│                               │  - Order confirmations  │
│  Import Results               │  - Receipt emails       │
│  ┌──────────────────────────┐ │                         │
│  │ iPhone Case - $29.99     │ │  What we never read:    │
│  │ Netflix - $15.99         │ │  - Personal messages    │
│  └──────────────────────────┘ │  - Attachments          │
│  [Download Import Log]        │                         │
└─────────────────────────────────────────────────────────┘
```

**CSS Classes Used:**
- `.email-sync-container` - Main card
- `.content-panel` - Left/right panels
- `.email-providers` - Provider buttons
- `.connected-status`, `.provider-info` - Connection display
- `.import-result`, `.imported-list` - Results display

---

### 12.5 Resources (`pages/Resources.tsx`)

**Route:** `/resources` (public)
**Purpose:** Educational articles list

**CSS Classes Used:**
- `.verdict-list`, `.verdict-card` - Article cards
- `.verdict-card-content` - Card content
- `.verdict-meta` - Metadata (date, reading time)

---

### 12.6 ResourceDetail (`pages/ResourceDetail.tsx`)

**Route:** `/resources/:slug` (public)
**Purpose:** Individual article view

**CSS Classes Used:**
- `.resource-detail` - Container (max-width: 800px)
- `.breadcrumb` - Navigation path
- `.article-header`, `.article-meta` - Header section
- `.article-tags`, `.tag-pill` - Tag display
- `.article-body` - Formatted HTML content
- `.floating-buttons` - Back/scroll buttons (portal)

---

### 12.7 AdminResources (`pages/AdminResources.tsx`)

**Route:** `/admin/resources` (admin only)
**Purpose:** CRUD editor for resources

**Key Features:**
- Rich text editor (Quill)
- Image upload to Supabase
- Tag management with recommendations
- Auto-slug generation

**CSS Classes Used:**
- `.dashboard-grid` - Two-column layout
- `.verdict-list` - Article list sidebar
- `.decision-form` - Editor form
- `.tags-container`, `.tag-pill` - Tag input
- `.admin-editor-shell` - Quill container

---

## 13. CSS Class Reference

### 13.1 Layout Classes

| Class | Description | Used In |
|-------|-------------|---------|
| `.page` | Root container with gradient background | App.tsx |
| `.topbar` | Header navigation bar | App.tsx |
| `.route-content` | Main section wrapper | All pages |
| `.route-surface` | Glassmorphic content surface | AppShell |
| `.dashboard-grid` | Two-column responsive grid | Dashboard, Profile, Admin |
| `.content-panel` | Panel within dashboard grid | EmailSync |

### 13.2 Card Classes

| Class | Description | Appearance |
|-------|-------------|------------|
| `.glass-shimmer` | Mouse-tracking shimmer | Dark translucent with radial gradient |
| `.verdict-card` | Generic card for items | Rounded, bordered, hover lift |
| `.verdict-card.outcome-buy` | Buy recommendation | Green accent |
| `.verdict-card.outcome-hold` | Hold recommendation | Yellow accent |
| `.verdict-card.outcome-skip` | Skip recommendation | Red accent |
| `.swipe-card` | Swipeable purchase card | Animated, directional shadows |
| `.stat-card` | Small stat display | Compact, no background |
| `.empty-card` | Empty state | Dashed border, muted text |

### 13.3 Button Classes

| Class | Description | Appearance |
|-------|-------------|------------|
| `.liquid-button` | Base animated button | Radial gradient, ripple effect |
| `.primary` | Primary action | White background, dark text |
| `.ghost` | Secondary action | Transparent, border, hover fill |
| `.link` | Text link style | Transparent, underline |
| `.link.danger` | Destructive link | Red text |
| `.decision-btn` | Verdict action button | Colored by outcome |
| `.swipe-button` | Large swipe action | Circular, colored variants |

### 13.4 Form Classes

| Class | Description |
|-------|-------------|
| `.volumetric-input` | Proximity-glow input |
| `.profile-form` | Grid form layout |
| `.decision-form` | Decision input form |
| `.form-group` | Form field wrapper |
| `.form-row` | Two-column form row |
| `.required` | Red asterisk indicator |
| `.textarea-wrapper` | Textarea container |

### 13.5 Filter Classes

| Class | Description |
|-------|-------------|
| `.list-filters` | Filter panel container |
| `.filter-grid` | Multi-column filter layout |
| `.filter-group` | Individual filter wrapper |
| `.filter-search` | Search input field |
| `.filter-chip` | Toggle button (timing filters) |
| `.filter-chip.active` | Selected filter |
| `.collapsible` | Animated expand/collapse |

### 13.6 Modal Classes

| Class | Description |
|-------|-------------|
| `.modal-backdrop` | Fixed overlay with blur |
| `.modal-content` | Modal container |
| `.modal-header` | Title and actions |
| `.modal-body` | Scrollable content |
| `.modal-close` | Close button (X) |
| `.modal-actions` | Header button group |

### 13.7 Status Classes

| Class | Description | Appearance |
|-------|-------------|------------|
| `.status` | Status message container | Rounded box |
| `.status.success` | Success message | Green background |
| `.status.error` | Error message | Red background |
| `.status.info` | Info message | Blue background |

### 13.8 Animation Keyframes

| Name | Duration | Effect |
|------|----------|--------|
| `swipeFadeOut` | 2s | Card exit (opacity fade) |
| `slideIn` | 0.2s | Toast entrance (translateY + fade) |
| `fadeIn` | 0.2s | Modal backdrop (opacity) |
| `slideUp` | 0.25s | Modal content (translateY + fade) |

---

## 14. Quick Start Examples

### Adding a New Card Section

```tsx
// pages/MyPage.tsx
import { GlassCard, LiquidButton } from '../components/Kinematics'

export default function MyPage() {
  return (
    <section className="route-content">
      <div className="section-header">
        <h1>My Page</h1>
      </div>

      <GlassCard className="dashboard-grid">
        <div className="content-panel">
          <h2>Section Title</h2>
          <p>Section content goes here.</p>
          <LiquidButton className="primary">
            Action
          </LiquidButton>
        </div>
      </GlassCard>
    </section>
  )
}
```

### Adding a Form with Validation

```tsx
import { useState } from 'react'
import { GlassCard, LiquidButton, VolumetricInput } from '../components/Kinematics'

function MyForm() {
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<{ type: string; message: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setStatus({ type: 'error', message: 'Title is required' })
      return
    }
    setLoading(true)
    // ... submit logic
    setLoading(false)
    setStatus({ type: 'success', message: 'Saved!' })
  }

  return (
    <GlassCard className="decision-section">
      <form className="decision-form" onSubmit={handleSubmit}>
        {status && (
          <div className={`status ${status.type}`}>{status.message}</div>
        )}

        <div className="form-group">
          <label className="label-text">
            Title <span className="required">*</span>
          </label>
          <VolumetricInput
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter title"
          />
        </div>

        <LiquidButton className="primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </LiquidButton>
      </form>
    </GlassCard>
  )
}
```

### Adding a Modal

```tsx
import { useState } from 'react'
import { LiquidButton } from '../components/Kinematics'

function MyModal({ isOpen, onClose, children }) {
  if (!isOpen) return null

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Modal Title</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  )
}
```

### Adding Filterable List

```tsx
import { useState, useMemo } from 'react'
import ListFilters, { FilterState, filterItems } from '../components/ListFilters'
import { GlassCard } from '../components/Kinematics'

function FilteredList({ items }) {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterState>({
    category: '',
    vendor: '',
    priceMin: '',
    priceMax: '',
    date: '',
    recommendation: '',
    decision: '',
    source: '',
  })

  const filtered = useMemo(() =>
    filterItems(items, search, filters),
    [items, search, filters]
  )

  return (
    <GlassCard>
      <div className="collapsible open">
        <ListFilters
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFilterChange={setFilters}
          type="purchase"
        />
      </div>

      <div className="verdict-list">
        {filtered.map(item => (
          <div key={item.id} className="verdict-card">
            {item.title}
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
```
