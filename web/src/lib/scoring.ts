/**
 * Scoring helpers: submit a completed attempt to Supabase and fetch the
 * approved aggregate human-accuracy statistics.
 *
 * All functions degrade gracefully when the Supabase client is not
 * configured (missing environment variables) or when the network is
 * unavailable, so normal gameplay is never blocked.
 */

import { supabase } from "./supabase";

export interface SubmitAttemptParams {
  attemptId: string;
  questionsAnswered: number;
  correctCount: number;
  leaderboardOptIn: boolean;
  /** Required when leaderboardOptIn is true; must be null when false. */
  displayName: string | null;
}

export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: "duplicate" | "network" | "validation" | "unconfigured" };

/**
 * Validate display-name initials: 1–3 non-whitespace characters.
 * Returns the trimmed value or throws a descriptive error.
 */
export function validateDisplayName(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error("Display initials cannot be blank.");
  }
  if (trimmed.length > 3) {
    throw new Error("Display initials must be 1 to 3 characters.");
  }
  // No characters may be whitespace.
  if (/\s/.test(trimmed)) {
    throw new Error("Display initials must not contain spaces.");
  }
  return trimmed;
}

/**
 * Submit a completed game attempt to Supabase.
 *
 * - Returns { ok: true } on success.
 * - Returns { ok: false, reason: "duplicate" } if the attempt_id already
 *   exists (safe to retry — the original record is intact).
 * - Returns { ok: false, reason: "validation" } if params violate game rules.
 * - Returns { ok: false, reason: "unconfigured" } when Supabase is not set up.
 * - Returns { ok: false, reason: "network" } for any other error.
 */
export async function submitAttempt(
  params: SubmitAttemptParams,
): Promise<SubmitResult> {
  const { attemptId, questionsAnswered, correctCount, leaderboardOptIn, displayName } = params;

  // Validate params before sending.
  if (
    !attemptId ||
    questionsAnswered < 10 ||
    questionsAnswered > 67 ||
    correctCount < 0 ||
    correctCount > questionsAnswered
  ) {
    return { ok: false, reason: "validation" };
  }

  if (leaderboardOptIn) {
    if (!displayName) {
      return { ok: false, reason: "validation" };
    }
    try {
      validateDisplayName(displayName);
    } catch {
      return { ok: false, reason: "validation" };
    }
  } else if (displayName !== null) {
    return { ok: false, reason: "validation" };
  }

  if (!supabase) {
    return { ok: false, reason: "unconfigured" };
  }

  const { error } = await supabase.from("attempts").insert({
    attempt_id: attemptId,
    questions_answered: questionsAnswered,
    correct_count: correctCount,
    leaderboard_opt_in: leaderboardOptIn,
    display_name: displayName,
    // status is set by the database default ('pending')
  });

  if (!error) {
    return { ok: true };
  }

  // Postgres unique violation code: 23505
  if (error.code === "23505") {
    return { ok: false, reason: "duplicate" };
  }

  return { ok: false, reason: "network" };
}

export interface HumanStats {
  approvedAttempts: number;
  totalAnswers: number;
  microAccuracy: number;
}

/**
 * Fetch aggregate statistics from the get_human_stats RPC.
 *
 * Returns null when Supabase is unavailable, unconfigured, or returns no
 * approved data (zero attempts or the function returns null accuracy).
 */
export async function fetchHumanStats(): Promise<HumanStats | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc("get_human_stats").single();

  if (error || !data) {
    return null;
  }

  const row = data as {
    approved_attempts: number;
    total_answers: number;
    micro_accuracy: number | null;
  };

  if (row.micro_accuracy === null || row.approved_attempts === 0) {
    return null;
  }

  return {
    approvedAttempts: row.approved_attempts,
    totalAnswers: row.total_answers,
    microAccuracy: Number(row.micro_accuracy),
  };
}
