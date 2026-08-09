import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { LoadingRow, ErrorBanner, EmptyState } from '../components/Feedback.jsx';

const MAX_RESUMES = 5;

function StatusPill({ status }) {
  const map = {
    parsed: { cls: 'pill-strong', label: 'Parsed' },
    pending: { cls: 'pill-mid', label: 'Parsing…' },
    failed: { cls: 'pill-weak', label: 'Parse failed' },
  };
  const s = map[status] || map.pending;
  return <span className={`pill ${s.cls} mono`}>{s.label}</span>;
}

export default function ResumePage() {
  const [resumes, setResumes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  // Tracks which resume row currently has an activate/delete request in
  // flight, so only that row's buttons disable - not the whole list.
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listResumes();
      setResumes(data.resumes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const atLimit = (resumes?.length || 0) >= MAX_RESUMES;

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      await api.uploadResume(file);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleActivate(id) {
    setBusyId(id);
    setError('');
    try {
      await api.activateResume(id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id, filename) {
    if (!window.confirm(`Delete "${filename}"? This can't be undone.`)) return;
    setBusyId(id);
    setError('');
    try {
      await api.deleteResume(id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <div>
          <div className="eyebrow">Matching input</div>
          <h1>Your resumes</h1>
          <p>
            Keep up to {MAX_RESUMES} resumes and pick which one is active - the active resume is
            what's used for job ranking and AI match scores. Switch anytime.
          </p>
        </div>
      </div>

      <div className="panel panel-pad" style={{ marginTop: 24, marginBottom: 24 }}>
        <label
          className="btn btn-primary btn-upload"
          style={{
            cursor: uploading || atLimit ? 'not-allowed' : 'pointer',
            opacity: uploading || atLimit ? 0.6 : 1,
          }}
        >
          {uploading ? <span className="spinner" /> : null}
          {uploading ? 'Uploading…' : 'Upload PDF or DOCX'}
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileChange}
            disabled={uploading || atLimit}
          />
        </label>
        <div className="field-hint" style={{ marginTop: 10 }}>
          {atLimit
            ? `You've reached the ${MAX_RESUMES}-resume limit. Delete one below to add another.`
            : `Max 5MB. PDF or DOCX only. ${resumes ? resumes.length : 0}/${MAX_RESUMES} used.`}
        </div>
        <ErrorBanner message={error} />
      </div>

      {loading && <LoadingRow label="Loading your resumes…" />}

      {!loading && (!resumes || resumes.length === 0) && (
        <EmptyState title="No resume yet" hint="Upload one above to start getting AI-scored matches." />
      )}

      {!loading && resumes && resumes.length > 0 && (
        <div className="list">
          {resumes.map((r) => {
            const rowBusy = busyId === r._id;
            return (
              <div key={r._id} className={`panel list-row${r.isActive ? '' : ' list-row-inactive'}`}>
                <div className="list-row-body">
                  <div className="list-row-title">
                    {r.originalFilename} {r.isActive && <span className="list-row-active-tag">· active</span>}
                  </div>
                  <div className="list-row-sub">
                    {r.skills?.length ? `${r.skills.length} skills detected` : 'No skills detected yet'}
                    {r.experienceYears != null && ` · ~${r.experienceYears} yrs experience`}
                  </div>
                </div>
                <div className="list-row-meta">
                  <StatusPill status={r.parseStatus} />
                  <div className="list-row-actions">
                    {!r.isActive && (
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm"
                        disabled={rowBusy || r.parseStatus !== 'parsed'}
                        onClick={() => handleActivate(r._id)}
                        title={r.parseStatus !== 'parsed' ? 'Wait for parsing to finish first' : undefined}
                      >
                        {rowBusy ? 'Switching…' : 'Use this resume'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-quiet btn-sm btn-danger-text"
                      disabled={rowBusy}
                      onClick={() => handleDelete(r._id, r.originalFilename)}
                    >
                      {rowBusy ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}