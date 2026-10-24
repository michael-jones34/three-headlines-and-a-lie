/**
 * CommunityLeaderboard
 *
 * Renders the community leaderboard section: loading, error, empty, and
 * paginated table states. Accepts the leaderboard state and page controls as
 * props so the parent (Game) owns all fetch logic and state.
 */

import { type LeaderboardEntry } from "../lib/scoring";

export type LeaderboardStatus =
  | "idle"
  | "loading"
  | "ok"
  | "empty"
  | "error"
  | "unconfigured";

interface CommunityLeaderboardProps {
  status: LeaderboardStatus;
  entries: LeaderboardEntry[];
  page: number;
  hasNext: boolean;
  pageSize: number;
  onPrevious: () => void;
  onNext: () => void;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

export default function CommunityLeaderboard({
  status,
  entries,
  page,
  hasNext,
  pageSize,
  onPrevious,
  onNext,
}: CommunityLeaderboardProps) {
  if (status === "unconfigured" || status === "idle") {
    return null;
  }

  return (
    <section>
      <h2 className="font-serif text-xl font-semibold">Community leaderboard</h2>
      <p className="mt-1 text-sm text-[#18283D]/70">
        Approved, opted-in submissions only. Ranked by accuracy, then correct
        count.
      </p>

      {status === "loading" && (
        <p className="mt-4 text-sm text-[#18283D]/60">Loading leaderboard&hellip;</p>
      )}

      {status === "error" && (
        <p className="mt-4 text-sm text-[#C6534B]">
          The leaderboard could not be loaded. Check your connection and try again.
        </p>
      )}

      {status === "empty" && (
        <p className="mt-4 text-sm text-[#18283D]/60">
          No approved entries yet. Be the first to submit a score.
        </p>
      )}

      {status === "ok" && (
        <>
          <div className="mt-4 overflow-x-auto rounded-xl border border-[#E5DFD5]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#ECE5D8] font-medium text-[#18283D]">
                <tr>
                  <th scope="col" className="px-4 py-3 text-right w-12">
                    Rank
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Initials
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Accuracy
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => {
                  const globalRank = (page - 1) * pageSize + index + 1;
                  return (
                    <tr
                      key={`${entry.displayName}-${globalRank}`}
                      className="border-t border-[#E5DFD5] text-[#18283D]/90"
                    >
                      <td className="px-4 py-3 text-right tabular-nums text-[#18283D]/60">
                        {globalRank}
                      </td>
                      <td className="px-4 py-3 font-medium">{entry.displayName}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatPercent(entry.accuracy)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#18283D]/70">
                        {entry.correctCount}/{entry.questionsAnswered}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(page > 1 || hasNext) && (
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={onPrevious}
                className="rounded-lg border border-[#18283D]/30 px-3 py-2 text-sm font-medium transition-colors duration-150 hover:bg-[#F2ECE1] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18283D] motion-reduce:transition-none"
              >
                Previous
              </button>
              <span className="text-sm text-[#18283D]/60">Page {page}</span>
              <button
                type="button"
                disabled={!hasNext}
                onClick={onNext}
                className="rounded-lg border border-[#18283D]/30 px-3 py-2 text-sm font-medium transition-colors duration-150 hover:bg-[#F2ECE1] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18283D] motion-reduce:transition-none"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
