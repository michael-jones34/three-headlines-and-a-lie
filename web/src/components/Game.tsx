"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import modelResults from "../data/model_results.json";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
import {
  calculateCorrectCount,
  calculateRank,
  generateAttemptId,
  MIN_QUESTIONS,
  shuffleQuizzes,
  validateQuizzes,
  type AnswerRecord,
  type Quiz,
} from "../lib/game";
import {
  fetchHumanStats,
  fetchLeaderboard,
  submitAttempt,
  validateDisplayName,
  type HumanStats,
  type LeaderboardEntry,
  type SubmitResult,
} from "../lib/scoring";
import ReactMarkdown from "react-markdown";
import CommunityLeaderboard from "./CommunityLeaderboard";

const BENCHMARK_RESULTS = modelResults as Record<string, number>;

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

const MODEL_EXPLANATIONS = [
  {
    name: "Random baseline",
    category: "Baseline",
    description:
      "A simple reference point that selects one of the four headline positions at random. It represents performance without learning any patterns from the data. If a model cannot beat this value then it is considered no better than a random guess and is therefore not worth using.",
  },
  {
    name: "TF-IDF + Logistic Regression",
    category: "Traditional machine learning",
    description:
      "Converts headline text into numerical features based on word frequency and how distinctive words are across the dataset. A logistic regression classifier then uses those features to predict which headline is fabricated.",
  },
  {
    name: "MiniLM embeddings + Logistic Regression",
    category: "Machine learning with language embeddings",
    description:
      "Uses MiniLM, a compact language model, to convert each full headline into a numerical representation of its meaning. Logistic regression uses these representations to classify the headlines.",
  },
  {
    name: "MiniLM embeddings + Multilayer Perceptron",
    category: "Neural network classifier",
    description:
      "Uses the same MiniLM headline representations as the previous model, but feeds them into a small neural network called a multilayer perceptron (MLP) instead of logistic regression.",
  },
  {
    name: "DistilBERT headline-level classifier",
    category: "Transformer classifier",
    description:
      "Uses DistilBERT, a smaller version of BERT which is a transformer based neural network, to analyse each headline individually and predict whether it is fabricated. The four predictions from a single quiz are then used to identify the likely lie.",
  },
  {
    name: "DistilBERT quiz-level concatenated classifier",
    category: "Transformer classifier",
    description:
      "Combines the four headlines into a single input and uses DistilBERT to make a quiz-level prediction. Unlike the headline-level approach, it can consider the headlines together, but the concatenated input may introduce positional biases.",
  },
  {
    name: "DistilBERT quiz-level shared scorer",
    category: "Transformer classifier",
    description:
      "Uses DistilBERT to score each headline individually, but it shares the same scoring mechanism across all four positions for a single quiz during training. The predicted scores are compared during evaluation to select the most likely fabricated headline.",
  },
  {
    name: "Llama 3.2 3B + QLoRA",
    category: "Generative large language model",
    description:
      "Uses Llama 3.2, a language model with 3 billion parameters, adapted for this task using QLoRA. QLoRA is a memory-efficient fine-tuning technique that trains a small set of additional parameters while keeping the base model largely frozen. The model is fed an entire quiz as a prompt and asked to pick which headline it thinks is the lie.",
  },
  {
    name: "Claude Haiku 4.5",
    category: "Generative large language model",
    description:
      "A compact general-purpose language model from Anthropic (now deprecated), prompted with full quizzes. The cheaper Anthropic option.",
  },
  {
    name: "GPT-5 nano",
    category: "Generative large language model",
    description:
      "A compact general-purpose language model from OpenAI, prompted with full quizzes. The cheaper OpenAI option.",
  },
  {
    name: "Claude Fable 5.1",
    category: "Generative large language model",
    description:
      "Anthropic's most powerful model at the time of evaluation, prompted with full quizzes. The expensive Anthropic option.",
  },
  {
    name: "GPT-6 Astra",
    category: "Generative large language model",
    description:
      "OpenAI's most powerful model at the time of evaluation, prompted with full quizzes. The expensive OpenAI option.",
  },
];

// Submission state machine for the score-contribution flow.
type SubmitStatus =
  | "idle"
  | "submitting"
  | "submitted"
  | "duplicate"
  | "failed"
  | "unconfigured";

