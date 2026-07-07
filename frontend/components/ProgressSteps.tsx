"use client";

import { useEffect, useState } from "react";

const STAGES = [
  { at: 0, label: "Uploading audio…" },
  { at: 2, label: "Running phoneme-level pronunciation analysis…" },
  { at: 8, label: "Scoring fluency, prosody, and completeness…" },
  { at: 14, label: "Generating personalized coaching tips…" },
  { at: 22, label: "Almost there…" },
];

export function ProgressSteps() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const stage = [...STAGES].reverse().find((s) => elapsed >= s.at) ?? STAGES[0];

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-10 text-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2"
        style={{ borderColor: "var(--gridline)", borderTopColor: "var(--accent)" }}
      />
      <p className="text-[var(--text-primary)]">{stage.label}</p>
      <p className="text-xs text-[var(--text-muted)]">{elapsed}s elapsed · this can take up to 30s</p>
    </div>
  );
}
