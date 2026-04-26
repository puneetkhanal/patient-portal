// Load environment variables first
import './src/config/env.js';

import { createApp } from './app.js';
import { connectMongoDB } from './src/db/config.js';
import { User, UserRole, Settings } from './src/models/index.js';
import bcrypt from 'bcryptjs';

const PORT = process.env.PORT || 3000;

// Create app
const app = createApp();

function shouldSeedAdminRequirePasswordChange(): boolean {
  if (process.env.ADMIN_MUST_CHANGE_PASSWORD !== undefined) {
    return process.env.ADMIN_MUST_CHANGE_PASSWORD.toLowerCase() === 'true';
  }

  return process.env.NODE_ENV === 'production';
}

/**
 * Seed initial data
 */
async function seedInitialData(): Promise<void> {
  try {
    const defaultAdminEmail = process.env.NODE_ENV === 'production' ? undefined : 'admin@example.com';
    const defaultAdminPassword = process.env.NODE_ENV === 'production' ? undefined : 'development-admin-password';
    const adminEmail = process.env.ADMIN_EMAIL || defaultAdminEmail;
    const adminPasswordValue = process.env.ADMIN_PASSWORD || defaultAdminPassword;

    if (adminEmail && adminPasswordValue) {
      const adminPassword = await bcrypt.hash(adminPasswordValue, 10);
      await User.findOneAndUpdate(
        { email: adminEmail },
        {
          email: adminEmail,
          name: process.env.ADMIN_NAME || 'Admin',
          password_hash: adminPassword,
          role: UserRole.SUPER_ADMIN,
          isActive: true,
          mustChangePassword: shouldSeedAdminRequirePasswordChange()
        },
        { upsert: true, new: true }
      );
      console.log('✅ Admin user ensured');
    } else {
      console.log('ℹ️  Initial admin seed skipped; set ADMIN_EMAIL and ADMIN_PASSWORD to enable it');
    }

    const existingSettings = await Settings.findOne({});
    if (!existingSettings) {
      await Settings.create({});
      console.log('✅ Default settings ensured');
    }
  } catch (error) {
    console.warn('⚠️  Failed to seed initial data:', error);
  }
}

// Initialize database and start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectMongoDB();

    // Seed initial data
    await seedInitialData();

    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📱 React dev server: http://localhost:5173`);
    }
  });
}

startServer();
