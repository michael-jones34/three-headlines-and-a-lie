-- Migration: 0001_create_attempts
-- Creates the attempts table, supporting indexes, aggregate function, and leaderboard view.
-- Apply this migration in Supabase Studio via SQL Editor, or use the Supabase CLI.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists public.attempts (
    id              uuid        primary key default gen_random_uuid(),
    attempt_id      uuid        not null unique,
    created_at      timestamptz not null default now(),
    questions_answered smallint not null,
    correct_count   smallint    not null,
    accuracy        numeric(6, 5) generated always as (
                        round(correct_count::numeric / questions_answered, 5)
                    ) stored,
    display_name    text,
    leaderboard_opt_in boolean not null default false,
    status          text        not null default 'pending',

    constraint attempts_questions_range
        check (questions_answered between 10 and 67),
    constraint attempts_correct_range
        check (correct_count between 0 and questions_answered),
    constraint attempts_status_values
        check (status in ('pending', 'approved', 'rejected')),
    -- If leaderboard_opt_in is true, display_name must be 1 to 3 non-whitespace characters.
    constraint attempts_leaderboard_requires_name
        check (
            leaderboard_opt_in = false
            or (display_name is not null and display_name ~ '^\S{1,3}$')
        ),
    -- Anonymous submissions must not carry a display_name.
    constraint attempts_anonymous_no_name
        check (
            leaderboard_opt_in = true
            or display_name is null
        )
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Aggregate query: only approved rows, covering columns needed for
-- SUM(correct_count) and SUM(questions_answered).
create index if not exists idx_attempts_approved_aggregate
    on public.attempts (status, correct_count, questions_answered)
    where status = 'approved';

-- Leaderboard query: approved, opted-in rows ordered by accuracy.
create index if not exists idx_attempts_leaderboard
    on public.attempts (status, leaderboard_opt_in, accuracy desc, questions_answered desc, created_at asc)
    where status = 'approved' and leaderboard_opt_in = true;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.attempts enable row level security;

-- Public (anon / authenticated) role: insert only, and only pending records.
-- No update, delete, or select policy exists, denying those operations.
create policy "anon_insert_pending_only"
    on public.attempts
    for insert
    to anon, authenticated
    with check (
        status = 'pending'
        and questions_answered between 10 and 67
        and correct_count between 0 and questions_answered
        and (
            (leaderboard_opt_in = false and display_name is null)
            or (leaderboard_opt_in = true and display_name is not null and display_name ~ '^\S{1,3}$')
        )
    );

-- ---------------------------------------------------------------------------
-- Revoke broad table grants from public/anon/authenticated
-- ---------------------------------------------------------------------------

-- Supabase grants ALL privileges on new tables to anon and authenticated roles.
-- Revoke all table-level access, then grant only INSERT.
revoke all on public.attempts from public;
revoke all on public.attempts from anon;
revoke all on public.attempts from authenticated;

grant insert (attempt_id, questions_answered, correct_count, display_name, leaderboard_opt_in)
    on public.attempts to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Aggregate function
-- ---------------------------------------------------------------------------
-- Returns approved attempt count, total approved answers, and micro-average
-- accuracy (SUM(correct_count) / SUM(questions_answered)).
-- SECURITY DEFINER with fixed empty search_path so the function executes safely
-- and only references schema-qualified objects regardless of caller context.

create or replace function public.get_human_stats()
returns table (
    approved_attempts bigint,
    total_answers     bigint,
    micro_accuracy    numeric
)
language sql
security definer
set search_path = ''
stable
as $$
    select
        count(*)::bigint,
        coalesce(sum(questions_answered), 0)::bigint,
        case
            when coalesce(sum(questions_answered), 0) = 0 then null
            else round(
                sum(correct_count)::numeric / sum(questions_answered),
                5
            )
        end
    from public.attempts
    where status = 'approved';
$$;

-- Revoke execute from public, then grant only to anon and authenticated.
revoke all on function public.get_human_stats() from public;
grant execute on function public.get_human_stats() to anon;
grant execute on function public.get_human_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- Leaderboard view
-- ---------------------------------------------------------------------------
-- Exposes only approved, leaderboard-opted-in submissions.
-- Does not hard-code a row limit; pagination is handled by the client query.
-- Anonymous submissions (leaderboard_opt_in = false) and unapproved records
-- are never exposed. The attempt_id is excluded to prevent player tracking.

create or replace view public.leaderboard as
    select
        id,
        display_name,
        accuracy,
        correct_count,
        questions_answered,
        created_at
    from public.attempts
    where status = 'approved'
      and leaderboard_opt_in = true;

-- Grant select on the view to anon and authenticated.
grant select on public.leaderboard to anon;
grant select on public.leaderboard to authenticated;
