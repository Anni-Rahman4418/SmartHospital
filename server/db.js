import mongoose from 'mongoose';
import { Hospital, Slot } from './models.js';
import { seed, dhakaTodayStr, addDays } from './seed.js';

// Vercel reuses a warm function between requests, so keep one connection.
const cache = globalThis.__smartHospitalDb || (globalThis.__smartHospitalDb = { conn: null, promise: null });

export async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw Object.assign(new Error('MONGODB_URI is not set'), { code: 'NO_URI' });
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(uri, { bufferCommands: false, serverSelectionTimeoutMS: 8000 })
      .then(async (m) => {
        // Fill an empty database, or refill it when the sample slots are about to run out.
        const soon = addDays(dhakaTodayStr(), 3);
        const empty = (await Hospital.estimatedDocumentCount()) === 0;
        const running = await Slot.exists({ date: { $gte: soon } });
        if (empty || !running) console.log('Seeded demo data:', await seed());
        return m;
      });
  }
  try {
    cache.conn = await cache.promise;
  } catch (e) {
    cache.promise = null; // allow a retry on the next request
    throw e;
  }
  return cache.conn;
}
