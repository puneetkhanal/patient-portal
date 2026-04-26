#!/usr/bin/env node

// Test MongoDB Atlas connection
import mongoose from 'mongoose';

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('❌ MONGODB_URI is required.');
  process.exit(1);
}

console.log('🔍 Testing MongoDB Atlas connection...');
console.log('📍 Connection URI:', mongoUri.replace(/:([^:@]{4})[^:@]*@/, ':$1****@')); // Hide password

async function testConnection() {
  try {
    console.log('⏳ Attempting to connect...');

    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('✅ Successfully connected to MongoDB Atlas!');

    // Test database access
    const db = mongoose.connection.db;
    const collections = await db.collections();
    console.log(`📊 Database: ${db.databaseName}`);
    console.log(`📁 Collections found: ${collections.length}`);

    // Test a simple query
    const adminDb = mongoose.connection.db.admin();
    const serverInfo = await adminDb.serverInfo();
    console.log(`🖥️  MongoDB Version: ${serverInfo.version}`);

    await mongoose.disconnect();
    console.log('👋 Disconnected successfully');
    process.exit(0);

  } catch (error) {
    console.error('❌ Connection failed!');
    console.error('Error type:', error.name);
    console.error('Error message:', error.message);

    if (error.message.includes('authentication failed')) {
      console.log('\n🔐 Possible causes:');
      console.log('• Database user password is incorrect');
      console.log('• Database user does not exist');
      console.log('• Database user has insufficient permissions');
    } else if (error.message.includes('getaddrinfo ENOTFOUND')) {
      console.log('\n🌐 Possible causes:');
      console.log('• Cluster URL is incorrect');
      console.log('• DNS resolution failed');
    } else if (error.message.includes('connection timed out')) {
      console.log('\n⏰ Possible causes:');
      console.log('• Network connectivity issues');
      console.log('• Firewall blocking connection');
      console.log('• Cluster is paused or unavailable');
    } else {
      console.log('\n🔍 Other possible causes:');
      console.log('• IP not whitelisted (even if you think it is)');
      console.log('• Cluster region/network issues');
      console.log('• MongoDB Atlas service outage');
    }

    console.log('\n🛠️  Troubleshooting steps:');
    console.log('1. Verify IP whitelisting in MongoDB Atlas');
    console.log('2. Check database user credentials');
    console.log('3. Ensure cluster is running (not paused)');
    console.log('4. Test connection from different network');
    console.log('5. Check MongoDB Atlas status page');

    process.exit(1);
  }
}

testConnection();
