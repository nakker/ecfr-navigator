FROM node:18-alpine

WORKDIR /app

# Copy backend package files first
COPY ./backend/package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy backend application code
COPY ./backend .

# Copy shared modules after to avoid overwriting
COPY ./shared /app/shared

# Set environment
ENV NODE_ENV=production
ENV SERVICE_NAME=backend

# Expose port
EXPOSE 3001

# Start the service
CMD ["node", "index.js"]