FROM node:18-alpine AS builder

WORKDIR /app

# Copy frontend package files
COPY ./frontend/package*.json ./

# Install dependencies
RUN npm install

# Copy frontend application code
COPY ./frontend .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY ./frontend/package*.json ./

# Install only production dependencies
# Using npm ci for faster, more reliable builds
RUN npm ci --omit=dev

# Copy built application from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Set environment
ENV NODE_ENV=production
ENV SERVICE_NAME=frontend

# Expose port
EXPOSE 3000

# Start the service with standalone
CMD ["node", "server.js"]