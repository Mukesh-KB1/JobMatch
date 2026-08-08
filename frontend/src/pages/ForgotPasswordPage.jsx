import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { ErrorBanner } from '../components/Feedback.jsx';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Backend responds identically whether or not the email exists -
      // the UI mirrors that honesty rather than implying otherwise.
      await api.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-center">
      <div className="solo-card-wrap">
        <h1 className="solo-heading">Reset your password</h1>
        <div className="panel panel-pad">
          {sent ? (
            <p style={{ fontSize: 14, color: 'var(--ink-muted)' }}>
              If <strong style={{ color: 'var(--ink)' }}>{email}</strong> is registered, a reset
              link is on its way. Check your inbox.
            </p>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label className="field-label" htmlFor="email">Email</label>
                <input id="email" className="field-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <ErrorBanner message={error} />
              <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ marginTop: 12 }}>
                {loading ? <span className="spinner" /> : null}
                Send reset link
              </button>
            </form>
          )}
          <div style={{ marginTop: 18, fontSize: 13.5, textAlign: 'center' }}>
            <Link to="/login">Back to sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
