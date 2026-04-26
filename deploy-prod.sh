#!/bin/bash

# Production Deployment Script for Patient Portal
# This script helps deploy the application to production with MongoDB Atlas

set -e  # Exit on any error

echo "🚀 Patient Portal Production Deployment"
echo "========================================"

# Check if env.prod exists
if [ ! -f "env.prod" ]; then
    echo "❌ Error: env.prod file not found!"
    echo "Please create env.prod with your production environment variables."
    exit 1
fi

# Check if required environment variables are set
echo "📋 Checking environment configuration..."

if ! grep -q "MONGODB_URI=mongodb+srv://" env.prod; then
    echo "⚠️  Warning: MONGODB_URI not configured in env.prod"
    echo "Please update env.prod with your MongoDB Atlas connection string."
fi

if grep -q "your-production-super-secret-jwt-key-change-this-immediately" env.prod; then
    echo "⚠️  Warning: JWT_SECRET is still using default value"
    echo "Please update JWT_SECRET in env.prod for security."
fi

# Build and deploy
echo "🏗️  Building and deploying application..."
docker-compose -f docker-compose.prod.yml down || true
docker-compose -f docker-compose.prod.yml up --build -d

# Wait for application to be ready
echo "⏳ Waiting for application to start..."
sleep 30

# Check health
echo "🏥 Checking application health..."
if curl -f -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ Application is healthy!"
    echo ""
    echo "🌐 Application is running at: http://localhost:3000"
    echo "📊 View logs: docker-compose -f docker-compose.prod.yml logs -f app"
    echo "🛑 Stop application: docker-compose -f docker-compose.prod.yml down"
else
    echo "❌ Application health check failed!"
    echo "Check logs: docker-compose -f docker-compose.prod.yml logs app"
    exit 1
fi

echo ""
echo "🎉 Production deployment completed successfully!"
