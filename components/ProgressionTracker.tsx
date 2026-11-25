"use client";

import { CORPORATIONS, RANKS, RANK_THRESHOLDS, type Corporation, type Rank } from "@/lib/progression";
import { useHaulerStore } from "@/lib/store";

export function ProgressionTracker() {
  const { progression, setCorpRank, addXp } = useHaulerStore();

  return (
    <div className="rounded-lg border border-elevated bg-elevated/30 p-4">
      <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-accent/60">
        Progression
      </h3>
      <div className="space-y-3">
        {CORPORATIONS.map((corp) => {
          const prog = progression[corp] || { rank: "Trainee" as Rank, xp: 0 };
          const currentThreshold = RANK_THRESHOLDS[prog.rank];
          const nextRankIndex = RANKS.indexOf(prog.rank) + 1;
          const nextRank = nextRankIndex < RANKS.length ? RANKS[nextRankIndex] : null;
          const nextThreshold = nextRank ? RANK_THRESHOLDS[nextRank] : currentThreshold;
          const progress = nextRank
            ? Math.min(100, ((prog.xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100)
            : 100;

          return (
            <div key={corp} className="text-sm">
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium">{corp}</span>
                <select
                  value={prog.rank}
                  onChange={(e) => setCorpRank(corp, e.target.value as Rank)}
                  className="text-xs bg-ink border border-elevated rounded px-1 py-0.5"
                >
                  {RANKS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="h-1.5 bg-ink rounded-full overflow-hidden">
                <div
                  className="h-full bg-sage transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-accent/50 mt-0.5">
                <span>{prog.xp} XP</span>
                {nextRank && <span>Next: {nextRank}</span>}
              </div>
              <button
                onClick={() => addXp(corp, 50)}
                className="mt-1 text-[10px] text-gold hover:underline"
              >
                +50 XP
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}