import IngestionState from '../models/IngestionState.js';

export const ingestionStateRepository = {
  async getCursor(key) {
    const state = await IngestionState.findOne({ key });
    return state ? state.cursor : 0;
  },
  async setCursor(key, cursor) {
    return IngestionState.findOneAndUpdate(
      { key },
      { $set: { cursor } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  },
};
