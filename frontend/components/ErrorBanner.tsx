interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-lg border p-4 text-sm"
      style={{
        borderColor: "var(--status-critical)",
        backgroundColor: "color-mix(in srgb, var(--status-critical) 10%, transparent)",
        color: "var(--status-critical)",
      }}
    >
      <p className="font-medium">{message}</p>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 cursor-pointer underline">
          Dismiss
        </button>
      )}
    </div>
  );
}
