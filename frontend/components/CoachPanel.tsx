import type { CoachFeedback } from "@/lib/types";

export function CoachPanel({ coaching }: { coaching: CoachFeedback }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--text-secondary)]">AI Coach</h3>
        {!coaching.generated && (
          <span className="rounded-full bg-[var(--surface-1)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
            rule-based tips
          </span>
        )}
      </div>
      <p className="mb-4 text-[15px] text-[var(--text-primary)]">{coaching.summary}</p>
      <ul className="space-y-3">
        {coaching.tips.map((tip, i) => (
          <li key={i} className="rounded-lg bg-[var(--surface-1)] p-3">
            <p className="text-sm font-medium text-[var(--text-primary)]">{tip.issue}</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{tip.tip}</p>
            {tip.example && (
              <p className="mt-1 text-sm italic text-[var(--accent)]">{tip.example}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
