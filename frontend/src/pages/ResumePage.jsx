import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { LoadingRow, ErrorBanner, EmptyState } from '../components/Feedback.jsx';

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

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <div>
          <div className="eyebrow">Matching input</div>
          <h1>Your resume</h1>
          <p>Only your most recent upload is used for matching. Uploading a new one replaces the active resume.</p>
        </div>
      </div>

      <div className="panel panel-pad" style={{ marginTop: 24, marginBottom: 24 }}>
        <label className="btn btn-primary btn-upload" style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
          {uploading ? <span className="spinner" /> : null}
          {uploading ? 'Uploading…' : 'Upload PDF or DOCX'}
          <input type="file" accept=".pdf,.docx" onChange={handleFileChange} disabled={uploading} />
        </label>
        <div className="field-hint" style={{ marginTop: 10 }}>Max 5MB. PDF or DOCX only.</div>
        <ErrorBanner message={error} />
      </div>

      {loading && <LoadingRow label="Loading your resumes…" />}

      {!loading && (!resumes || resumes.length === 0) && (
        <EmptyState title="No resume yet" hint="Upload one above to start getting AI-scored matches." />
      )}

      {!loading && resumes && resumes.length > 0 && (
        <div className="list">
          {resumes.map((r) => (
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
              <StatusPill status={r.parseStatus} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
