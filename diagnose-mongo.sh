#!/bin/bash

# MongoDB Atlas Connection Diagnostic Script

echo "🔍 MongoDB Atlas Connection Diagnostic"
echo "======================================"
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js to run diagnostics."
    exit 1
fi

# Check if env.prod exists
if [ ! -f "env.prod" ]; then
    echo "❌ env.prod file not found!"
    exit 1
fi

# Load environment variables from env.prod
export $(grep -v '^#' env.prod | xargs)

echo "📋 Configuration Check:"
echo "• MongoDB URI: configured"
echo "• Database Name: $DB_NAME"
echo ""

# Test 1: Basic connectivity
echo "🧪 Test 1: Basic Network Connectivity"
echo "-------------------------------------"

# Extract host from MongoDB URI
MONGODB_HOST=$(echo $MONGODB_URI | sed -n 's/mongodb+srv:\/\/[^@]*@\([^/?]*\).*/\1/p')

if [ -n "$MONGODB_HOST" ]; then
    echo "🌐 Pinging MongoDB Atlas cluster: $MONGODB_HOST"

    # Test DNS resolution
    if nslookup $MONGODB_HOST &> /dev/null; then
        echo "✅ DNS resolution successful"
    else
        echo "❌ DNS resolution failed"
        echo "   This might indicate network issues or incorrect cluster URL"
    fi

    # Test basic connectivity (this might not work due to MongoDB Atlas security)
    if nc -z -w5 $MONGODB_HOST 27017 &> /dev/null; then
        echo "✅ Port 27017 is accessible"
    else
        echo "⚠️  Port 27017 not accessible (expected for MongoDB Atlas)"
        echo "   This is normal - Atlas uses dynamic ports"
    fi
else
    echo "❌ Could not extract host from MONGODB_URI"
fi

echo ""

# Test 2: MongoDB Connection
echo "🧪 Test 2: MongoDB Connection Test"
echo "----------------------------------"

if node test-mongo-connection.js; then
    echo ""
    echo "🎉 MongoDB connection test PASSED!"
    echo "Your setup should work. Try deploying again:"
    echo "  ./deploy-prod.sh"
else
    echo ""
    echo "❌ MongoDB connection test FAILED!"
    echo ""
    echo "🔧 Most Common Fixes:"
    echo ""
    echo "1. Double-check IP whitelisting:"
    echo "   - Go to MongoDB Atlas → Network Access"
    echo "   - Ensure your current IP is listed"
    echo "   - Try adding 0.0.0.0/0 temporarily for testing"
    echo ""
    echo "2. Verify database user credentials:"
    echo "   - MongoDB Atlas → Database Access"
    echo "   - Check that the database user from MONGODB_URI exists"
    echo "   - Reset password if needed"
    echo ""
    echo "3. Check cluster status:"
    echo "   - MongoDB Atlas → Clusters"
    echo "   - Ensure cluster is running (not paused)"
    echo "   - Check cluster region matches your location"
    echo ""
    echo "4. Verify connection string:"
    echo "   - Confirm MONGODB_URI starts with 'mongodb+srv://'"
    echo "   - Should start with 'mongodb+srv://'"
    echo "   - Should include '?appName=Cluster0'"
    echo ""
    echo "5. Network/Firewall issues:"
    echo "   - Try from a different network"
    echo "   - Check if VPN/proxy is interfering"
    echo "   - Verify outbound connections to port 27017+ are allowed"
fi

echo ""
echo "📞 Still having issues? Check:"
echo "• MongoDB Atlas status: https://status.mongodb.com/"
echo "• Your cluster metrics in Atlas dashboard"
echo "• Try connecting with MongoDB Compass using the same URI"
