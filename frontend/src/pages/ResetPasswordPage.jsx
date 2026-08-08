import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { ErrorBanner } from '../components/Feedback.jsx';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.resetPassword(token, newPassword);
      setDone(true);
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="page-center">
        <div className="solo-card-wrap">
          <div className="panel panel-pad">
            <p>This link is missing its reset token. Request a new one from the <Link to="/forgot-password">forgot password</Link> page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-center">
      <div className="solo-card-wrap">
        <h1 className="solo-heading">Choose a new password</h1>
        <div className="panel panel-pad">
          {done ? (
            <p style={{ fontSize: 14, color: 'var(--band-strong)' }}>Password updated. Redirecting to sign in…</p>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="field" style={{ marginBottom: 6 }}>
                <label className="field-label" htmlFor="newPassword">New password</label>
                <input id="newPassword" className="field-input" type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              </div>
              <div className="field-hint" style={{ marginBottom: 14 }}>At least 8 characters. This link works once.</div>
              <ErrorBanner message={error} />
              <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ marginTop: 12 }}>
                {loading ? <span className="spinner" /> : null}
                Update password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
