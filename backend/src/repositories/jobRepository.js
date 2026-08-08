import mongoose from 'mongoose';
import Job from '../models/Job.js';

export const jobRepository = {
  // Dedupe on write: upsert by (source, externalId). Manual/seed jobs have no
  // externalId and are simply inserted.
  async upsertFromSource({ source, externalId, ...fields }) {
    if (!externalId) {
      return Job.create({ source, externalId: null, ...fields });
    }
    return Job.findOneAndUpdate(
      { source, externalId },
      { $set: { source, externalId, ...fields, lastConfirmedAt: new Date(), isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  },
  findByIdActive(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    return Job.findOne({ _id: id, isActive: true });
  },
  findById(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    return Job.findById(id);
  },
  // When `search` is set, uses the weighted text index (title > skills >
  // company > description) and ranks by MongoDB's text relevance score -
  // this is what makes "data science" surface data-science jobs first
  // instead of any job that happens to mention both words anywhere.
  // Without a search term, falls back to newest-first like before.
  listActive({ skip = 0, limit = 20, country = '', search = '' } = {}) {
    const filter = { isActive: true };
    if (country) filter.country = country;

    if (search) {
      filter.$text = { $search: search };
      return Job.find(filter, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(limit);
    }
    return Job.find(filter).sort({ postedAt: -1 }).skip(skip).limit(limit);
  },
  countActive({ country = '', search = '' } = {}) {
    const filter = { isActive: true };
    if (country) filter.country = country;
    if (search) filter.$text = { $search: search };
    return Job.countDocuments(filter);
  },
  // Distinct list of country codes present in the active job pool, for the
  // Jobs page's country filter dropdown. Empty string (unspecified/remote)
  // is filtered out here and handled as an explicit "no country" option.
  async listActiveCountries() {
    const countries = await Job.distinct('country', { isActive: true });
    return countries.filter(Boolean).sort();
  },
  mostRecentlyUpdated() {
    return Job.findOne({ isActive: true }).sort({ updatedAt: -1 }).select('updatedAt');
  },
  listActiveIdsNotIn(excludeJobIds) {
    return Job.find({ isActive: true, _id: { $nin: excludeJobIds } });
  },
  // Deactivate (never delete) postings no ingestion source has confirmed
  // recently. Manual postings are excluded - a human vouched for those.
  deactivateStale(staleBeforeDate) {
    return Job.updateMany(
      { source: { $ne: 'manual' }, lastConfirmedAt: { $lt: staleBeforeDate }, isActive: true },
      { $set: { isActive: false } }
    );
  },
};