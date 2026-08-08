import mongoose from 'mongoose';

// Persists the rotation cursor per ingestion source so a server restart
// doesn't reset progress through the (query x country) pair list.
const ingestionStateSchema = new mongoose.Schema(
  {
    key: { type: String, enum: ['adzuna', 'jooble'], required: true, unique: true },
    cursor: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('IngestionState', ingestionStateSchema);
