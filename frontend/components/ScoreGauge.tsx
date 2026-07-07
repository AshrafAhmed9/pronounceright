"use client";

import { bandColorVar, bandForScore, bandLabel } from "@/lib/scoreBands";

interface ScoreGaugeProps {
  score: number;
}

const RADIUS = 80;
const STROKE = 16;
const CIRCUMFERENCE = Math.PI * RADIUS; // semicircle arc length
const SIZE = RADIUS * 2 + STROKE;
const HEIGHT = SIZE / 2 + STROKE / 2;

export function ScoreGauge({ score }: ScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const band = bandForScore(clamped);
  const fillLength = (clamped / 100) * CIRCUMFERENCE;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: SIZE, height: HEIGHT }}>
        <svg
          width={SIZE}
          height={HEIGHT}
          viewBox={`0 0 ${SIZE} ${HEIGHT}`}
          role="img"
          aria-label={`Overall pronunciation score ${Math.round(clamped)} out of 100, band ${bandLabel[band]}`}
        >
          <path
            d={`M ${STROKE / 2} ${HEIGHT} A ${RADIUS} ${RADIUS} 0 0 1 ${SIZE - STROKE / 2} ${HEIGHT}`}
            fill="none"
            stroke="var(--gridline)"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          <path
            d={`M ${STROKE / 2} ${HEIGHT} A ${RADIUS} ${RADIUS} 0 0 1 ${SIZE - STROKE / 2} ${HEIGHT}`}
            fill="none"
            stroke={bandColorVar[band]}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${fillLength} ${CIRCUMFERENCE}`}
            style={{ transition: "stroke-dasharray 0.6s ease-out" }}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="text-5xl font-semibold tabular-nums text-[var(--text-primary)]">
            {Math.round(clamped)}
          </span>
          <span className="text-sm text-[var(--text-secondary)]">out of 100</span>
        </div>
      </div>
      <span
        className="rounded-full px-3 py-1 text-xs font-medium"
        style={{
          color: bandColorVar[band],
          backgroundColor: `color-mix(in srgb, ${bandColorVar[band]} 15%, transparent)`,
        }}
      >
        {bandLabel[band]}
      </span>
    </div>
  );
}
