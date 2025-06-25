FROM node:18-alpine

WORKDIR /app

# Copy data-analysis package files first
COPY ./data-analysis/package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy data-analysis application code
COPY ./data-analysis .

# Copy shared modules after to avoid overwriting
COPY ./shared /app/shared

# Set environment
ENV NODE_ENV=production
ENV SERVICE_NAME=data-analysis

# Expose internal API port
EXPOSE 3003

# Start the service
CMD ["node", "index.js"]