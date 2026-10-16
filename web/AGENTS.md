# Frontend Development Instructions

## Scope

This directory contains the Next.js frontend for Three Headlines and a Lie (3H1L).

Before substantive work, read the repository-root `AGENTS.md` and `docs/project_spec.md`. Follow their project-wide requirements and architectural decisions.

## Technical Conventions

- Use Next.js App Router, TypeScript and idiomatic React patterns.
- Use Tailwind CSS for styling unless the existing implementation provides a compelling reason otherwise.
- Keep components small and cohesive. Separate reusable UI components from game logic and data handling where this improves clarity.
- Use TypeScript types for quiz data, game state and model evaluation results. Avoid `any` unless there is a clear, justified need.
- Keep game logic independent of presentation where practical, so it can be tested without rendering the UI.
- Use the existing package manager and conventions established in this directory. Do not introduce another package manager.

## Application Architecture

- The application must work as a statically exported Next.js site hosted on Vercel.
- All runtime game functionality must execute in the browser. Do not introduce backend services, API routes, server-side inference or external API dependencies.
- Load quiz data from `public/data/quizzes.json`. Keep model evaluation results in a separate frontend-owned data file.
- Do not depend on the repository-root `data/` or `models/` directories at runtime.
- Preserve the original ordering of headline options. Shuffle quiz selection between games without replacement within each game.
- Keep fixed model evaluation results separate from player game state. Do not represent fixed evaluation results as live predictions.

## UI and Accessibility

- Aim for a polished, coherent, responsive interface rather than a generic dashboard.
- Provide clear visual feedback for selected answers, correct and incorrect responses, game progress and final results.
- Use smooth transitions where they improve the experience, without making the interface feel slow or obstructing interaction.
- Ensure interactive elements are keyboard-accessible, have appropriate accessible names and visible focus states, and maintain sufficient colour contrast.
- Respect reduced-motion preferences when implementing animations.
- Avoid unnecessary UI elements, dependencies and visual effects. Do not introduce a design system or component library without a clear benefit.

## Testing and Validation

- Add tests for game logic, especially quiz selection, answer handling, scoring, the 10-question minimum before finishing, and completion after all 67 questions.
- Test important user-visible behaviour with browser end-to-end tests where proportionate.
- Run the relevant lint, TypeScript, test and production-build checks after changes. Fix failures caused by the changes.
- Do not claim that checks passed unless they were actually run.
- Prefer deterministic tests. Avoid reliance on arbitrary timeouts or flaky animation timing.

## Working Practices

- Inspect existing code and configuration before changing them. Preserve application data and avoid overwriting existing work.
- Follow the agreed project specification. Do not invent extra requirements or add features beyond the current task.
- Diagnose the root cause of errors before attempting fixes.
- Keep dependencies to a minimum and avoid unnecessary abstractions or defensive programming.
- Use Context7 for current documentation when available and relevant.
- Do not edit the repository-root `README.md` unless explicitly instructed.
- Report significant changes, checks performed and unresolved issues when completing a task.