# Code Review — Stage 1: Architecture, Structure and Maintainability

**Application:** Three Headlines and a Lie (3H1L)
**Scope:** `web/` directory and its supporting configuration
**Date:** 2026-11-20
**Status:** Read-only review — no files were modified at time of original review
**Last updated:** 2026-11-20 — Findings 8 and 9 marked as addressed following post-review changes

---

## Architecture Overview

The application is a Next.js 16 static-export SPA with a single page (`/`) mounted at `src/app/page.tsx`, which renders a single `<Game>` component. All game state and navigation live inside that component. Supporting logic is separated into a small `src/lib/` layer.

```
web/
├── src/
│   ├── app/
│   │   ├── layout.tsx          — Root layout: fonts, metadata, body wrapper
│   │   ├── page.tsx            — Entry point; renders <Game />
│   │   └── globals.css         — Tailwind import + two custom utilities
│   ├── components/
│   │   ├── Game.tsx            — All game state, all screen rendering (~1 265 lines)
│   │   └── CommunityLeaderboard.tsx — Presentation-only leaderboard table
│   ├── data/
│   │   └── model_results.json  — Bundled ML benchmark scores
│   └── lib/
│       ├── game.ts             — Types, validation, shuffle, scoring helpers
│       ├── scoring.ts          — Supabase submit/fetch wrappers + display-name validation
│       ├── supabase.ts         — Nullable Supabase client singleton
│       └── __tests__/
│           ├── game.test.ts
│           └── scoring.test.ts
├── public/
│   └── data/
│       └── app_quizzes.json    — Quiz data fetched at runtime
├── next.config.ts              — output: 'export', Turbopack CSS rule
├── eslint.config.mjs
├── tsconfig.json
└── package.json
```

**Screen flow managed inside `Game.tsx`:**

```
start → playing → submit → results
                            ↘ leaderboard
  showModels (overlay, orthogonal to screen state)
```

The `Game` component manages five conceptually distinct responsibilities entirely within a single file: data loading, game state, animation/transition logic, Supabase submission flow, and all screen rendering. `CommunityLeaderboard` is a pure presentational component; `lib/game.ts` and `lib/scoring.ts` provide well-isolated logic.

---

## Findings

### Finding 1 — `Game.tsx` is too large for a single component

| Attribute | Detail |
|-----------|--------|
| **Severity** | Medium |
| **Files** | `src/components/Game.tsx` (1 265 lines) |
| **Category** | Maintainability / Separation of concerns |

`Game.tsx` is a single React component that simultaneously owns: quiz data loading, the `screen` state machine, the in-question answer flow, two separate Supabase async flows (submit + leaderboard), four distinct screen renders, the `showModels` overlay render, all transition animation logic (seven `useRef` timers/RAFs), and the `MODEL_EXPLANATIONS` content array.

This is the most significant structural issue in the codebase. The file is not unreadable, but it is at the boundary where any further feature work — or debugging a specific screen — requires scrolling past a large amount of unrelated code. The animation machinery alone spans ~100 lines and is interspersed with other logic.

**What it isn't:** this is not over-engineering; each piece of logic is real and genuinely complex. The issue is co-location, not unnecessary complexity.

**Recommended action:** Extract the animation/transition machinery into a custom hook (e.g. `useScreenTransition`) and extract each screen's JSX into its own component file (e.g. `StartScreen`, `PlayingScreen`, `SubmitScreen`, `ResultsScreen`, `ModelsScreen`). The `MODEL_EXPLANATIONS` array and its rendering belong in a dedicated `ModelsScreen` component or a co-located data file. The Supabase-fetch effects could be moved into a custom hook to remove them from the render tree.

This is a meaningful improvement but not urgent — the application is feature-complete and the existing code is correct. It becomes more important if the codebase is used as a portfolio reference or maintained over time.

---

### Finding 2 — `showModels` is orthogonal to the `screen` state machine

