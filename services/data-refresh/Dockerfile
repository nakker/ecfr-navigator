FROM node:18-alpine

WORKDIR /app

# Copy data-refresh package files first
COPY ./data-refresh/package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy data-refresh application code
COPY ./data-refresh .

# Copy shared modules after to avoid overwriting
COPY ./shared /app/shared

# Create data directory
RUN mkdir -p /data

# Set environment
ENV NODE_ENV=production
ENV SERVICE_NAME=data-refresh

# Expose health check port
EXPOSE 3005

# Start the service with increased memory limit
CMD ["node", "--max-old-space-size=8192", "index.js"]