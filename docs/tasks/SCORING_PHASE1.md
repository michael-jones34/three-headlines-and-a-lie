# 3H1L — Phase 1: Persistent scores and aggregate human performance

## Context

The read-only audit of the existing `web/` application is complete. Work on the branch `feature-persistent-scoring`.

The game uses `web/public/data/app_quizzes.json`, containing 67 quiz records. A player can finish after the existing minimum of 10 questions or complete the full game. Their results and the model comparison table are implemented in `web/src/components/Game.tsx`.

The Next.js app uses static export and is hosted on Vercel. Do not introduce a Next.js server runtime.

## Objective

Implement persistent, optionally anonymous score contributions and an approved aggregate human-accuracy statistic. Prepare the database schema for a public leaderboard, but do not implement the leaderboard display yet.

## Product requirements

1. Completing a game must continue to work exactly as it does now.
2. Before the results screen, provide an option to finish without contributing a score or to contribute the completed attempt.
3. When contributing, ask whether the player also wants to appear on a public leaderboard.
4. If they decline leaderboard participation, submit the score anonymously, without a display name. It will only contribute to the global average score.
5. If they opt in, collect display initials of 1–3 non-whitespace characters. Have a check to make sure they are happy with their submitted name before final submission.
6. Each submission must initially have moderation status `pending`.
7. Only approved submissions contribute to the publicly displayed aggregate statistic.
8. Rejected and pending records must not contribute to published statistics.
9. Do not collect email addresses, create accounts or introduce authentication.
10. Show the aggregate accuracy, approved attempt count and total submitted answers. Hide the aggregate accuracy or display an appropriate empty state if no approved answers exist.
11. Label the metric clearly as aggregate human accuracy across approved contributed answers. Do not imply it is a definitive human benchmark.
12. Keep the existing individual-score comparison and model-ranking semantics unchanged. Do not change model results or the ML evaluation pipeline.

## Database and security requirements

Use Supabase PostgreSQL and `@supabase/supabase-js`.

Create a source-controlled SQL migration for a single attempts table, with appropriate constraints and indexes. Include at least:

- A unique database identifier and unique `attempt_id` for each game attempt.
- Submission timestamp.
- `questions_answered` (10–67).
- `correct_count` (0–`questions_answered`).
- Derived attempt accuracy.
- Nullable `display_name`.
- `leaderboard_opt_in`, defaulting to false.
- Moderation status, defaulting to `pending`, constrained to `pending`, `approved` or `rejected`.

Enforce the relationship between leaderboard opt-in and display name at the database level. Generate timestamps and moderation status from database defaults where practical.

The public client may submit new pending attempts, but must not be able to approve, edit or delete records, nor read raw pending or rejected submissions.

Create an appropriately restricted aggregate database function returning:

- Approved attempt count.
- Total approved answers.
- Micro-average accuracy, calculated as `SUM(correct_count) / SUM(questions_answered)`.

Use a safe, documented permission model. Set a fixed empty `search_path` and schema-qualify names if using a `SECURITY DEFINER` function. Explicitly restrict function execution privileges.

Prepare a public leaderboard view or equivalent query path that returns only approved attempts explicitly opted into the leaderboard. It must not expose anonymous contributions or unapproved records. Do not hard-code a 50-row limit into the underlying leaderboard view, since pagination will be implemented in Phase 2.

Do not put secret or service-role keys in frontend code. Restrict public table grants as well as RLS policies. Ensure the chosen view/function approach does not inadvertently bypass intended access controls.

## Implementation details

- Follow the existing codebase conventions and inspect current game state before modifying `Game.tsx`.
- Generate a unique attempt ID when a game starts and retain it for that attempt.
- Prevent duplicate submissions through repeated clicks and use the database uniqueness constraint to handle duplicate requests.
- Keep game completion, scoring and results available even when Supabase is unavailable.
- Add clear submitting, successful, pending-review and failed-submission states.
- Keep the leaderboard display for Phase 2.
- Do not modify root-level ML code, notebooks, training scripts, evaluation results or dataset construction.
- Do not reopen the completed styling task or undertake speculative UI redesign.
- Do not add an Edge Function, authentication, CAPTCHA or elaborate anti-cheat functionality without identifying a concrete requirement.

Create the Supabase client helper and document the required public environment variables, including an `.env.example` with placeholders. Never commit actual credentials. The frontend should use a Supabase publishable/public key only.

Include setup instructions explaining how to apply the SQL migration in Supabase Studio, configure local environment variables and configure Vercel. Ensure missing configuration produces a comprehensible error rather than breaking normal gameplay or static export.

Add proportionate tests using existing test infrastructure if available. Do not introduce a large testing framework just for this feature.

## Acceptance criteria

- A player can finish a valid game without submitting any data.
- A player can submit anonymously or opt into leaderboard participation with a valid display name.
- Submission retries cannot create duplicate records for the same attempt.
- New records are pending by default and are not included in published statistics.
- Database permissions prevent public approval, updates, deletions and reading unapproved attempts.
- The approved aggregate uses the micro-average formula and returns the correct attempt and answer counts.
- Anonymous approved submissions contribute to the aggregate but never appear in leaderboard data.
- The app remains playable when Supabase is unavailable.
- Static export remains intact, and relevant lint/build checks pass.

Implement only this phase. Inspect the final diff, report which checks were actually run, identify anything that still requires manual setup, and do not commit, push or deploy automatically.
