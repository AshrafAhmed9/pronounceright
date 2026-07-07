import { bandColorVar, bandForScore } from "@/lib/scoreBands";

interface StatTileProps {
  label: string;
  value: number | null;
}

export function StatTile({ label, value }: StatTileProps) {
  if (value === null) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <p className="text-sm text-[var(--text-secondary)]">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--text-muted)]">n/a</p>
      </div>
    );
  }

  const band = bandForScore(value);
  const color = bandColorVar[band];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
        {Math.round(value)}
      </p>
      <div className="mt-2 h-1.5 w-full rounded-full" style={{ backgroundColor: "var(--accent-track)" }}>
        <div
          className="h-1.5 rounded-full transition-[width] duration-500"
          style={{ width: `${Math.max(4, Math.min(100, value))}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
