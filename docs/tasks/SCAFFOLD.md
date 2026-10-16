# Task: Scaffold the 3H1L Frontend

## Objective

Set up the frontend foundation for the Three Headlines and a Lie (3H1L) application in `web/`.

The goal is a working, lint-clean Next.js project configured for static deployment, ready for game implementation in a subsequent task.

**This task is scaffolding only. Do not implement game functionality or edit the root README.**

## Instructions and Context

Before starting, read:

- Repository-root `AGENTS.md`
- `web/AGENTS.md`
- `docs/project_spec.md`

Follow their instructions and technical decisions.

Inspect the existing repository and `web/` directory before making changes. The directory structure and application dataset may already exist; preserve existing work.

The Python/ML project at the repository root is complete and must remain untouched. In particular, do not modify Python dependencies, `uv.lock`, notebooks, ingestion scripts, datasets or trained models.

## Requirements

### 1. Initialise Next.js

Set up a current stable Next.js application in `web/` with:

- TypeScript
- App Router
- `src/` directory
- ESLint
- Tailwind CSS
- `@/*` import alias
- npm as the package manager

Use idiomatic defaults and avoid unnecessary dependencies.

If the existing directory prevents safe initialisation, do not overwrite or delete files. Use a temporary sibling directory and merge only non-conflicting scaffold files, explaining any conflicts.

### 2. Configure static export

Configure Next.js for static export using `output: 'export'`.

Do not introduce API routes, a backend, server-side inference, authentication or a database.

### 3. Preserve the application data

Preserve `web/public/data/quizzes.json` exactly as it exists.

Do not regenerate, reorder, reformat or otherwise modify the quiz dataset.

The frontend must remain independent of the root `data/` and `models/` directories at runtime.

### 4. Configure Git ignore rules

Inspect the existing root `.gitignore` before modifying it.

Ensure frontend-generated files and dependencies are ignored where appropriate, including:

- `web/node_modules/`
- `web/.next/`
- `web/out/`

Do not ignore `web/public/data/quizzes.json` or other frontend source files.

Avoid unrelated changes to existing ignore rules.

### 5. Keep the scaffold minimal

Generate the standard files required for a functioning Next.js project.

A minimal placeholder homepage is acceptable. Do not implement the game, results screen, model comparison, animations, game logic or additional application components.

Do not create testing frameworks, browser tests or CI workflows in this task. Those belong to later tasks.

## Working Checklist

Before making changes, inspect the repository and update this checklist with any additional steps required by the actual starting state.

Update the checklist as work progresses. Mark an item complete only after verifying it.

- [ ] Inspect the repository, applicable instructions and existing `web/` contents.
- [ ] Record any relevant conflicts or decisions before modifying files.
- [ ] Initialise Next.js and configure TypeScript, ESLint, Tailwind CSS and the App Router.
- [ ] Configure static export.
- [ ] Verify that the existing quiz dataset is unchanged.
- [ ] Update Git ignore rules as necessary.
- [ ] Install frontend dependencies.
- [ ] Run the frontend lint check.
- [ ] Run the production build.
- [ ] Inspect the final changes for accidental modifications outside scope.
- [ ] Record validation results, outstanding issues and task status.

## Decisions Log

Document meaningful technical decisions made during this task, including:

- The Next.js version and relevant configuration choices.
- Any deviations from the requested setup and their justification.
- Any conflicts encountered with existing files and how they were resolved.

Do not document routine actions unless they materially affect the outcome. Prefer a concise rationale over a lengthy narrative.

## Validation and Closeout

Run the appropriate npm commands for linting and production build, using the scripts defined in `web/package.json`.

Report the actual commands and their results. If a check fails, investigate the root cause and fix it if within scope. Do not mark failed checks as complete merely because the failure is documented.

Before closing the task:

1. Review the final diff.
2. Confirm that the root Python/ML project has not been modified.
3. Confirm that `web/public/data/quizzes.json` is unchanged.
4. Summarise the files created or modified.
5. Record any unresolved issues.
6. Set the task status to **Complete** only when the requirements and validation checks have been satisfied. Otherwise, leave it **Incomplete** and explain what remains.

Do not edit `README.md`.

## Final Status

Maintain this section as the task progresses.

- **Status:** Not started
- **Lint:** Not run
- **Production build:** Not run
- **Outstanding issues:** None identified yet