| Attribute | Detail |
|-----------|--------|
| **Severity** | Low |
| **Files** | `src/components/Game.tsx` (lines 125–132, 555–608) |
| **Category** | Architecture / State management |

The application has a `screen` state with values `"start" | "playing" | "submit" | "results" | "leaderboard"`, but the "What are these models?" view is rendered via a separate `showModels: boolean` flag checked before the screen dispatches. This means the models view is effectively a sixth screen that bypasses the screen state machine. The two mechanisms interact correctly (both use `navigateWithTransition`), but navigating back from the models view always returns to the results screen regardless of how the user arrived there.

**Recommended action:** Absorb `showModels` into the `screen` union as a `"models"` state, or at minimum maintain a `previousScreen` ref to restore context-aware back-navigation. For a completed portfolio application this is a low-priority cosmetic inconsistency.

---

### Finding 3 — `fetchLeaderboard` has an unnecessary overloaded signature

| Attribute | Detail |
|-----------|--------|
| **Severity** | Low |
| **Files** | `src/lib/scoring.ts` (lines 138–155) |
| **Category** | TypeScript / API design |

`fetchLeaderboard` accepts either `(pageNumber?: number, pageSize?: number)` or `({ pageNumber, pageSize })` via a union-typed first argument. Only the object form is used in `Game.tsx`; the positional form is only exercised in tests. This dual API doubles the branching in the implementation and increases the test surface without providing practical benefit.

**Recommended action:** Simplify to the object signature only: `fetchLeaderboard(params?: FetchLeaderboardParams)`. Update the two tests that use positional arguments. This is a minor code-quality improvement.

---

### Finding 4 — Leaderboard page cache discards previous pages on navigation

| Attribute | Detail |
|-----------|--------|
| **Severity** | Low |
| **Files** | `src/components/Game.tsx` (lines 336–391, 150–157) |
| **Category** | State management |

`leaderboardFetchedPagesRef` tracks which page numbers have been fetched, but `leaderboardEntries` is replaced (not accumulated) on each fetch. When the user moves from page 2 back to page 1, the effect correctly skips the fetch (page 1 is in the set), but the display shows page 2's entries until the state updates. In practice, since the page-1 fetch was already completed, the stale display is very brief — but only because the initial load populates entries immediately. If a user navigates away and returns, the cache is reset and re-fetched correctly.

This is a minor UX inconsistency rather than a correctness bug.

**Recommended action:** No action required for the current scope. If leaderboard UX is revisited, accumulate all fetched entries in a `Map<number, LeaderboardEntry[]>` and derive the displayed slice from `page`.

---

### Finding 5 — `BENCHMARK_RESULTS` type assertion on JSON import

| Attribute | Detail |
|-----------|--------|
| **Severity** | Low |
| **Files** | `src/components/Game.tsx` (line 30) |
| **Category** | TypeScript |

```ts
const BENCHMARK_RESULTS = modelResults as Record<string, number>;
```

`model_results.json` is imported and immediately cast. TypeScript infers a narrow literal type from the JSON (`{ "Random baseline": 0.2455, ... }`), and the cast widens it to `Record<string, number>`. This is safe because the JSON is a tracked file and the shape is known, and the cast is documented inline. However, the cast means TypeScript will not catch a future edit that accidentally sets a value to a string or introduces a non-numeric field.

**Recommended action:** An alternative is to omit the cast and use `Object.values(modelResults)` directly — TypeScript already knows the values are `number` from the inferred literal type. For `calculateRank`, passing `modelResults` directly (without widening) also works. This is optional; the current approach is not incorrect.

---

### Finding 6 — `inert` prop not typed in React 19 / TypeScript

| Attribute | Detail |
|-----------|--------|
| **Severity** | Low |
| **Files** | `src/components/Game.tsx` (line 1189) |
| **Category** | TypeScript |

```tsx
<p inert={!isAnswered} ...>
```

