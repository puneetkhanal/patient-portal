import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';

import { createApp } from '../app.js';
import { connectMongoDB, disconnectMongoDB } from './db/config.js';
import { Settings, User, UserRole } from './models/index.js';

const PORT = process.env.PORT || 3000;

async function seedInitialData() {
  const adminPassword = await bcrypt.hash('123456', 10);
  await User.findOneAndUpdate(
    { email: 'admin@example.com' },
    {
      email: 'admin@example.com',
      name: 'Admin',
      password_hash: adminPassword,
      role: UserRole.SUPER_ADMIN,
      isActive: true
    },
    { upsert: true, new: true }
  );

  const existingSettings = await Settings.findOne({});
  if (!existingSettings) {
    await Settings.create({});
  }
}

async function start() {
  const mongo = await MongoMemoryServer.create({
    binary: {
      version: process.env.MONGOMS_VERSION || '7.0.3'
    }
  });
  const uri = mongo.getUri();
  process.env.MONGODB_URI = uri;
  process.env.NODE_ENV = 'production';

  await connectMongoDB();
  await seedInitialData();

  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`🚀 E2E server running on http://localhost:${PORT}`);
  });

  const shutdown = async () => {
    server.close();
    await disconnectMongoDB();
    await mongo.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error('❌ Failed to start E2E server:', error);
  process.exit(1);
});
