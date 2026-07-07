import { bandColorVar, bandForScore } from "@/lib/scoreBands";
import type { WordScore } from "@/lib/types";

interface PhonemePanelProps {
  word: WordScore | null;
}

export function PhonemePanel({ word }: PhonemePanelProps) {
  if (!word) {
    return (
      <div className="flex h-full items-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-5 text-sm text-[var(--text-secondary)]">
        Click any word in the transcript to see its phoneme-by-phoneme accuracy.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">&ldquo;{word.word}&rdquo;</h3>
        <span className="text-sm tabular-nums text-[var(--text-secondary)]">
          {Math.round(word.accuracy_score)}/100
        </span>
      </div>
      {word.phonemes.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">
          No phoneme-level detail is available for this word.
        </p>
      ) : (
        <div className="flex items-end gap-3">
          {word.phonemes.map((p, i) => {
            const color = bandColorVar[bandForScore(p.accuracy_score)];
            const barHeight = Math.max(6, (p.accuracy_score / 100) * 72);
            return (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="flex h-[72px] w-6 items-end">
                  <div
                    className="w-full rounded-t transition-[height] duration-500"
                    style={{ height: barHeight, backgroundColor: color }}
                  />
                </div>
                <span className="font-mono text-sm text-[var(--text-primary)]">{p.phoneme}</span>
                <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
                  {Math.round(p.accuracy_score)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