The `inert` attribute is a valid HTML attribute now supported in modern browsers, and React 19 adds native support for it. However, `inert={false}` (the case when the answer is revealed) is equivalent to omitting the attribute — the DOM spec treats the absence of `inert` as "not inert", so passing `false` is redundant but harmless. With React 19 the type signature accepts `boolean | undefined`, so this compiles correctly.

This is an observation, not a defect. No action required.

---

### Finding 7 — `advanceToNextQuestion` duplicates `prefers-reduced-motion` logic from `navigateWithTransition`

| Attribute | Detail |
|-----------|--------|
| **Severity** | Low |
| **Files** | `src/components/Game.tsx` (lines 228–269, 436–471) |
| **Category** | Maintainability / Duplication |

Both `navigateWithTransition` and `advanceToNextQuestion` read `window.matchMedia("(prefers-reduced-motion: reduce)")` independently. The two functions use different animation mechanisms (full-screen fade vs. question-level fade with height transition), so full unification is not straightforward, but the media query check itself is duplicated.

**Recommended action:** Extract `const prefersReducedMotion = ...` as a module-level or hook-level function, or read it once at the top of `navigateWithTransition`/`advanceToNextQuestion` from a shared helper. This is minor.

---

### Finding 8 — Hardcoded magic numbers in `submitAttempt` validation ✓ Addressed

| Attribute | Detail |
|-----------|--------|
| **Severity** | Low |
| **Files** | `src/lib/scoring.ts` (lines 62–63), `src/lib/game.ts` |
| **Category** | Maintainability |
| **Status** | **Addressed — 2026-11-20** |

```ts
questionsAnswered < 10 ||
questionsAnswered > 67 ||
```

The values `10` and `67` are significant game constants (minimum questions and total quiz count) but are hard-coded in `scoring.ts` rather than imported from `lib/game.ts` where `MIN_QUESTIONS = 10` already lives. `67` is not defined as a named constant anywhere.

**Recommended action:** Export a `TOTAL_QUIZZES = 67` constant from `lib/game.ts` and import both `MIN_QUESTIONS` and `TOTAL_QUIZZES` in `scoring.ts`. This makes the relationship between the validation bounds and the actual dataset size explicit and keeps constants in one place.

**Resolution:** `TOTAL_QUIZZES = 67` has been added and exported from `lib/game.ts` alongside the existing `MIN_QUESTIONS`. `scoring.ts` now imports both constants and uses them in the `submitAttempt` validation condition (`questionsAnswered < MIN_QUESTIONS || questionsAnswered > TOTAL_QUIZZES`). The magic literals have been removed. The change is consistent with the existing constant pattern and keeps all game-rule values in a single authoritative location. TypeScript check passed.

---

### Finding 9 — `LeaderboardStatus` type is defined in `CommunityLeaderboard.tsx` but conceptually belongs in `scoring.ts` ✓ Addressed

| Attribute | Detail |
|-----------|--------|
| **Severity** | Low |
| **Files** | `src/components/CommunityLeaderboard.tsx` (lines 11–17), `src/components/Game.tsx` (lines 154–156) |
| **Category** | Separation of concerns |
| **Status** | **Addressed — 2026-11-20** |

`LeaderboardStatus` is a UI state machine type, so its location in the presentation component is defensible. But `Game.tsx` duplicates the full union inline in its `useState` declaration rather than importing the exported type. The type is exported from `CommunityLeaderboard.tsx` but not imported in `Game.tsx`, meaning the two definitions must be kept in sync manually.

**Recommended action:** Import `LeaderboardStatus` from `CommunityLeaderboard.tsx` in `Game.tsx` instead of re-declaring it. One line change.

**Resolution:** `Game.tsx` now imports `LeaderboardStatus` directly from `CommunityLeaderboard.tsx` via the existing component import line (`import CommunityLeaderboard, { type LeaderboardStatus } from "./CommunityLeaderboard"`). The inline union declaration in the `useState` call has been removed and replaced with the imported type. The authoritative definition remains in `CommunityLeaderboard.tsx`, which is the correct location for a type that describes that component's status prop. TypeScript check passed.

