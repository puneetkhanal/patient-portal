import mongoose from 'mongoose';
import '../config/env.js'; // Load .env file

/**
 * Get MongoDB connection URL from environment variables
 */
export function getMongoDBUrl(): string {
  // Check for full MongoDB URI first (for Atlas/production)
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    return mongoUri;
  }

  // Fallback to individual components (for local development)
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '27017';
  const database = process.env.DB_NAME || 'patient_portal';

  // For Docker, use the service name
  if (host === 'db') {
    return `mongodb://${host}:${port}/${database}`;
  }

  // For local development
  return `mongodb://${host}:${port}/${database}`;
}

/**
 * Connect to MongoDB
 */
export async function connectMongoDB(): Promise<void> {
  try {
    const mongoUrl = getMongoDBUrl();
    console.log('🔄 Connecting to MongoDB...');
    console.log('📍 MongoDB URL:', mongoUrl.replace(/:([^:@]{4})[^:@]*@/, ':$1****@')); // Hide password

    await mongoose.connect(mongoUrl, {
      // Modern Mongoose doesn't need these options, but keeping for compatibility
    });

    console.log('✅ Connected to MongoDB');

    // Create indexes
    await createIndexes();

  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

/**
 * Create database indexes
 */
async function createIndexes(): Promise<void> {
  try {
    const { User, Patient } = await import('../models/index.js');

    // Create indexes for better performance
    await User.createIndexes();
    await Patient.createIndexes();

    console.log('✅ Database indexes created');
  } catch (error) {
    console.warn('⚠️  Failed to create indexes:', error);
  }
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectMongoDB(): Promise<void> {
  try {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error disconnecting from MongoDB:', error);
  }
}

/**
 * Check if MongoDB is connected
 */
export function isMongoDBConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

