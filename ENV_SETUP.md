# Environment Variables Setup

This project uses ignored local environment files for configuration. Do not commit real `.env` or `env.prod` files.

## Local Development

```bash
cp .env.example .env
```

Edit `.env`:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/patient_portal
DB_NAME=patient_portal
JWT_SECRET=replace-with-a-local-development-secret
JWT_EXPIRES_IN=7d
```

Optional development admin seed:

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-this-password
ADMIN_NAME=Admin
ADMIN_MUST_CHANGE_PASSWORD=false
```

## Production

```bash
cp env.prod.example env.prod
```

Set production values outside git:

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://USER:PASSWORD@HOST/?appName=APP
JWT_SECRET=replace-with-a-long-random-production-secret
ADMIN_MUST_CHANGE_PASSWORD=true
```

If you use `ADMIN_EMAIL` and `ADMIN_PASSWORD` to seed the first production admin, keep `ADMIN_MUST_CHANGE_PASSWORD=true`, then rotate or remove the seed values after creating real users.

## Security Notes

- Never commit real `.env` or `env.prod` files.
- Use different credentials for development and production.
- Use a long random `JWT_SECRET` in production.
- Prefer your hosting provider's secret manager for production values.
- Rotate any credential that has ever been committed or shared.
