import dns from 'dns';
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import mongoose from 'mongoose';
import { config } from './env.js';

export async function connectDB(uri = config.mongoUri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
