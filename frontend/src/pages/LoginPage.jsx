import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import { ErrorBanner } from '../components/Feedback.jsx';
import SignalRings from '../components/SignalRings.jsx';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { applyAuthResult } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api.login({ email, password });
      applyAuthResult(result);
      navigate('/jobs');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle(credential) {
    setError('');
    try {
      const result = await api.googleLogin(credential);
      applyAuthResult(result);
      navigate('/jobs');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-intro">
        <SignalRings />
        <div className="eyebrow">JobMatch</div>
        <h1>Find work that fits.</h1>
        <p>Keep your strongest opportunities, applications, and next steps in one focused place.</p>
      </div>
      <div className="panel auth-card">
        <div className="auth-card-heading"><h2>Welcome back</h2><p>Sign in to continue your search.</p></div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="email">Email</label>
            <input id="email" className="field-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="password">Password</label>
            <input id="password" className="field-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <ErrorBanner message={error} />
          <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            Sign in
          </button>
        </form>

        <div className="auth-divider"><span>or continue with</span></div>

        <GoogleSignInButton onCredential={handleGoogle} />

        <div className="auth-footer">
          No account? <Link to="/register">Create one</Link>
          <span className="auth-footer-sep">·</span>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
      </div>
    </div>
  );
}
