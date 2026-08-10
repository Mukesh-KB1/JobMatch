import dns from 'dns';
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import mongoose from 'mongoose';
import { config } from './env.js';

export async function connectDB(uri = config.mongoUri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    // Without these, a slow/unreachable Atlas cluster (common on the free
    // M0 tier under load) leaves individual queries pending indefinitely -
    // which is exactly what showed up as the frontend stuck on "Loading
    // your resumes..." forever. Now a stalled query fails within ~10s with
    // a real error instead of hanging until the user manually refreshes.
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 20000,
  });
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}