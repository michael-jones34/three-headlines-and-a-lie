import { describe, it, expect } from "vitest";
import {
  calculateCorrectCount,
  calculateRank,
  generateAttemptId,
  shuffleQuizzes,
  validateQuizzes,
  MIN_QUESTIONS,
  type Quiz,
  type AnswerRecord,
} from "../game";

// Minimal valid quiz fixture.
function makeQuiz(id: string, answer: number = 0): Quiz {
  return {
    _id: id,
    date: "2024-01-01",
    source_url: "https://example.com",
    headlines: [
      { text: "Headline A", url: "https://a.com" },
      { text: "Headline B", url: "https://b.com" },
      { text: "Headline C", url: "https://c.com" },
      { text: "Headline D", url: "https://d.com" },
    ],
    answer,
  };
}

describe("MIN_QUESTIONS", () => {
  it("is 10", () => {
    expect(MIN_QUESTIONS).toBe(10);
  });
});

describe("generateAttemptId", () => {
  it("returns a non-empty string", () => {
    expect(typeof generateAttemptId()).toBe("string");
    expect(generateAttemptId().length).toBeGreaterThan(0);
  });

  it("returns unique values on successive calls", () => {
    expect(generateAttemptId()).not.toBe(generateAttemptId());
  });
});

describe("calculateCorrectCount", () => {
  it("returns 0 for an empty history", () => {
    expect(calculateCorrectCount([])).toBe(0);
  });

  it("counts only correct answers", () => {
    const history: AnswerRecord[] = [
      { quizId: "1", selectedIndex: 0, correct: true },
      { quizId: "2", selectedIndex: 1, correct: false },
      { quizId: "3", selectedIndex: 2, correct: true },
    ];
    expect(calculateCorrectCount(history)).toBe(2);
  });

  it("counts all when all are correct", () => {
    const history: AnswerRecord[] = [
      { quizId: "1", selectedIndex: 0, correct: true },
      { quizId: "2", selectedIndex: 1, correct: true },
    ];
    expect(calculateCorrectCount(history)).toBe(2);
  });
});

describe("calculateRank", () => {
  const models = { A: 0.8, B: 0.6, C: 0.4 };

  it("ranks #1 when accuracy beats all models", () => {
    expect(calculateRank(0.9, models)).toBe(1);
  });

  it("ranks #2 when one model is strictly higher", () => {
    expect(calculateRank(0.7, models)).toBe(2);
  });

  it("ranks #4 when all models are strictly higher", () => {
    expect(calculateRank(0.3, models)).toBe(4);
  });

  it("does not count equal accuracy as strictly higher", () => {
    // accuracy === model A (0.8) → only nothing is strictly higher
    expect(calculateRank(0.8, models)).toBe(1);
  });
});

describe("validateQuizzes", () => {
  it("accepts valid quiz data", () => {
    const quizzes = validateQuizzes([makeQuiz("q1"), makeQuiz("q2")]);
    expect(quizzes).toHaveLength(2);
    expect(quizzes[0]._id).toBe("q1");
  });

  it("throws for empty array", () => {
    expect(() => validateQuizzes([])).toThrow();
  });

  it("throws for non-array input", () => {
    expect(() => validateQuizzes("not-an-array")).toThrow();
  });

  it("throws for quiz with wrong number of headlines", () => {
    const bad = { ...makeQuiz("q1"), headlines: [{ text: "A", url: "b" }] };
    expect(() => validateQuizzes([bad])).toThrow();
  });

  it("throws for answer index out of range", () => {
    const bad = { ...makeQuiz("q1"), answer: 4 };
    expect(() => validateQuizzes([bad])).toThrow();
  });
});

describe("shuffleQuizzes", () => {
  it("returns a new array of the same length", () => {
    const quizzes = [makeQuiz("a"), makeQuiz("b"), makeQuiz("c")];
    const shuffled = shuffleQuizzes(quizzes);
    expect(shuffled).toHaveLength(3);
    expect(shuffled).not.toBe(quizzes);
  });

  it("contains the same quizzes as the original", () => {
    const quizzes = [makeQuiz("a"), makeQuiz("b"), makeQuiz("c")];
    const shuffled = shuffleQuizzes(quizzes);
    const ids = shuffled.map((q) => q._id).sort();
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the original array", () => {
    const quizzes = [makeQuiz("a"), makeQuiz("b")];
    const originalIds = quizzes.map((q) => q._id);
    shuffleQuizzes(quizzes);
    expect(quizzes.map((q) => q._id)).toEqual(originalIds);
  });
});
