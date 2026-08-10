import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import ScoreGauge from '../components/ScoreGauge.jsx';
import { LoadingRow, ErrorBanner, EmptyState } from '../components/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function AppliedPage() {
  const { user } = useAuth();
  const verified = !!user?.emailVerified;
  const [applications, setApplications] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!verified) { setLoading(false); return; }
    api.listApplications()
      .then((data) => setApplications(data.applications))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [verified]);

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <div>
          <div className="eyebrow">Your history</div>
          <h1>Applied</h1>
          <p>Everything you've applied to, with the match score at the time you applied (if one existed).</p>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        {!verified && (
          <EmptyState title="Verify your email first" hint="Once your email is verified you'll be able to apply to jobs, and they'll show up here." />
        )}

        {verified && <ErrorBanner message={error} />}
        {verified && loading && <LoadingRow label="Loading your applications…" />}

        {verified && !loading && applications && applications.length === 0 && (
          <EmptyState title="No applications yet" hint="Head to the Jobs page and hit Apply on something that fits." />
        )}

        {verified && !loading && applications && applications.length > 0 && (
          <div className="list">
            {applications.map((a) => (
              <div key={a._id} className="panel list-row">
                {a.matchScore != null ? (
                  <ScoreGauge score={a.matchScore} size={56} />
                ) : (
                  <div className="list-row-scoreless">No score</div>
                )}
                <div className="list-row-body">
                  <div className="list-row-title">{a.jobId?.title || 'Job no longer active'}</div>
                  <div className="list-row-sub">{a.jobId?.company}</div>
                </div>
                <div className="list-row-meta mono">{new Date(a.appliedAt).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}