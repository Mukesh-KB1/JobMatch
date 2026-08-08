import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    company: { type: String, default: 'Unknown' },
    location: { type: String, default: '' },
    country: { type: String, default: '' },
    description: { type: String, default: '' },
    requiredSkills: { type: [String], default: [] },

    source: { type: String, enum: ['adzuna', 'jooble', 'arbeitnow', 'manual', 'seed'], required: true },
    // External id from the source API. Absent for manually-created jobs.
    externalId: { type: String, default: null },

    applyUrl: { type: String, required: true },
    salary: { type: String, default: null },
    remote: { type: Boolean, default: false },
    postedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },

    // Bumped every time an ingestion run re-confirms this listing still exists.
    // Used by the stale-job sweep - never delete a job, just deactivate it.
    lastConfirmedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Dedupe on write: re-ingesting the same external listing upserts in place.
// Sparse so multiple manual/seed jobs (externalId: null) don't collide.
jobSchema.index({ source: 1, externalId: 1 }, { unique: true, sparse: true });
jobSchema.index({ isActive: 1, postedAt: -1 });
jobSchema.index({ requiredSkills: 1 });
// Weighted full-text index for the job search bar. Title matches count for
// far more than a stray word buried in the description (e.g. searching
// "data science" shouldn't surface a job just because its requirements
// section says "Bachelor's in Computer Science" and "data protection").
jobSchema.index(
  { title: 'text', requiredSkills: 'text', company: 'text', description: 'text' },
  { weights: { title: 10, requiredSkills: 6, company: 3, description: 1 }, name: 'JobTextIndex' }
);

export default mongoose.model('Job', jobSchema);
