/**
 * Supabase client singleton for the Three Headlines and a Lie frontend.
 *
 * Uses the public anon key only. The service-role key must never appear here.
 *
 * When environment variables are absent (e.g. during local development without
 * a .env.local file, or during a static build without Supabase configured),
 * the module returns null rather than throwing, so the rest of the application
 * can degrade gracefully.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;

if (url && anonKey) {
  supabase = createClient(url, anonKey);
}

export { supabase };
