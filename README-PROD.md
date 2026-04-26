# Production Deployment Guide

This guide explains how to deploy the Patient Portal application to production using MongoDB Atlas.

## Environment Setup

### 1. Environment Variables

Copy and configure the production environment file:

```bash
cp env.prod.example env.prod
```

Edit `env.prod` and update the following critical values:

```bash
MONGODB_URI=mongodb+srv://USER:PASSWORD@HOST/?appName=APP

# Generate strong secrets for production
JWT_SECRET=replace-with-a-long-random-production-secret

# Optional initial admin seed
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-temporary-strong-password
ADMIN_MUST_CHANGE_PASSWORD=true

# Configure email settings
SMTP_USER=
SMTP_PASS=
```

### 2. MongoDB Atlas Setup

1. **Whitelist IP Addresses**: In MongoDB Atlas, go to Network Access and add your server's IP address (or 0.0.0.0/0 for testing).

2. **Database User**: Ensure the database user in `MONGODB_URI` exists and has appropriate permissions.

3. **Database Name**: The application will use/create a database named `patient_portal`.

## Deployment

### Using Docker Compose (Production)

```bash
# First, run diagnostics to check your setup
./diagnose-mongo.sh

# If diagnostics pass, deploy
./deploy-prod.sh

# Or deploy manually
docker-compose -f docker-compose.prod.yml up --build -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f app

# Stop the application
docker-compose -f docker-compose.prod.yml down
```

### Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `production` | Yes |
| `PORT` | Application port | `3000` | Yes |
| `MONGODB_URI` | MongoDB Atlas connection string | - | Yes |
| `DB_NAME` | Database name | `patient_portal` | No |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `JWT_EXPIRES_IN` | JWT expiration time | `7d` | No |
| `ADMIN_MUST_CHANGE_PASSWORD` | Require optional seeded admin to change password after first login | `true` in production | No |
| `SMTP_HOST` | SMTP server host | - | No |
| `SMTP_PORT` | SMTP server port | `587` | No |
| `SMTP_USER` | SMTP username | - | No |
| `SMTP_PASS` | SMTP password | - | No |

## Security Checklist

Before deploying to production:

- [ ] **MongoDB Atlas IP Whitelist**: Add your server IP to MongoDB Atlas network access
- [ ] Change `JWT_SECRET` to a strong, unique secret
- [ ] Update MongoDB Atlas password in `MONGODB_URI`
- [ ] If using `ADMIN_EMAIL`/`ADMIN_PASSWORD` for first deploy, rotate or remove them after creating real users
- [ ] Keep `ADMIN_MUST_CHANGE_PASSWORD=true` for production seed accounts
- [ ] Configure SMTP settings for email functionality
- [ ] Set up proper firewall rules
- [ ] Enable HTTPS/SSL
- [ ] Configure rate limiting if needed
- [ ] Set up monitoring and logging
- [ ] Backup strategy for MongoDB Atlas

## Health Checks

The application includes health check endpoints:

- `GET /api/health` - Application health status
- Health checks are configured in Docker Compose for automatic restarts

## Monitoring

Monitor these key metrics in production:

- Application logs: `docker-compose -f docker-compose.prod.yml logs -f app`
- MongoDB Atlas dashboard for database performance
- Application response times and error rates

## Troubleshooting

### Common Issues

1. **MongoDB Atlas Connection Failed (IP Whitelist)**
   - **Error**: "Could not connect to any servers in your MongoDB Atlas cluster"
   - **Solution**: Add your server IP to MongoDB Atlas Network Access
   - **Quick IP Check**: Run `./get-ip.sh` to get your public IP
   - **Steps**:
     1. Run: `./get-ip.sh` (shows your public IP)
     2. Go to MongoDB Atlas Dashboard → Network Access
     3. Click "Add IP Address"
     4. Enter your IP from step 1 (e.g., `123.45.67.89/32`)
     5. Or temporarily allow "0.0.0.0/0" for testing (⚠️ insecure for production)
   - **Docker Note**: If running in Docker, use the host server's public IP, not container IP

2. **MongoDB Connection Failed**
   - Check `MONGODB_URI` is correct and password is updated
   - Ensure database user has correct permissions
   - Verify cluster is running and accessible

2. **Application Won't Start**
   - Check environment variables are loaded
   - Verify port 3000 is not in use
   - Check application logs for errors

3. **Health Check Failures**
   - Ensure application is fully started before health checks
   - Check network connectivity between containers

## File Structure

```
.
├── env.prod.example            # Production environment template
├── env.prod                    # Local production environment file (ignored by git)
├── docker-compose.prod.yml     # Production Docker Compose
├── deploy-prod.sh              # Automated deployment script
├── diagnose-mongo.sh           # MongoDB connection diagnostic script
├── test-mongo-connection.js    # Node.js MongoDB connection test
├── get-ip.sh                   # IP detection script for MongoDB Atlas
├── server/src/db/config.ts     # Updated to support MONGODB_URI
├── server/src/config/env.ts    # Updated to load env.prod
└── README-PROD.md             # This file
```
