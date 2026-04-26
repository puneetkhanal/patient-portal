# Single unified Dockerfile - Node.js serves both API and React app
FROM node:24 AS builder

WORKDIR /app

# Install root dependencies
COPY package*.json ./
RUN npm ci

# Install client dependencies
COPY client/package*.json ./client/
RUN npm ci --prefix client

# Copy source files
COPY . .

# Build the React app
RUN npm run build --prefix client

# Production stage
FROM node:24

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (not --only=production)
RUN npm ci

# Copy server source
COPY server ./server
COPY tsconfig.server.json ./

# Copy built React app
COPY --from=builder /app/client/dist ./client/dist

# Set production mode
ENV NODE_ENV=production
ENV PORT=3000

# Expose single port
EXPOSE 3000

# Verify tsx is installed
RUN npx tsx --version

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/api/health || exit 1

# Start the server
CMD ["npx", "tsx", "server/index.ts"]