---

### Finding 10 — No GitHub Actions CI workflow

| Attribute | Detail |
|-----------|--------|
| **Severity** | Low |
| **Files** | `.github/workflows/` (directory exists but is empty) |
| **Category** | Configuration / CI |

The `.github/workflows/` directory is present but empty. The project has Vitest unit tests, ESLint, TypeScript checking and a production build, all runnable via `package.json` scripts. These are not automatically run on push or pull request.

For a completed portfolio application this is a gap: a CI failure (e.g. a dependency update breaking the build) would only be noticed if manually run. The spec mentions GitHub Actions CI as "where practical".

**Recommended action:** Add a minimal workflow that runs `npm ci`, `npm run lint`, `npm run test`, and `npm run build` on push to main. This is straightforward and materially reduces the risk of an undetected regression.

---

### Finding 11 — `public/` contains default Next.js placeholder SVGs

| Attribute | Detail |
|-----------|--------|
| **Severity** | Observation |
| **Files** | `web/public/file.svg`, `web/public/globe.svg`, `web/public/next.svg`, `web/public/vercel.svg`, `web/public/window.svg` |
| **Category** | Project hygiene |

These are the placeholder assets generated by `create-next-app`. They are not referenced by any application code, but they are served as static files and included in the production `out/` build.

**Recommended action:** Delete the five unused SVGs. No functional impact either way, but keeping them in a portfolio codebase can give the impression of an incomplete cleanup.

---

### Finding 12 — `eslint-config-next` version pinned to `16.4.2` while Next.js allows `^16.4.6`

| Attribute | Detail |
|-----------|--------|
| **Severity** | Observation |
| **Files** | `web/package.json` |
| **Category** | Configuration |

```json
"next": "^16.4.6",
"eslint-config-next": "16.4.2"
```

`next` is a caret-ranged dependency (`^16.4.6`), but `eslint-config-next` is pinned to `16.4.2`. These are designed to be in sync. If `next` resolves to a newer patch, `eslint-config-next` will lag behind. This is unlikely to cause problems in practice (ESLint configs change rarely between patches) but is inconsistent.

**Recommended action:** Align `eslint-config-next` to match the `next` semver range (e.g. `^16.4.6` or simply `^16`).

---

## TypeScript Assessment

TypeScript is used consistently and correctly throughout the application:

- `strict: true` is enabled in `tsconfig.json`.
- `resolveJsonModule: true` enables the typed JSON import.
- All component props, function signatures, state types and return types are explicitly typed.
- No `any` types are used anywhere in source files.
- The one type assertion (`modelResults as Record<string, number>`, Finding 5) is intentional and safe.
- The `RawLeaderboardRow` interface is appropriately scoped locally inside `fetchLeaderboard` where it is only used.
- The `data as RawLeaderboardRow[]` cast in `scoring.ts` (line 173) is unavoidable given that Supabase's `.rpc()` return type is untyped `unknown`/`any` by default without schema generation. The cast is safe and the mapping immediately converts it to the typed `LeaderboardEntry[]`.
- The `LayoutProps<"/">` generic in `layout.tsx` (line 36) is a Next.js-generated type from `.next/types/`; this is idiomatic.

Overall: TypeScript usage is strong.

---

## React / Next.js Architecture Assessment

