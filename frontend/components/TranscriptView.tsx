"use client";

import { bandColorVar, formatErrorType } from "@/lib/scoreBands";
import type { WordScore } from "@/lib/types";

interface TranscriptViewProps {
  words: WordScore[];
  selectedIndex: number | null;
  activeIndex: number | null;
  onWordClick: (index: number) => void;
}

export function TranscriptView({ words, selectedIndex, activeIndex, onWordClick }: TranscriptViewProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-5">
      <h3 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
        Transcript — click any word for its phoneme breakdown
      </h3>
      <div className="flex flex-wrap gap-x-1.5 gap-y-2 text-lg leading-relaxed">
        {words.map((w, i) => {
          const color = bandColorVar[w.band];
          const errorLabel = formatErrorType(w.error_type);
          const isSelected = selectedIndex === i;
          const isActive = activeIndex === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onWordClick(i)}
              title={errorLabel ?? `${Math.round(w.accuracy_score)}/100`}
              className="cursor-pointer rounded px-1 py-0.5 font-medium transition-colors"
              style={{
                color,
                backgroundColor: isSelected
                  ? `color-mix(in srgb, ${color} 18%, transparent)`
                  : "transparent",
                boxShadow: isActive ? `0 0 0 2px ${color}` : "none",
              }}
            >
              {w.word}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-[var(--text-secondary)]">
        <LegendDot colorVar="var(--status-good)" label="Good (80-100)" />
        <LegendDot colorVar="var(--status-warning)" label="Needs work (60-79)" />
        <LegendDot colorVar="var(--status-critical)" label="Off target (below 60)" />
      </div>
    </div>
  );
}

function LegendDot({ colorVar, label }: { colorVar: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorVar }} />
      {label}
    </span>
  );
}
