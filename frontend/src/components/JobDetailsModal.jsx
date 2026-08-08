function toPlainText(value) {
  if (!value) return 'The employer did not provide a description for this listing.';
  const element = document.createElement('div');
  element.innerHTML = value;
  return (element.textContent || '').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
}

export default function JobDetailsModal({ job, onClose }) {
  if (!job) return null;
  return (
    <section className="job-details-inline" role="region" aria-labelledby="job-details-title">
      <button className="modal-close" type="button" onClick={onClose} aria-label="Close job details">×</button>
      <div className="eyebrow">{job.source || 'Job listing'}</div>
      <h2 id="job-details-title">{job.title}</h2>
      <p className="job-details-company">{job.company} · {job.location || 'Location not specified'} {job.remote ? '· Remote' : ''}</p>
      <div className="job-description">{toPlainText(job.description)}</div>
      <div className="modal-footer">
        <span>{job.createdAt ? `Posted ${new Date(job.createdAt).toLocaleDateString()}` : 'Active opportunity'}</span>
        <button className="btn" type="button" onClick={onClose}>Close details</button>
      </div>
    </section>
  );
}
