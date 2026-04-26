#!/bin/bash

# Script to get current public IP for MongoDB Atlas whitelisting

echo "🔍 Getting your public IP address for MongoDB Atlas whitelisting..."
echo ""

# Try multiple services to get public IP
PUBLIC_IP=""

# Method 1: ifconfig.me
if command -v curl &> /dev/null; then
    PUBLIC_IP=$(curl -s https://ifconfig.me 2>/dev/null)
fi

# Method 2: icanhazip.com
if [ -z "$PUBLIC_IP" ] && command -v curl &> /dev/null; then
    PUBLIC_IP=$(curl -s https://icanhazip.com 2>/dev/null)
fi

# Method 3: ipinfo.io
if [ -z "$PUBLIC_IP" ] && command -v curl &> /dev/null; then
    PUBLIC_IP=$(curl -s https://ipinfo.io/ip 2>/dev/null)
fi

# Method 4: dig
if [ -z "$PUBLIC_IP" ] && command -v dig &> /dev/null; then
    PUBLIC_IP=$(dig +short myip.opendns.com @resolver1.opendns.com 2>/dev/null)
fi

if [ -n "$PUBLIC_IP" ]; then
    echo "✅ Your public IP address is: $PUBLIC_IP"
    echo ""
    echo "📋 MongoDB Atlas Whitelist Steps:"
    echo "1. Go to: https://cloud.mongodb.com/"
    echo "2. Navigate to your project → Network Access"
    echo "3. Click 'Add IP Address'"
    echo "4. Enter: $PUBLIC_IP/32"
    echo "5. Add a description like 'Production Server'"
    echo "6. Click 'Confirm'"
    echo ""
    echo "⚠️  Note: If running on a cloud provider (AWS, GCP, etc.),"
    echo "   the IP might change. Consider using their static IP service."
    echo ""
    echo "🧪 For testing only: You can temporarily allow '0.0.0.0/0'"
    echo "   but this is INSECURE for production use!"
else
    echo "❌ Could not determine your public IP address."
    echo "Please check your internet connection or manually get your IP from:"
    echo "- https://whatismyipaddress.com/"
    echo "- https://ifconfig.me/"
    echo "- https://icanhazip.com/"
fi