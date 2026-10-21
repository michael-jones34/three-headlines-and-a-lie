# Supabase Setup Guide for Three Headlines and a Lie

This document provides setup instructions for persistent scoring and aggregate human statistics using Supabase.

## 1. Apply Database Migration in Supabase Studio

1. Open your project dashboard at [supabase.com](https://supabase.com).
2. Navigate to the **SQL Editor** from the left navigation panel.
3. Click **New query**.
4. Paste the full contents of `supabase/migrations/0001_create_attempts.sql`.
5. Click **Run** to execute the migration.

The migration creates:
- The `public.attempts` table with validation constraints and unique attempt tracking.
- Partial indexes for aggregate statistics and future leaderboard queries.
- Row-Level Security (RLS) policies allowing public clients to submit `pending` records only.
- Restricted column-level `INSERT` grants on `public.attempts` to `anon` and `authenticated`.
- `public.get_human_stats()` `SECURITY DEFINER` function computing the micro-average accuracy of approved attempts.
- `public.leaderboard` view exposing approved, opted-in submissions (excluding private tracking columns).

## 2. Configure Local Environment Variables

1. In the `web/` directory, copy the example environment file:
   ```bash
   cp web/.env.example web/.env.local
   ```
2. Retrieve your project credentials from Supabase:
   - Go to **Project Settings** > **API**.
   - Copy the **Project URL** into `NEXT_PUBLIC_SUPABASE_URL`.
   - Copy the **publishable** key into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Verify that `web/.env.local` contains:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
   ```
   *Note: Never paste the secret `service_role` key into client configuration.*

4. If these variables are omitted, the application runs normally without persistent scoring:
   - Game completion and ML model comparison remain fully functional.
   - The submission screen displays a message indicating scoring contributions are unavailable.
   - Aggregate human accuracy is cleanly hidden until approved statistics exist.

## 3. Configure Vercel Deployment

When deploying to Vercel:
1. Go to your project settings in the Vercel dashboard.
2. Select **Environment Variables**.
3. Add the two public environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL.
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Your Supabase Publishable API Key.
4. Set the environment to **Production**, **Preview**, and **Development**.
5. Redeploy the project so the static export bundle embeds the public credentials.

## 4. Moderation Workflow

New submissions are created with `status = 'pending'`. They do not appear on any leaderboard and do not contribute to aggregate statistics until reviewed:
1. In Supabase Studio, open **Table Editor** > `attempts`.
2. Review pending submissions (verifying initials and score plausibility).
3. Update the `status` column to `'approved'` or `'rejected'`.
4. Approved entries automatically contribute to `get_human_stats()`.
