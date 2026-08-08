import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import { ErrorBanner } from '../components/Feedback.jsx';
import SignalRings from '../components/SignalRings.jsx';

export default function RegisterPage() {
  const [name, setName] = useState('');
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
      const result = await api.register({ name, email, password });
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
        <h1>Better matches, less searching.</h1>
        <p>Create your workspace to keep your job search organised and intentional.</p>
      </div>
      <div className="panel auth-card">
        <div className="auth-card-heading"><h2>Create your account</h2><p>Start finding the roles that suit you.</p></div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="name">Name</label>
            <input id="name" className="field-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="email">Email</label>
            <input id="email" className="field-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 4 }}>
            <label className="field-label" htmlFor="password">Password</label>
            <input id="password" className="field-input" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="field-hint" style={{ marginTop: -8, marginBottom: 4 }}>At least 8 characters.</div>
          <ErrorBanner message={error} />
          <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            Create account
          </button>
        </form>

        <div className="auth-divider"><span>or continue with</span></div>

        <GoogleSignInButton onCredential={handleGoogle} />

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
