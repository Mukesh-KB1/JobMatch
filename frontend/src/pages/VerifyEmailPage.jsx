import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { LoadingRow } from '../components/Feedback.jsx';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState('loading'); // loading | ok | error
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('This link is missing its verification token.');
      return;
    }
    api.verifyEmail(token)
      .then(() => setStatus('ok'))
      .catch((err) => {
        setStatus('error');
        setError(err.message);
      });
  }, [token]);

  return (
    <div className="page-center">
      <div className="solo-card-wrap">
        <div className="panel panel-pad" style={{ textAlign: 'center' }}>
          {status === 'loading' && <LoadingRow label="Verifying your email…" />}
          {status === 'ok' && (
            <>
              <h1 style={{ fontSize: '1.2rem', color: 'var(--band-strong)' }}>Email verified</h1>
              <p style={{ fontSize: 14, color: 'var(--ink-muted)' }}>
                You'll now receive daily and login-triggered match digests. <Link to="/jobs">Go to Jobs</Link>
              </p>
            </>
          )}
          {status === 'error' && (
            <>
              <h1 style={{ fontSize: '1.2rem', color: 'var(--band-weak)' }}>Couldn't verify</h1>
              <p style={{ fontSize: 14, color: 'var(--ink-muted)' }}>{error}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
