export function LoadingRow({ label = 'Loading…' }) {
  return (
    <div className="loading-row">
      <span className="spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, hint }) {
  return (
    <div className="empty-state panel">
      <div className="empty-state-title">{title}</div>
      {hint && <div className="empty-state-hint">{hint}</div>}
    </div>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return <div className="banner banner-warning" role="alert">{message}</div>;
}

// Freshness must be visible, not implied - "X active jobs · pool last
// updated Yh ago", never claiming real-time freshness the design doesn't
// actually provide.
export function FreshnessBadge({ freshness }) {
  if (!freshness) return null;
  const hoursAgo = freshness.lastUpdatedAt
    ? Math.max(0, Math.round((Date.now() - new Date(freshness.lastUpdatedAt).getTime()) / 3600000))
    : null;
  return (
    <div className="freshness mono">
      <span className="freshness-dot" aria-hidden />
      {freshness.activeCount.toLocaleString()} active jobs · pool last updated{' '}
      {hoursAgo === null ? 'unknown' : hoursAgo === 0 ? '<1h ago' : `${hoursAgo}h ago`}
    </div>
  );
}
