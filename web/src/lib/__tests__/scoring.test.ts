import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateDisplayName,
  submitAttempt,
  fetchHumanStats,
  fetchLeaderboard,
  type LeaderboardEntry,
} from "../scoring";

let mockSupabaseClient: {
  rpc: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
} | null = null;

vi.mock("../supabase", () => ({
  get supabase() {
    return mockSupabaseClient;
  },
}));

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
  beforeEach(() => {
    mockSupabaseClient = null;
  });

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
  beforeEach(() => {
    mockSupabaseClient = null;
  });

  it("returns null when Supabase is unconfigured", async () => {
    const stats = await fetchHumanStats();
    expect(stats).toBeNull();
  });
});

describe("fetchLeaderboard", () => {
  let mockRpc: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRpc = vi.fn();
    mockSupabaseClient = {
      rpc: mockRpc,
      from: vi.fn(),
    };
  });

  it("returns unconfigured when Supabase client is missing", async () => {
    mockSupabaseClient = null;
    const res = await fetchLeaderboard();
    expect(res).toEqual({ ok: false, reason: "unconfigured" });
  });

  it("defaults to page 1 and 50 entries per page when called without arguments", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const res = await fetchLeaderboard();

    expect(mockRpc).toHaveBeenCalledWith("get_leaderboard", {
      page_number: 1,
      page_size: 50,
    });
    expect(res).toEqual({ ok: true, entries: [] });
  });

  it("passes custom positional pagination arguments", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await fetchLeaderboard(2, 25);

    expect(mockRpc).toHaveBeenCalledWith("get_leaderboard", {
      page_number: 2,
      page_size: 25,
    });
  });

  it("passes custom object pagination arguments", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await fetchLeaderboard({ pageNumber: 3, pageSize: 10 });

    expect(mockRpc).toHaveBeenCalledWith("get_leaderboard", {
      page_number: 3,
      page_size: 10,
    });
  });

  it("maps returned database rows to typed LeaderboardEntry array with numeric accuracy", async () => {
    const mockDbRows = [
      {
        display_name: "ALX",
        accuracy: "0.90000", // database numeric returned as string
        correct_count: 9,
        questions_answered: 10,
      },
      {
        display_name: "BOB",
        accuracy: 0.8, // database numeric returned as number
        correct_count: 8,
        questions_answered: 10,
      },
    ];

    mockRpc.mockResolvedValue({ data: mockDbRows, error: null });

    const res = await fetchLeaderboard();

    expect(res).toEqual({
      ok: true,
      entries: [
        {
          displayName: "ALX",
          accuracy: 0.9,
          correctCount: 9,
          questionsAnswered: 10,
        },
        {
          displayName: "BOB",
          accuracy: 0.8,
          correctCount: 8,
          questionsAnswered: 10,
        },
      ] satisfies LeaderboardEntry[],
    });
  });

  it("distinguishes successful empty results from errors", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const res = await fetchLeaderboard();

    expect(res).toEqual({ ok: true, entries: [] });
  });

  it("returns error result when the RPC call fails", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "Failed to execute RPC", code: "PGRST000" },
    });

    const res = await fetchLeaderboard();

    expect(res).toEqual({ ok: false, reason: "error" });
  });

  it("returns error result when data is null without explicit error", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const res = await fetchLeaderboard();

    expect(res).toEqual({ ok: false, reason: "error" });
  });
});
