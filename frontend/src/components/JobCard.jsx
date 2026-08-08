import { useEffect, useState } from 'react';
import ScoreGauge from './ScoreGauge.jsx';
import { api } from '../api/client.js';
import JobDetailsModal from './JobDetailsModal.jsx';

function toPlainText(value) {
  if (!value) return '';
  const element = document.createElement('div');
  element.innerHTML = value;
  return (element.textContent || '').replace(/\s+/g, ' ').trim();
}

export default function JobCard({ entry, onScored, onApplied }) {
  const { job, aiMatch, relevance, applied: appliedFromServer } = entry;
  const [scoring, setScoring] = useState(false);
  const [applying, setApplying] = useState(false);
  const [localMatch, setLocalMatch] = useState(aiMatch);
  const [applied, setApplied] = useState(!!appliedFromServer);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState('');
  const descriptionPreview = toPlainText(job.description);

  useEffect(() => {
    if (sessionStorage.getItem(`jobmatch_application_pending_${job._id}`) === 'true') setAwaitingConfirmation(true);
  }, [job._id]);

  async function handleScore() {
    setScoring(true);
    setError('');
    try {
      const { match } = await api.scoreJob(job._id);
      setLocalMatch(match);
      onScored?.(job._id, match);
    } catch (err) { setError(err.message); } finally { setScoring(false); }
  }

  function handleApply() {
    setError('');
    sessionStorage.setItem(`jobmatch_application_pending_${job._id}`, 'true');
    setAwaitingConfirmation(true);
    window.open(job.applyUrl, '_blank', 'noopener,noreferrer');
  }

  async function confirmApplied() {
    setApplying(true);
    setError('');
    try {
      await api.applyToJob(job._id);
      sessionStorage.removeItem(`jobmatch_application_pending_${job._id}`);
      setApplied(true);
      setAwaitingConfirmation(false);
      onApplied?.(job._id);
    } catch (err) { setError(err.message); } finally { setApplying(false); }
  }

  function dismissConfirmation() {
    sessionStorage.removeItem(`jobmatch_application_pending_${job._id}`);
    setAwaitingConfirmation(false);
  }

  return (
    <article className={`panel job-card${applied ? ' job-card-applied' : ''}`}>
      <div className="job-card-gauge">
        {localMatch
          ? <ScoreGauge score={localMatch.score} size={80} />
          : <div className="job-card-gauge-empty">Not<br />scored</div>}
      </div>

      <div className="job-card-body">
        <div className="job-card-top">
          <div>
            <button className="job-title-button" type="button" onClick={() => setShowDetails(true)}>{job.title}</button>
            <div className="job-card-meta">{job.company}{' \u00b7 '}{job.location || 'Location not specified'}{job.remote && ' \u00b7 Remote'}</div>
          </div>
          <div className="job-card-source mono">source: {job.source}</div>
        </div>

        <p className="job-card-desc">{descriptionPreview.slice(0, 220)}{descriptionPreview.length > 220 ? '\u2026' : ''}</p>

        {localMatch?.summary && (
          <div className="job-summary">
            <div className="job-summary-label">AI-generated summary</div>
            <div className="job-summary-text">{localMatch.summary}</div>
          </div>
        )}

        <div className="job-card-actions">
          <button className="btn" type="button" onClick={handleScore} disabled={scoring}>
            {scoring ? <span className="spinner" /> : null}
            {localMatch ? 'Re-score my fit' : 'Score my fit'}
          </button>
          <button className="btn btn-primary" type="button" onClick={handleApply} disabled={applying || applied}>
            {applied ? 'Applied \u2713' : 'Apply'}
          </button>
          <button className="btn btn-quiet" type="button" onClick={() => setShowDetails(true)}>View details</button>
          {!aiMatch && !localMatch && <span className="job-card-relevance">sorted by keyword relevance ({relevance}%)</span>}
        </div>

        {error && <div className="error-text">{error}</div>}
        {showDetails && <JobDetailsModal job={job} onClose={() => setShowDetails(false)} />}

        {awaitingConfirmation && !applied && (
          <div className="application-confirmation" role="status">
            <div>
              <strong>Did you finish applying?</strong>
              <span>We opened the employer's careers page in a new tab. Confirm only after submitting your application there.</span>
            </div>
            <div className="confirmation-actions">
              <button className="btn btn-primary" type="button" onClick={confirmApplied} disabled={applying}>{applying ? 'Saving…' : 'Yes, I applied'}</button>
              <button className="btn btn-quiet" type="button" onClick={dismissConfirmation}>Not yet</button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
