# Patient Portal

A full-stack TypeScript application for patient registration, document management, weekly transfusion requests, transfusion planning, confirmations, reports, and role-based user management.

## Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **Database**: MongoDB with Mongoose
- **Frontend**: React, TypeScript, Vite
- **Testing**: Vitest, Supertest, MongoDB Memory Server, Playwright
- **Deployment**: Docker and Docker Compose

## Project Structure

```text
patient_portal/
├── server/                    # Express API and MongoDB models
│   ├── app.ts                 # Express app factory and route mounting
│   ├── index.ts               # Production/dev server entry point
│   └── src/
│       ├── auth/              # Authentication and authorization
│       ├── models/            # Mongoose models
│       ├── routes/            # API routes
│       ├── services/          # Domain services
│       └── db/                # Database configuration and repositories
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── utils/
│   │   └── App.tsx
│   └── vite.config.ts
├── e2e/                       # Playwright tests
├── scripts/                   # E2E helper scripts
├── .env.example               # Local development environment template
├── env.prod.example           # Production environment template
├── docker-compose.unified.yml # Recommended local Docker stack
└── package.json               # Root scripts and server dependencies
```

## Getting Started

### Prerequisites

- Node.js 20+ and npm
- MongoDB for local development, or Docker Compose

### Install

```bash
npm run install:all
cp .env.example .env
```

Edit `.env` with local settings. At minimum, set:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/patient_portal
DB_NAME=patient_portal
JWT_SECRET=replace-with-a-local-development-secret
JWT_EXPIRES_IN=7d
```

Optional local admin seed:

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-this-password
ADMIN_NAME=Admin
ADMIN_MUST_CHANGE_PASSWORD=false
```

## Development

Run the backend and frontend dev servers:

```bash
npm run dev
```

This starts:

- API server: `http://localhost:3000`
- React dev server: `http://localhost:5173`

The server auto-loads `.env`, connects to MongoDB, ensures default settings exist, and optionally seeds an admin user if `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set.

## Scripts

| Script | Description |
| --- | --- |
| `npm run install:all` | Install root and client dependencies |
| `npm run dev` | Run backend and frontend dev servers |
| `npm run server:dev` | Run only the backend with `tsx watch` |
| `npm run client:dev` | Run only the Vite frontend |
| `npm run build:server` | Type-check/build server TypeScript |
| `npm run build:client` | Type-check/build the React app |
| `npm run build` | Run server and client builds |
| `npm start` | Start the production-mode server |
| `npm test` | Run Vitest tests |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:coverage` | Run Vitest with coverage |
| `npm run e2e` | Run Playwright tests |
| `npm run e2e:install` | Install Playwright browsers |
| `npm run lint:all` | Run server and client lint scripts |

## API Overview

Routes are mounted under `/api`.

| Area | Endpoints |
| --- | --- |
| Health | `GET /api/health` |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/change-password` |
| Patients | `GET /api/patients`, `GET /api/patients/:id`, `POST /api/patients`, `PUT /api/patients/:id`, `DELETE /api/patients/:id`, patient document endpoints, patient statistics |
| Documents | Upload, list, verify, reject, download, stats, and delete document endpoints under `/api/documents` |
| Users | `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id/deactivate` |
| Settings | `GET /api/settings`, `PUT /api/settings` |
| Weekly requests | Availability, create, list, and delete endpoints under `/api/weekly-requests` |
| Weekly plans | Create, list, read, delete, summary, and send-email endpoints under `/api/weekly-plans` |
| Plan items | Update and confirm endpoints under `/api/plan-items` |
| Reports | Transfusion frequency, shortage, and hospital load endpoints under `/api/reports` |
| Transfusion records | List and delete endpoints under `/api/transfusion-records` |

Most application endpoints require authentication and role/permission checks.

## Database

The app uses MongoDB through Mongoose. `MONGODB_URI` is preferred for both local and production configuration.

```env
MONGODB_URI=mongodb://localhost:27017/patient_portal
```

For production, use a secret-managed MongoDB Atlas or equivalent connection string:

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@HOST/?appName=APP
```

See [server/src/db/README.md](server/src/db/README.md) and [ENV_SETUP.md](ENV_SETUP.md) for more environment details.

## Docker

### Recommended Local Stack

Use the unified compose file when you want the app and MongoDB together:

```bash
docker compose -f docker-compose.unified.yml up --build
```

App URL: `http://localhost:3000`

### Production Template

Create a local production env file and deploy with the production compose file:

```bash
cp env.prod.example env.prod
./deploy-prod.sh
```

`env.prod` is ignored by git. Do not commit real production secrets.

### Other Compose Files

| File | Purpose |
| --- | --- |
| `docker-compose.unified.yml` | Recommended app + MongoDB stack |
| `docker-compose.prod.yml` | Production app container using `env.prod` |
| `docker-compose.e2e.yml` | E2E stack with MongoDB container |
| `docker-compose.e2e-memory.yml` | E2E stack using MongoDB Memory Server |
| `docker-compose.yml` | Legacy split frontend/backend stack |
| `docker-compose.dev.yml` | Legacy split frontend/backend development stack |

## Testing

Run the unit and integration suite:

```bash
npm test
```

Run Playwright E2E tests after installing browsers:

```bash
npm run e2e:install
npm run e2e
```

The repository also includes helper scripts in `scripts/` for Docker-backed E2E runs.

## Production Notes

- `JWT_SECRET` is required in production.
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` are optional seed values. If used for first deployment, rotate or remove them after creating real users.
- `ADMIN_MUST_CHANGE_PASSWORD` controls whether the optional seeded admin must change password after first login. It defaults to `true` in production and `false` outside production when unset.
- Uploaded files are stored under the configured upload path and should be backed by durable storage in production.
- Email sending uses SMTP settings when configured; otherwise the email service falls back to JSON transport.
- If any real secret was ever committed, rotate it and purge it from git history before making the repository public.

## Current Validation Notes

The Vitest suite passes with `npm test`.

Run `npm run lint:all`, `npm run build:server`, and `npm run build:client` before release.
