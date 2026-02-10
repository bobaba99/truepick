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
