export interface Headline {
  text: string;
  url: string;
}

export interface Quiz {
  _id: string;
  date: string;
  source_url: string;
  headlines: Headline[];
  answer: number;
}

export interface AnswerRecord {
  quizId: string;
  selectedIndex: number;
  correct: boolean;
}

export const MIN_QUESTIONS = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Check the quiz JSON once when it is loaded, so malformed data
 * produces a useful error rather than an unexpected game failure.
 */
export function validateQuizzes(data: unknown): Quiz[] {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("The quiz data is empty or is not a list.");
  }

  return data.map((item, quizIndex): Quiz => {
    if (!isRecord(item)) {
      throw new Error(`Quiz ${quizIndex + 1} is not an object.`);
    }

    const id = item._id;
    const date = item.date;
    const sourceUrl = item.source_url;
    const headlines = item.headlines;
    const answer = item.answer;

    if (
      typeof id !== "string" ||
      typeof date !== "string" ||
      typeof sourceUrl !== "string" ||
      !Array.isArray(headlines) ||
      typeof answer !== "number" ||
      !Number.isInteger(answer)
    ) {
      throw new Error(`Quiz ${quizIndex + 1} has an invalid format.`);
    }

    if (headlines.length !== 4 || answer < 0 || answer >= headlines.length) {
      throw new Error(
        `Quiz ${quizIndex + 1} must have four headlines and a valid answer index.`,
      );
    }

    const parsedHeadlines = headlines.map(
      (headline, headlineIndex): Headline => {
        if (
          !isRecord(headline) ||
          typeof headline.text !== "string" ||
          typeof headline.url !== "string"
        ) {
          throw new Error(
            `Headline ${headlineIndex + 1} in quiz ${quizIndex + 1} is invalid.`,
          );
        }

        return {
          text: headline.text,
          url: headline.url,
        };
      },
    );

    return {
      _id: id,
      date,
      source_url: sourceUrl,
      headlines: parsedHeadlines,
      answer,
    };
  });
}

/** Return a shuffled copy, leaving the original quiz list untouched. */
export function shuffleQuizzes(quizzes: Quiz[]): Quiz[] {
  const shuffled = [...quizzes];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export function calculateCorrectCount(answers: AnswerRecord[]): number {
  return answers.filter((answer) => answer.correct).length;
}

/** Competition ranking: one plus the number of strictly higher scores. */
export function calculateRank(
  accuracy: number,
  modelResults: Record<string, number>,
): number {
  return (
    1 +
    Object.values(modelResults).filter(
      (modelAccuracy) => modelAccuracy > accuracy,
    ).length
  );
}