- **Static export:** `output: 'export'` is correctly configured. The application has no server-side data fetching, server components, or API routes that would be incompatible.
- **`"use client"` directive:** Correctly placed at the top of `Game.tsx`. `layout.tsx` and `page.tsx` are Server Components by default, which is correct.
- **Data fetching:** Quiz data is fetched from `public/data/app_quizzes.json` via `fetch()` on mount. This is the right approach for a static export; bundling the JSON would prevent runtime validation and would increase the initial JS bundle size.
- **Effects:** All `useEffect` calls have correct dependency arrays and cleanup via the `cancelled` flag pattern. The timer cleanup effect is thorough.
- **`useIsomorphicLayoutEffect`:** The local implementation is correct. Its use is justified — it reads DOM layout (offsetHeight) synchronously after a state-triggered render, which requires `useLayoutEffect`, but the SSR-safe fallback to `useEffect` is needed to avoid hydration warnings in the static export.
- **Ref usage:** The seven animation refs and the `isTransitioningRef` / `isSubmittingRef` pattern correctly distinguish "transient imperative state that should not trigger re-renders" from reactive state. This is appropriate.
- **`react-markdown`:** Used to render headline text inside buttons. The headlines appear to come from a trusted internal dataset, so XSS risk is low, and the custom `p` → `span` component override correctly prevents invalid nesting (`<p>` inside `<button>`).
- **State management approach:** No external state library (Redux, Zustand, etc.) is used. For this application's size and self-contained nature, `useState`/`useRef` is entirely appropriate.

---

## Configuration Assessment

| Item | Status |
|------|--------|
| `output: 'export'` | Correctly set |
| `turbopack` CSS rule for Tailwind 4 | Appropriate for Tailwind CSS v4 alpha with Turbopack |
| `strict: true` TypeScript | Enabled |
| `.env.example` present, `.env.local` gitignored | Correct |
| Supabase anon key only in client | Correct; service-role key is never referenced |
| `next-env.d.ts` and `tsconfig.tsbuildinfo` gitignored | Correct |
| `out/` gitignored | Correct |

The Tailwind 4 / Turbopack integration via `@tailwindcss/turbopack` is in `devDependencies`, which is correct. `tailwindcss` itself is also in `devDependencies`, correct for a Next.js build.

---

## Summary Table

| # | Finding | Severity | Type | Status |
|---|---------|----------|------|--------|
| 1 | `Game.tsx` size — all state, rendering and effects in one file | Medium | Genuine issue | Open |
| 2 | `showModels` bypasses the `screen` state machine | Low | Genuine issue | Open |
| 3 | `fetchLeaderboard` has an unnecessary dual overloaded signature | Low | Genuine issue | Open |
| 4 | Leaderboard page cache discards previous page on navigation | Low | Genuine issue | Open |
| 5 | `modelResults as Record<string, number>` type assertion | Low | Optional improvement | Open |
| 6 | `inert={false}` redundant but harmless | Low | Observation | Open |
| 7 | `prefers-reduced-motion` check duplicated across two functions | Low | Optional improvement | Open |
| 8 | Magic numbers `10` and `67` in `scoring.ts` | Low | Genuine issue | ✓ Addressed |
| 9 | `LeaderboardStatus` type re-declared inline rather than imported | Low | Genuine issue | ✓ Addressed |
| 10 | No GitHub Actions CI workflow | Low | Genuine issue | Open |
| 11 | Unused default Next.js placeholder SVGs in `public/` | Observation | Optional cleanup | Open |
| 12 | `eslint-config-next` version pinned out of step with `next` | Observation | Optional cleanup | Open |

---

## Overall Assessment

The architecture is **suitable for a completed portfolio application.** The separation of pure logic (`lib/game.ts`, `lib/scoring.ts`) from the Supabase integration (`lib/supabase.ts`) from rendering is sound. TypeScript is applied correctly throughout. The Supabase integration degrades gracefully when unconfigured, which is an important correctness property for a static export. Animation code is correct and accessibility-aware (reduced-motion support throughout). Test coverage targets the right things: pure functions and the Supabase integration layer.

The single meaningful structural concern is Finding 1: `Game.tsx` concentrates too much in one place. This is not a correctness problem and does not affect the user experience, but it is the most likely friction point if the codebase is revisited for further development or used as a portfolio reference.

No critical or high-severity issues were found. The application is well-built for its stated scope.
