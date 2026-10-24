-- Migration: 0002_leaderboard_read_hardening
-- Hardens public read access for the leaderboard and human aggregate statistics.
-- 1. Drops the unneeded public.leaderboard view to prevent identifier/timestamp leakage.
-- 2. Replaces the old leaderboard index with one aligned to the tie-breaker criteria.
-- 3. Adds a narrowly scoped, paginated get_leaderboard() RPC function.
-- 4. Updates get_human_stats() to explicitly enforce questions_answered > 0.
-- Apply this migration in Supabase Studio via SQL Editor, or use the Supabase CLI.

-- ---------------------------------------------------------------------------
-- 1. Remove public view
-- ---------------------------------------------------------------------------
-- The RPC function replaces the view, avoiding exposure of internal UUIDs
-- (id) and timestamps (created_at).
drop view if exists public.leaderboard;

-- ---------------------------------------------------------------------------
-- 2. Aligned Partial Index for Leaderboard Ordering
-- ---------------------------------------------------------------------------
-- Drop the existing index whose secondary sort key was questions_answered.
drop index if exists public.idx_attempts_leaderboard;

-- Create an index matching the deterministic tie-breaker:
-- 1. accuracy DESC
-- 2. correct_count DESC (tie-breaker)
-- 3. created_at ASC, id ASC (final deterministic tie-breakers)
create index if not exists idx_attempts_leaderboard_rank
    on public.attempts (accuracy desc, correct_count desc, created_at asc, id asc)
    where status = 'approved' and leaderboard_opt_in = true;

-- ---------------------------------------------------------------------------
-- 3. Paginated get_leaderboard() RPC Function
-- ---------------------------------------------------------------------------
-- Returns only the four columns required by the UI for approved, opted-in entries.
-- Does not expose id, attempt_id, or created_at.
-- Supports pagination with a default and maximum of 50 entries per page.

create or replace function public.get_leaderboard(
    page_number int default 1,
    page_size int default 50
)
returns table (
    display_name text,
    accuracy numeric,
    correct_count smallint,
    questions_answered smallint
)
language sql
security definer
set search_path = ''
stable
as $$
    select
        a.display_name,
        a.accuracy,
        a.correct_count,
        a.questions_answered
    from public.attempts a
    where a.status = 'approved'
      and a.leaderboard_opt_in = true
      and a.questions_answered > 0
    order by
        a.accuracy desc,
        a.correct_count desc,
        a.created_at asc,
        a.id asc
    limit case
        when page_size between 1 and 50 then page_size
        else 50
    end
    offset (greatest(coalesce(page_number, 1)::bigint, 1::bigint) - 1::bigint) * case
        when page_size between 1 and 50 then page_size::bigint
        else 50::bigint
    end;
$$;

-- Revoke default public execution privileges, then grant only to anon and authenticated.
revoke all on function public.get_leaderboard(int, int) from public;
grant execute on function public.get_leaderboard(int, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Aggregate Human Statistics Function
-- ---------------------------------------------------------------------------
-- Computes micro-average accuracy across all approved attempts with
-- questions_answered > 0, irrespective of leaderboard opt-in status.
-- Preserves the existing return contract: (approved_attempts, total_answers, micro_accuracy).

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
    where status = 'approved'
      and questions_answered > 0;
$$;

-- Revoke default public execution privileges, then grant only to anon and authenticated.
revoke all on function public.get_human_stats() from public;
grant execute on function public.get_human_stats() to anon, authenticated;
