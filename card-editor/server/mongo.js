import mongoose from 'mongoose';

let isConnected = false;

export async function connectMongo() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set');
  }

  if (isConnected) return mongoose.connection;

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
  });

  isConnected = true;
  return mongoose.connection;
}
