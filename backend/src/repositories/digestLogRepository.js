import DigestLog from '../models/DigestLog.js';

export const digestLogRepository = {
  create(data) {
    return DigestLog.create(data);
  },
  listForUser(userId) {
    return DigestLog.find({ userId }).sort({ sentAt: -1 });
  },
};
