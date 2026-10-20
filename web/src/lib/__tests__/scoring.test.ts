import { describe, it, expect } from "vitest";
import {
  validateDisplayName,
  submitAttempt,
  fetchHumanStats,
} from "../scoring";

describe("validateDisplayName", () => {
  it("accepts a single non-whitespace character", () => {
    expect(validateDisplayName("A")).toBe("A");
  });

  it("accepts two characters", () => {
    expect(validateDisplayName("MJ")).toBe("MJ");
  });

  it("accepts three characters", () => {
    expect(validateDisplayName("ABC")).toBe("ABC");
  });

  it("trims leading and trailing whitespace before validation", () => {
    expect(validateDisplayName("  X  ")).toBe("X");
  });

  it("throws when the trimmed value is empty", () => {
    expect(() => validateDisplayName("")).toThrow("blank");
    expect(() => validateDisplayName("   ")).toThrow("blank");
  });

  it("throws when the trimmed value exceeds 3 characters", () => {
    expect(() => validateDisplayName("ABCD")).toThrow("1 to 3");
  });

  it("throws when the value contains internal whitespace", () => {
    expect(() => validateDisplayName("A B")).toThrow("spaces");
  });
});

describe("submitAttempt validation", () => {
  it("rejects questions answered below 10", async () => {
    const res = await submitAttempt({
      attemptId: "test-id",
      questionsAnswered: 9,
      correctCount: 5,
      leaderboardOptIn: false,
      displayName: null,
    });
    expect(res).toEqual({ ok: false, reason: "validation" });
  });

  it("rejects questions answered above 67", async () => {
    const res = await submitAttempt({
      attemptId: "test-id",
      questionsAnswered: 68,
      correctCount: 50,
      leaderboardOptIn: false,
      displayName: null,
    });
    expect(res).toEqual({ ok: false, reason: "validation" });
  });

  it("rejects negative correct count", async () => {
    const res = await submitAttempt({
      attemptId: "test-id",
      questionsAnswered: 10,
      correctCount: -1,
      leaderboardOptIn: false,
      displayName: null,
    });
    expect(res).toEqual({ ok: false, reason: "validation" });
  });

  it("rejects correct count exceeding questions answered", async () => {
    const res = await submitAttempt({
      attemptId: "test-id",
      questionsAnswered: 10,
      correctCount: 11,
      leaderboardOptIn: false,
      displayName: null,
    });
    expect(res).toEqual({ ok: false, reason: "validation" });
  });

  it("rejects leaderboard opt-in without a display name", async () => {
    const res = await submitAttempt({
      attemptId: "test-id",
      questionsAnswered: 10,
      correctCount: 5,
      leaderboardOptIn: true,
      displayName: null,
    });
    expect(res).toEqual({ ok: false, reason: "validation" });
  });

  it("rejects leaderboard opt-in with invalid display name", async () => {
    const res = await submitAttempt({
      attemptId: "test-id",
      questionsAnswered: 10,
      correctCount: 5,
      leaderboardOptIn: true,
      displayName: "TOOLONG",
    });
    expect(res).toEqual({ ok: false, reason: "validation" });
  });

  it("rejects anonymous submission with display name provided", async () => {
    const res = await submitAttempt({
      attemptId: "test-id",
      questionsAnswered: 10,
      correctCount: 5,
      leaderboardOptIn: false,
      displayName: "AB",
    });
    expect(res).toEqual({ ok: false, reason: "validation" });
  });

  it("returns unconfigured when environment variables are missing", async () => {
    const res = await submitAttempt({
      attemptId: "test-id",
      questionsAnswered: 10,
      correctCount: 5,
      leaderboardOptIn: false,
      displayName: null,
    });
    expect(res).toEqual({ ok: false, reason: "unconfigured" });
  });
});

describe("fetchHumanStats fallback", () => {
  it("returns null when Supabase is unconfigured", async () => {
    const stats = await fetchHumanStats();
    expect(stats).toBeNull();
  });
});