export default function Game() {
  const [quizData, setQuizData] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [screen, setScreen] = useState<"start" | "playing" | "submit" | "results" | "leaderboard">(
    "start",
  );
  const [gameQuizzes, setGameQuizzes] = useState<Quiz[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerHistory, setAnswerHistory] = useState<AnswerRecord[]>([]);
  const [showModels, setShowModels] = useState(false);

  // Attempt ID generated when a game starts; used to prevent duplicate submissions.
  const [attemptId, setAttemptId] = useState<string>(() => generateAttemptId());
  const isSubmittingRef = useRef(false);

  // Score contribution / leaderboard opt-in state.
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");

  // Aggregate human stats fetched from Supabase on the results screen.
  const [humanStats, setHumanStats] = useState<HumanStats | null>(null);
  const [humanStatsFetched, setHumanStatsFetched] = useState(false);

  // Community leaderboard state.
  const LEADERBOARD_PAGE_SIZE = 50;
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardHasNext, setLeaderboardHasNext] = useState(false);
  const [leaderboardStatus, setLeaderboardStatus] = useState<
    "idle" | "loading" | "ok" | "empty" | "error" | "unconfigured"
  >("idle");
  const leaderboardFetchedPagesRef = useRef<Set<number>>(new Set());

  const [fadeState, setFadeState] = useState<"in" | "out">("in");
  const [questionFadeState, setQuestionFadeState] = useState<"in" | "out">("in");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isTransitioningRef = useRef(false);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const postSwapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupTimerRef = useRef<NodeJS.Timeout | null>(null);

  const questionContainerRef = useRef<HTMLDivElement>(null);
  const questionInnerRef = useRef<HTMLDivElement>(null);
  const isPendingHeightResizeRef = useRef(false);
  const questionFadeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const questionHeightRafRef = useRef<number | null>(null);
  const questionCleanupTimerRef = useRef<NodeJS.Timeout | null>(null);

  function resetQuestionContainerStyles() {
    if (questionContainerRef.current) {
      questionContainerRef.current.style.height = "";
      questionContainerRef.current.style.overflow = "";
      questionContainerRef.current.style.transition = "";
    }
  }

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      if (postSwapTimerRef.current) clearTimeout(postSwapTimerRef.current);
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
      if (questionFadeTimerRef.current) clearTimeout(questionFadeTimerRef.current);
      if (questionHeightRafRef.current) cancelAnimationFrame(questionHeightRafRef.current);
      if (questionCleanupTimerRef.current) clearTimeout(questionCleanupTimerRef.current);
      resetQuestionContainerStyles();
    };
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!isPendingHeightResizeRef.current) {
      return;
    }
    isPendingHeightResizeRef.current = false;

    if (!questionContainerRef.current || !questionInnerRef.current) {
      resetQuestionContainerStyles();
      isTransitioningRef.current = false;
      setIsTransitioning(false);
      return;
    }

    const targetHeight = questionInnerRef.current.offsetHeight;

    questionHeightRafRef.current = requestAnimationFrame(() => {
      if (!questionContainerRef.current) {
        resetQuestionContainerStyles();
        isTransitioningRef.current = false;
        setIsTransitioning(false);
        return;
      }

      questionContainerRef.current.style.transition = "height 220ms ease-out";
      questionContainerRef.current.style.height = `${targetHeight}px`;

      questionCleanupTimerRef.current = setTimeout(() => {
        resetQuestionContainerStyles();
        isTransitioningRef.current = false;
        setIsTransitioning(false);
      }, 220);
    });
  }, [currentIndex]);

  function navigateWithTransition(action: () => void) {
    if (isTransitioningRef.current) {
      return;
    }
    isTransitioningRef.current = true;
    setIsTransitioning(true);

    if (questionFadeTimerRef.current) clearTimeout(questionFadeTimerRef.current);
    if (questionHeightRafRef.current) cancelAnimationFrame(questionHeightRafRef.current);
    if (questionCleanupTimerRef.current) clearTimeout(questionCleanupTimerRef.current);
    resetQuestionContainerStyles();

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      action();
      window.scrollTo(0, 0);
      cleanupTimerRef.current = setTimeout(() => {
        isTransitioningRef.current = false;
        setIsTransitioning(false);
      }, 50);
      return;
    }

    setFadeState("out");

    transitionTimerRef.current = setTimeout(() => {
      action();
      window.scrollTo(0, 0);

      postSwapTimerRef.current = setTimeout(() => {
        setFadeState("in");

        cleanupTimerRef.current = setTimeout(() => {
          isTransitioningRef.current = false;
          setIsTransitioning(false);
        }, 180);
      }, 20);
    }, 140);
  }

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

  // Fetch aggregate human stats when entering the results screen.
  useEffect(() => {
    if (screen !== "results" || humanStatsFetched) return;

    let cancelled = false;

    async function load() {
      const stats = await fetchHumanStats();
      if (!cancelled) {
        setHumanStats(stats);
        setHumanStatsFetched(true);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [screen, humanStatsFetched]);

  // Fetch the community leaderboard page when the results screen is shown and
  // the page changes. After fetching the full page, a lightweight probe (1 row,
  // page N+1) determines whether a next page exists. This avoids the need to
  // request page_size+1 rows — which the RPC caps at 50 anyway.
  useEffect(() => {
    if (screen !== "results" && screen !== "leaderboard") return;
    if (leaderboardFetchedPagesRef.current.has(leaderboardPage)) return;

    let cancelled = false;

    async function loadLeaderboard() {
      setLeaderboardStatus("loading");
      const result = await fetchLeaderboard({
        pageNumber: leaderboardPage,
        pageSize: LEADERBOARD_PAGE_SIZE,
      });
      if (cancelled) return;

      if (!result.ok) {
        setLeaderboardStatus(result.reason === "unconfigured" ? "unconfigured" : "error");
        return;
      }

      leaderboardFetchedPagesRef.current.add(leaderboardPage);
      const displayEntries = result.entries;
      setLeaderboardEntries(displayEntries);

      if (displayEntries.length === 0) {
        setLeaderboardHasNext(false);
        setLeaderboardStatus("empty");
        return;
      }

      setLeaderboardStatus("ok");

      // Only probe for a next page when this page returned a full set of
      // results. If fewer than page_size rows were returned there cannot be a
      // next page, so skip the extra call.
      if (displayEntries.length < LEADERBOARD_PAGE_SIZE) {
        setLeaderboardHasNext(false);
        return;
      }

      // Probe: fetch a single row from the next page to determine whether it
      // exists. page_size: 1 is within the RPC's accepted range (1–50).
      const probe = await fetchLeaderboard({
        pageNumber: leaderboardPage + 1,
        pageSize: 1,
      });
      if (cancelled) return;

      setLeaderboardHasNext(probe.ok && probe.entries.length > 0);
    }

    void loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [screen, leaderboardPage]);

  function startGame() {
    resetQuestionContainerStyles();
    setQuestionFadeState("in");
    setGameQuizzes(shuffleQuizzes(quizData));
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setAnswerHistory([]);
    setAttemptId(generateAttemptId());
    // Reset submission state for the new game.
    setLeaderboardOptIn(false);
    setNameInput("");
    setNameError(null);
    setNameConfirmed(false);
    setSubmitStatus("idle");
    setHumanStats(null);
    setHumanStatsFetched(false);
    setLeaderboardPage(1);
    setLeaderboardEntries([]);
    setLeaderboardHasNext(false);
    setLeaderboardStatus("idle");
    leaderboardFetchedPagesRef.current = new Set();
    isSubmittingRef.current = false;
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

  function advanceToNextQuestion() {
    if (isTransitioningRef.current || selectedAnswer === null) {
      return;
    }
    isTransitioningRef.current = true;
    setIsTransitioning(true);

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setCurrentIndex((index) => index + 1);
      setSelectedAnswer(null);
      resetQuestionContainerStyles();
      isTransitioningRef.current = false;
      setIsTransitioning(false);
      return;
    }

    if (questionContainerRef.current) {
      const currentHeight = questionContainerRef.current.offsetHeight;
      questionContainerRef.current.style.height = `${currentHeight}px`;
      questionContainerRef.current.style.overflow = "hidden";
      questionContainerRef.current.style.transition = "none";
    }

    setQuestionFadeState("out");

    questionFadeTimerRef.current = setTimeout(() => {
      isPendingHeightResizeRef.current = true;
      setCurrentIndex((index) => index + 1);
      setSelectedAnswer(null);
      setQuestionFadeState("in");
    }, 70);
  }

  async function handleSubmitAttempt() {
    // Guard against concurrent submissions.
    if (isSubmittingRef.current || submitStatus === "submitted" || submitStatus === "duplicate") {
      return;
    }

    let resolvedName: string | null = null;

    if (leaderboardOptIn) {
      if (!nameConfirmed) return;
      try {
        resolvedName = validateDisplayName(nameInput);
      } catch (e) {
        setNameError(e instanceof Error ? e.message : "Invalid initials.");
        return;
      }
    }

    isSubmittingRef.current = true;
    setSubmitStatus("submitting");

    const result: SubmitResult = await submitAttempt({
      attemptId,
      questionsAnswered: answerHistory.length,
      correctCount: calculateCorrectCount(answerHistory),
      leaderboardOptIn,
      displayName: resolvedName,
    });

    isSubmittingRef.current = false;

    if (result.ok) {
      setSubmitStatus("submitted");
    } else if (result.reason === "duplicate") {
      setSubmitStatus("duplicate");
    } else if (result.reason === "unconfigured") {
      setSubmitStatus("unconfigured");
    } else {
      setSubmitStatus("failed");
    }
  }

  function handleNameInput(value: string) {
    setNameInput(value);
    setNameError(null);
    setNameConfirmed(false);
  }

  const correctCount = calculateCorrectCount(answerHistory);
  const accuracy =
    answerHistory.length > 0 ? correctCount / answerHistory.length : 0;

  const cardClassName = `mx-auto max-w-3xl rounded-2xl border border-[#E5DFD5] bg-white p-6 shadow-sm sm:p-8 transition-opacity motion-reduce:transition-none ${
    fadeState === "out"
      ? "opacity-0 duration-[140ms] ease-in"
      : "opacity-100 duration-[180ms] ease-out"
  }`;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#FAF7F0] px-4 py-10 text-[#18283D]">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#E5DFD5] bg-white p-8">
          <p>Loading quizzes…</p>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-[#FAF7F0] px-4 py-10 text-[#18283D]">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#E5DFD5] bg-white p-8">
          <h1 className="font-serif text-2xl font-bold">Unable to load the game</h1>
          <p className="mt-3 text-[#18283D]/80">{loadError}</p>
          <p className="mt-2 text-sm text-[#18283D]/60">
            Check that app_quizzes.json is in web/public/data/.
          </p>
        </div>
      </main>
    );
  }

  if (showModels) {
    return (
      <main className="min-h-screen bg-[#FAF7F0] px-4 py-10 text-[#18283D]">
        <div className={cardClassName}>
          <button
            type="button"
            disabled={isTransitioning}
            onClick={() => navigateWithTransition(() => setShowModels(false))}
            className="text-sm font-medium text-[#18283D] underline underline-offset-2 transition-colors duration-150 hover:text-[#C6534B] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18283D] motion-reduce:transition-none"
          >
            ← Back to scores
          </button>

          <h1 className="mt-6 font-serif text-3xl font-bold tracking-tight">
            What are these models?
          </h1>

          <p className="mt-4 leading-relaxed text-[#18283D]/80">
            These models were evaluated on the task of identifying which of
            four news headlines is fabricated. They use different approaches,
            from traditional machine learning to large language models. All 
            of the models apart from those by OpenAI and Anthropic were trained 
            specifically for the task.
          </p>

          <div className="mt-8 space-y-8">
            {MODEL_EXPLANATIONS.map((model) => (
              <section
                key={model.name}
                className="border-b border-[#E5DFD5] pb-6 last:border-b-0"
              >
              <p className="text-xs font-semibold uppercase tracking-wider text-[#C6534B]">
                {model.category}
              </p>
              <h2 className="mt-1 font-serif text-xl font-semibold text-[#18283D]">{model.name}</h2>
              <p className="mt-2 leading-7 text-[#18283D]/80">
                {model.description}
              </p>
              </section>
            ))}
          </div>

          <button
            type="button"
            disabled={isTransitioning}
            onClick={() => navigateWithTransition(() => setShowModels(false))}
            className="mt-4 text-sm font-medium text-[#18283D] underline underline-offset-2 transition-colors duration-150 hover:text-[#C6534B] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18283D] motion-reduce:transition-none"
          >
            ← Back to scores
          </button>
        </div>
      </main>
    );
  }

  if (screen === "leaderboard") {
    return (
      <main className="min-h-screen bg-[#FAF7F0] px-4 py-10 text-[#18283D]">
        <div className={cardClassName}>
          <button
            type="button"
            disabled={isTransitioning}
            onClick={() => navigateWithTransition(() => setScreen("start"))}
            className="text-sm font-medium text-[#18283D] underline underline-offset-2 transition-colors duration-150 hover:text-[#C6534B] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18283D] motion-reduce:transition-none"
          >
            ← Back to start
          </button>

          <h1 className="mt-6 font-serif text-3xl font-bold tracking-tight">
            Community leaderboard
          </h1>

          <div className="mt-6">
            <CommunityLeaderboard
              status={leaderboardStatus}
              entries={leaderboardEntries}
              page={leaderboardPage}
              hasNext={leaderboardHasNext}
              pageSize={LEADERBOARD_PAGE_SIZE}
              onPrevious={() => setLeaderboardPage((p) => p - 1)}
              onNext={() => setLeaderboardPage((p) => p + 1)}
            />
          </div>

        </div>
      </main>
    );
  }

  if (screen === "start") {
    return (
      <main className="min-h-screen bg-[#FAF7F0] px-4 py-10 text-[#18283D]">
        <div className={cardClassName}>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Three Headlines and a Lie
          </h1>

          <p className="mt-4 text-lg text-[#18283D]/90">
            Four headlines. Three are real, and one is fabricated. Can you
            spot the lie?
          </p>

          <p className="mt-3 text-[#18283D]/70">
            There are {quizData.length} quizzes available.
          </p>

          <p className="mt-3 text-[#18283D]/70">
            Answer at least {MIN_QUESTIONS} questions to show your score 
            and compare against machine learning model performance.
          </p>

          <button
            type="button"
            onClick={() => navigateWithTransition(startGame)}
            disabled={quizData.length === 0 || isTransitioning}
            className="mt-6 rounded-xl bg-[#18283D] px-5 py-3 font-semibold text-[#FAF7F0] transition-colors duration-150 hover:bg-[#283C54] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18283D] focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            Start game
          </button>

          <p className="mt-4">
            <button
              type="button"
              disabled={isTransitioning}
              onClick={() =>
                navigateWithTransition(() => setScreen("leaderboard"))
              }
              className="text-sm font-medium text-[#18283D] underline underline-offset-2 transition-colors duration-150 hover:text-[#C6534B] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18283D] motion-reduce:transition-none"
            >
              View community leaderboard
            </button>
          </p>

          <p className="mt-8 border-t border-[#E5DFD5] pt-4 text-sm text-[#18283D]/60">
            Source data and headline content credited to{" "}
            <a
              href="https://www.morningbrew.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#18283D] underline underline-offset-2 transition-colors duration-150 hover:text-[#C6534B]"
            >
              Morning Brew
            </a>.
          </p>
        </div>
      </main>
    );
  }

  // Score contribution screen — shown between gameplay and results.
  if (screen === "submit") {
    const alreadySettled =
      submitStatus === "submitted" || submitStatus === "duplicate";

    return (
      <main className="min-h-screen bg-[#FAF7F0] px-4 py-10 text-[#18283D]">
        <div className={cardClassName}>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Contribute your score?
          </h1>

          <div className="mt-5 rounded-xl border border-[#E5DFD5] bg-[#F6F1E7] p-4">
            <p className="text-sm font-medium uppercase tracking-wide text-[#18283D]/70">
              Your score
            </p>
            <p className="mt-1 font-serif text-4xl font-bold text-[#18283D]">
              {formatPercent(accuracy)}
            </p>
            <p className="mt-1 text-sm text-[#18283D]/80">
              {correctCount} correct out of {answerHistory.length} questions
            </p>
          </div>

          {!alreadySettled && (
            <>
              <p className="mt-5 text-[#18283D]/80">
                You can contribute your score anonymously to the aggregate
                human-accuracy statistic, or also opt into the public leaderboard
                with a short display name. Submissions are reviewed before appearing.
              </p>

              <div className="mt-5 space-y-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="radio"
                    name="leaderboard"
                    checked={!leaderboardOptIn}
                    onChange={() => {
                      setLeaderboardOptIn(false);
                      setNameInput("");
                      setNameError(null);
                      setNameConfirmed(false);
                    }}
                    className="mt-1 accent-[#18283D]"
                  />
                  <span>
                    <span className="font-semibold">Contribute anonymously</span>
                    <span className="block text-sm text-[#18283D]/70">
                      Your score counts toward the aggregate statistic but will
                      not appear in any leaderboard.
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="radio"
                    name="leaderboard"
                    checked={leaderboardOptIn}
                    onChange={() => {
                      setLeaderboardOptIn(true);
                      setNameConfirmed(false);
                    }}
                    className="mt-1 accent-[#18283D]"
                  />
                  <span>
                    <span className="font-semibold">Also appear on the leaderboard</span>
                    <span className="block text-sm text-[#18283D]/70">
                      Enter up to 3 characters as your display initials.
                    </span>
                  </span>
                </label>
              </div>

              {leaderboardOptIn && (
                <div className="mt-4">
                  <label
                    htmlFor="display-name"
                    className="block text-sm font-medium text-[#18283D]"
                  >
                    Display initials (1–3 characters, no spaces)
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      id="display-name"
                      type="text"
                      maxLength={3}
                      value={nameInput}
                      onChange={(e) => handleNameInput(e.target.value)}
                      disabled={nameConfirmed}
                      placeholder="e.g. MJ"
                      className="w-28 rounded-lg border border-[#E5DFD5] bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18283D] disabled:opacity-60"
                    />
                    {!nameConfirmed && (
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            validateDisplayName(nameInput);
                            setNameError(null);
                            setNameConfirmed(true);
                          } catch (e) {
                            setNameError(
                              e instanceof Error ? e.message : "Invalid initials.",
                            );
                          }
                        }}
                        className="rounded-lg border border-[#18283D]/30 px-3 py-2 text-sm font-medium transition-colors duration-150 hover:bg-[#F2ECE1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18283D]"
                      >
                        Confirm
                      </button>
                    )}
                    {nameConfirmed && (
                      <button
                        type="button"
                        onClick={() => setNameConfirmed(false)}
                        className="rounded-lg border border-[#18283D]/30 px-3 py-2 text-sm font-medium transition-colors duration-150 hover:bg-[#F2ECE1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18283D]"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {nameConfirmed && (
                    <p className="mt-1 text-sm text-[#18283D]/70">
                      You will appear as{" "}
                      <strong>{nameInput.trim()}</strong> on the leaderboard.
                    </p>
                  )}
                  {nameError && (
                    <p className="mt-1 text-sm text-[#C6534B]">{nameError}</p>
                  )}
                </div>
              )}

              {submitStatus === "failed" && (
                <p className="mt-4 text-sm text-[#C6534B]">
                  Submission failed. Check your connection and try again.
                </p>
              )}
              {submitStatus === "unconfigured" && (
                <p className="mt-4 text-sm text-[#18283D]/60">
                  Score contributions are not available in this environment.
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleSubmitAttempt()}
                  disabled={
                    submitStatus === "submitting" ||
                    (leaderboardOptIn && !nameConfirmed)
                  }
                  className="rounded-xl bg-[#18283D] px-5 py-3 font-semibold text-[#FAF7F0] transition-colors duration-150 hover:bg-[#283C54] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18283D] focus-visible:ring-offset-2 motion-reduce:transition-none"
                >
                  {submitStatus === "submitting" ? "Submitting…" : "Submit score"}
                </button>

                <button
                  type="button"
                  disabled={submitStatus === "submitting" || isTransitioning}
                  onClick={() =>
                    navigateWithTransition(() => setScreen("results"))
                  }
                  className="rounded-xl border border-[#18283D]/30 px-5 py-3 font-semibold text-[#18283D] transition-colors duration-150 hover:bg-[#F2ECE1] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18283D] focus-visible:ring-offset-2 motion-reduce:transition-none"
                >
                  Skip and view results
                </button>
              </div>
            </>
          )}

          {(submitStatus === "submitted" || submitStatus === "duplicate") && (
            <div className="mt-5">
              <p className="text-[#18283D]">
                {submitStatus === "duplicate"
                  ? "Your score was already received."
                  : "Score submitted. It is pending review before appearing in published statistics."}
              </p>
              <button
                type="button"
                disabled={isTransitioning}
                onClick={() =>
                  navigateWithTransition(() => setScreen("results"))
                }
                className="mt-4 rounded-xl bg-[#18283D] px-5 py-3 font-semibold text-[#FAF7F0] transition-colors duration-150 hover:bg-[#283C54] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18283D] focus-visible:ring-offset-2 motion-reduce:transition-none"
              >
                View results
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (screen === "results") {
    const humanAccuracy = humanStats?.microAccuracy ?? null;

    const rankedResults: {
      name: string;
      accuracy: number | null;
      isPlayer?: boolean;
      isHumanAverage?: boolean;
    }[] = [
      { name: "You", accuracy, isPlayer: true },
      ...Object.entries(BENCHMARK_RESULTS).map(([name, modelAccuracy]) => ({
        name,
        accuracy: modelAccuracy,
        isPlayer: false,
      })),
      {
        name: "Human average",
        accuracy: humanAccuracy,
        isHumanAverage: true,
      },
    ].sort((a, b) => {
      if (a.accuracy === null) return 1;
      if (b.accuracy === null) return -1;
      return b.accuracy - a.accuracy;
    });

    const rank = calculateRank(accuracy, BENCHMARK_RESULTS);

    return (
      <main className="min-h-screen bg-[#FAF7F0] px-4 py-10 text-[#18283D]">
        <div className={cardClassName}>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Your results</h1>

          <div className="mt-6 rounded-xl border border-[#E5DFD5] bg-[#F6F1E7] p-5">
            <p className="text-sm font-medium uppercase tracking-wide text-[#18283D]/70">Your accuracy</p>
            <p className="mt-1 font-serif text-5xl font-bold text-[#18283D]">
              {formatPercent(accuracy)}
            </p>
            <p className="mt-2 text-[#18283D]/80">
              {correctCount} correct out of {answerHistory.length} questions
              answered.
            </p>
          </div>

          <h2 className="mt-8 font-serif text-xl font-semibold">Model comparison</h2>

          <p className="mt-2 text-[#18283D]/80">
            Your score would rank <strong>#{rank}</strong> out of{" "}
            {Object.keys(BENCHMARK_RESULTS).length + 1} entries if compared directly with these
            benchmark scores achieved by different machine learning models.
          </p>

          <div className="mt-4 overflow-x-auto rounded-xl border border-[#E5DFD5]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#ECE5D8] font-medium text-[#18283D]">
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
                        ? "bg-[#E2D8C3] font-semibold text-[#18283D]"
                        : entry.isHumanAverage
                          ? "border-t border-[#E5DFD5] bg-[#F6F1E7]/60 text-[#18283D]/90"
                          : "border-t border-[#E5DFD5] text-[#18283D]/90"
                    }
                  >
                    <td className="px-4 py-3">{entry.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {entry.accuracy !== null
                        ? formatPercent(entry.accuracy)
                        : "Unavailable"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-sm text-[#18283D]/70">
            This comparison is indicative, not like-for-like: the benchmark
            scores were measured across the full test set, whereas your score
            is based on {answerHistory.length} randomly ordered questions.
            Shorter games are more sensitive to which questions you encounter.
          </p>

          <p className="mt-2 text-sm text-[#18283D]/70">
            The displayed human average result is a micro-average across 
            contributed, reviewed scores (total correct answers divided by total 
            attempts). Model results are based on a single attempt at every 
            question in the test set. As such the human average is also not directly 
            comparable but with a large enough number of attempts gives an indicative
            level of performance.
          </p>

          <p className="mt-4">
            <button
              type="button"
              disabled={isTransitioning}
              onClick={() => navigateWithTransition(() => setShowModels(true))}
              className="font-medium text-[#18283D] underline underline-offset-2 transition-colors duration-150 hover:text-[#C6534B] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18283D] motion-reduce:transition-none"
            >
              What are these models?
            </button>
          </p>

          {leaderboardStatus !== "unconfigured" && leaderboardStatus !== "idle" && (
            <div className="mt-10">
              <CommunityLeaderboard
                status={leaderboardStatus}
                entries={leaderboardEntries}
                page={leaderboardPage}
                hasNext={leaderboardHasNext}
                pageSize={LEADERBOARD_PAGE_SIZE}
                onPrevious={() => setLeaderboardPage((p) => p - 1)}
                onNext={() => setLeaderboardPage((p) => p + 1)}
              />
            </div>
          )}

          <button
            type="button"
            disabled={isTransitioning}
            onClick={() => navigateWithTransition(startGame)}
            className="mt-8 rounded-xl bg-[#18283D] px-5 py-3 font-semibold text-[#FAF7F0] transition-colors duration-150 hover:bg-[#283C54] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18283D] focus-visible:ring-offset-2 motion-reduce:transition-none"
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
      <main className="min-h-screen bg-[#FAF7F0] px-4 py-10 text-[#18283D]">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#E5DFD5] bg-white p-8">
          <p>No quiz is available at this position.</p>
          <button
            type="button"
            disabled={isTransitioning}
            onClick={() => navigateWithTransition(startGame)}
            className="mt-4 rounded-xl bg-[#18283D] px-5 py-3 font-semibold text-[#FAF7F0] transition-colors duration-150 hover:bg-[#283C54] disabled:opacity-50"
          >
            Restart game
          </button>
        </div>
      </main>
    );
  }

  const canFinish = answerHistory.length >= MIN_QUESTIONS;
  const isAnswered = selectedAnswer !== null;

  return (
    <main className="min-h-screen bg-[#FAF7F0] px-4 py-10 text-[#18283D]">
      <div className={cardClassName}>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-[#18283D]/70">
            Question {currentIndex + 1} of {gameQuizzes.length}
          </p>
          <p className="text-sm font-medium text-[#18283D]/70">
            Score: {correctCount}/{answerHistory.length}
          </p>
        </div>

        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#EAE4D7]"
          role="progressbar"
          aria-label="Quiz progress"
          aria-valuenow={currentIndex + 1}
          aria-valuemin={0}
          aria-valuemax={gameQuizzes.length}
        >
          <div
            className="h-full rounded-full bg-[#C6534B] transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{
              width: `${((currentIndex + 1) / gameQuizzes.length) * 100}%`,
            }}
          />
        </div>

        <h1 className="mt-6 font-serif text-2xl font-bold tracking-tight">
          Which headline is the lie?
        </h1>

        <div ref={questionContainerRef}>
          <div
            ref={questionInnerRef}
            className={`pt-5 transition-opacity motion-reduce:transition-none ${
              questionFadeState === "out"
                ? "opacity-0 duration-[70ms] ease-in"
                : "opacity-100 duration-[180ms] ease-out"
            }`}
          >
            <div className="space-y-3">
              {currentQuiz.headlines.map((headline, index) => {
                let optionStyle =
                  "border-[#E5DFD5] bg-white hover:border-[#18283D]/40 hover:bg-[#FAF7F0]";

                if (isAnswered) {
                  if (index === currentQuiz.answer) {
                    optionStyle = "border-[#6B9C82] bg-[#DCEBE3] text-[#143B2A]";
                  } else if (index === selectedAnswer) {
                    optionStyle = "border-[#C6534B] bg-[#F7E5E3] text-[#5C1D18]";
                  } else {
                    optionStyle = "border-[#E5DFD5] bg-white opacity-60 text-[#18283D]/60";
                  }
                }

                return (
                  <div key={`${currentQuiz._id}-${index}`}>
                    <button
                      type="button"
                      onClick={() => chooseAnswer(index, currentQuiz)}
                      disabled={isAnswered || isTransitioning}
                      aria-pressed={selectedAnswer === index}
                      className={`w-full rounded-xl border p-4 text-left transition-all duration-200 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18283D] focus-visible:ring-offset-2 disabled:cursor-default ${optionStyle}`}
                    >
                      <span className="mr-3 font-sans font-semibold text-[#18283D]/60">
                        {String.fromCharCode(65 + index)}.
                      </span>
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => (
                            <span className="font-serif text-base sm:text-lg font-medium leading-snug">
                              {children}
                            </span>
                          ),
                        }}
                      >
                        {headline.text}
                      </ReactMarkdown>
                    </button>

                    <div
                      className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
                        isAnswered ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <p
                          inert={!isAnswered}
                          className={`px-4 pt-2 text-sm transition-opacity duration-300 ease-out motion-reduce:transition-none ${
                            isAnswered ? "opacity-100" : "opacity-0"
                          }`}
                        >
                          <a
                            href={headline.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-[#18283D] underline underline-offset-2 transition-colors duration-150 hover:text-[#C6534B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18283D] focus-visible:ring-offset-2"
                          >
                            {index === currentQuiz.answer ? "GIF" : "Source article"}
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedAnswer !== null && (
              <section
                aria-live="polite"
                className={`mt-6 rounded-xl border p-5 animate-fade-in ${
                  selectedAnswer === currentQuiz.answer
                    ? "border-[#6B9C82] bg-[#DCEBE3] text-[#143B2A]"
                    : "border-[#C6534B] bg-[#F7E5E3] text-[#5C1D18]"
                }`}
              >
                <h2 className="font-serif text-lg font-semibold">
                  {selectedAnswer === currentQuiz.answer
                    ? "Correct — you spotted the lie!"
                    : "Incorrect — try the next one"}
                </h2>

                <p className="mt-3 text-xs opacity-75">
                  Issue date: {currentQuiz.date}
                </p>
              </section>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={
              currentIndex === gameQuizzes.length - 1
                ? () => navigateWithTransition(() => setScreen("submit"))
                : advanceToNextQuestion
            }
            disabled={selectedAnswer === null || isTransitioning}
            className="rounded-xl bg-[#18283D] px-5 py-3 font-semibold text-[#FAF7F0] transition-colors duration-150 hover:bg-[#283C54] disabled:cursor-default disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18283D] focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            {currentIndex === gameQuizzes.length - 1
              ? "View results"
              : "Next question"}
          </button>

          {canFinish && (
            <button
              type="button"
              onClick={() =>
                navigateWithTransition(() => setScreen("submit"))
              }
              disabled={isTransitioning}
              className="rounded-xl border border-[#18283D]/30 px-5 py-3 font-semibold text-[#18283D] transition-colors duration-150 hover:bg-[#F2ECE1] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18283D] focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              Finish game
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
