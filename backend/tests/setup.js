import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// The whole suite runs offline: no real database, no real external API
// calls. Each test file that touches Gemini or the mailer must jest.mock()
// them explicitly - this file only handles the database.
let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
