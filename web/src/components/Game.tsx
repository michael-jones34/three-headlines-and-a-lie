"use client";

import { useEffect, useState } from "react";
import modelResults from "../data/model_results.json";
import {
  calculateCorrectCount,
  calculateRank,
  MIN_QUESTIONS,
  shuffleQuizzes,
  validateQuizzes,
  type AnswerRecord,
  type Quiz,
} from "../lib/game";

const BENCHMARK_RESULTS = modelResults as Record<string, number>;

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export default function Game() {
  const [quizData, setQuizData] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [screen, setScreen] = useState<"start" | "playing" | "results">(
    "start",
  );
  const [gameQuizzes, setGameQuizzes] = useState<Quiz[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerHistory, setAnswerHistory] = useState<AnswerRecord[]>([]);

  // Load the static quiz data from web/public/data/.
  useEffect(() => {
    let cancelled = false;

    async function loadQuizzes() {
      try {
        const response = await fetch("/data/app_quizzes.json");

        if (!response.ok) {
          throw new Error(`Could not load quiz data (HTTP ${response.status}).`);
        }

        const data: unknown = await response.json();
        const validatedQuizzes = validateQuizzes(data);

        if (!cancelled) {
          setQuizData(validatedQuizzes);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "An unexpected error occurred while loading the quizzes.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadQuizzes();

    return () => {
      cancelled = true;
    };
  }, []);

  function startGame() {
    setGameQuizzes(shuffleQuizzes(quizData));
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setAnswerHistory([]);
    setScreen("playing");
  }

  function chooseAnswer(selectedIndex: number, quiz: Quiz) {
    // Once selected, an answer cannot be changed.
    if (selectedAnswer !== null) {
      return;
    }

    setSelectedAnswer(selectedIndex);

    setAnswerHistory((history) => [
      ...history,
      {
        quizId: quiz._id,
        selectedIndex,
        correct: selectedIndex === quiz.answer,
      },
    ]);
  }

  function nextQuestion() {
    if (selectedAnswer === null) {
      return;
    }

    if (currentIndex + 1 >= gameQuizzes.length) {
      setScreen("results");
      return;
    }

    setCurrentIndex((index) => index + 1);
    setSelectedAnswer(null);
  }

  const correctCount = calculateCorrectCount(answerHistory);
  const accuracy =
    answerHistory.length > 0 ? correctCount / answerHistory.length : 0;

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8">
          <p>Loading quizzes…</p>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8">
          <h1 className="text-2xl font-bold">Unable to load the game</h1>
          <p className="mt-3 text-slate-700">{loadError}</p>
          <p className="mt-2 text-sm text-slate-500">
            Check that app_quizzes.json is in web/public/data/.
          </p>
        </div>
      </main>
    );
  }

  if (screen === "start") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Three Headlines and a Lie
          </h1>

          <p className="mt-4 text-lg text-slate-700">
            Four headlines. Three are real, and one is fabricated. Can you
            spot the lie?
          </p>

          <p className="mt-3 text-slate-600">
            There are {quizData.length} quizzes available.
          </p>

          <p className="mt-3 text-slate-600">
            Answer at least {MIN_QUESTIONS} questions to finish, or keep going
            and attempt the entire set.
          </p>

          <button
            type="button"
            onClick={startGame}
            disabled={quizData.length === 0}
            className="mt-6 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2"
          >
            Start game
          </button>
        </div>
      </main>
    );
  }

  if (screen === "results") {
    const rankedResults = [
      { name: "You", accuracy, isPlayer: true },
      ...Object.entries(BENCHMARK_RESULTS).map(([name, modelAccuracy]) => ({
        name,
        accuracy: modelAccuracy,
        isPlayer: false,
      })),
    ].sort((a, b) => b.accuracy - a.accuracy);

    const rank = calculateRank(accuracy, BENCHMARK_RESULTS);

    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-bold tracking-tight">Your results</h1>

          <div className="mt-6 rounded-xl bg-slate-50 p-5">
            <p className="text-sm font-medium text-slate-600">Your accuracy</p>
            <p className="mt-1 text-4xl font-bold">
              {formatPercent(accuracy)}
            </p>
            <p className="mt-2 text-slate-700">
              {correctCount} correct out of {answerHistory.length} questions
              answered.
            </p>
          </div>

          <h2 className="mt-8 text-xl font-semibold">Model comparison</h2>

          <p className="mt-2 text-slate-700">
            Your score would rank <strong>#{rank}</strong> out of{" "}
            {rankedResults.length} entries if compared directly with these
            benchmark scores.
          </p>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Entry
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Accuracy
                  </th>
                </tr>
              </thead>
              <tbody>
                {rankedResults.map((entry) => (
                  <tr
                    key={entry.name}
                    className={
                      entry.isPlayer
                        ? "bg-sky-50 font-semibold"
                        : "border-t border-slate-100"
                    }
                  >
                    <td className="px-4 py-3">{entry.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatPercent(entry.accuracy)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-sm text-slate-600">
            This comparison is indicative, not like-for-like: the benchmark
            scores were measured across the full test set, whereas your score
            is based on {answerHistory.length} randomly ordered questions.
            Shorter games are more sensitive to which questions you encounter.
          </p>

          <button
            type="button"
            onClick={startGame}
            className="mt-6 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2"
          >
            Play again
          </button>
        </div>
      </main>
    );
  }

  const currentQuiz = gameQuizzes[currentIndex];

  if (!currentQuiz) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8">
          <p>No quiz is available at this position.</p>
          <button
            type="button"
            onClick={startGame}
            className="mt-4 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white"
          >
            Restart game
          </button>
        </div>
      </main>
    );
  }

  const lie = currentQuiz.headlines[currentQuiz.answer];
  const canFinish = answerHistory.length >= MIN_QUESTIONS;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-slate-600">
            Question {currentIndex + 1} of {gameQuizzes.length}
          </p>
          <p className="text-sm font-medium text-slate-600">
            Score: {correctCount}/{answerHistory.length}
          </p>
        </div>

        <progress
          className="mt-3 h-2 w-full accent-slate-900"
          value={answerHistory.length}
          max={gameQuizzes.length}
          aria-label="Quiz progress"
        />

        <h1 className="mt-6 text-2xl font-bold tracking-tight">
          Which headline is the lie?
        </h1>

        <div className="mt-5 space-y-3">
          {currentQuiz.headlines.map((headline, index) => {
            let optionStyle =
              "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50";

            if (selectedAnswer !== null) {
              if (index === currentQuiz.answer) {
                optionStyle = "border-emerald-600 bg-emerald-50";
              } else if (index === selectedAnswer) {
                optionStyle = "border-rose-600 bg-rose-50";
              } else {
                optionStyle = "border-slate-200 bg-white opacity-70";
              }
            }

            return (
              <button
                key={`${currentQuiz._id}-${index}`}
                type="button"
                onClick={() => chooseAnswer(index, currentQuiz)}
                disabled={selectedAnswer !== null}
                aria-pressed={selectedAnswer === index}
                className={`w-full rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 disabled:cursor-default ${optionStyle}`}
              >
                <span className="mr-3 font-semibold text-slate-500">
                  {String.fromCharCode(65 + index)}.
                </span>
                {headline.text}
              </button>
            );
          })}
        </div>

        {selectedAnswer !== null && (
          <section
            aria-live="polite"
            className="mt-6 rounded-xl border border-slate-200 p-5"
          >
            <h2 className="text-lg font-semibold">
              {selectedAnswer === currentQuiz.answer
                ? "Correct — you spotted the lie!"
                : "Not quite. The lie was:"}
            </h2>

            <p className="mt-2 text-slate-800">{lie.text}</p>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <a
                href={lie.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-700 underline underline-offset-2"
              >
                Open the lie&apos;s link
              </a>

              <a
                href={currentQuiz.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-700 underline underline-offset-2"
              >
                Open Morning Brew issue
              </a>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Issue date: {currentQuiz.date}
            </p>
          </section>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={nextQuestion}
            disabled={selectedAnswer === null}
            className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2"
          >
            {currentIndex === gameQuizzes.length - 1
              ? "View results"
              : "Next question"}
          </button>

          {canFinish && (
            <button
              type="button"
              onClick={() => setScreen("results")}
              className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2"
            >
              Finish game
            </button>
          )}
        </div>
      </div>
    </main>
  );
}