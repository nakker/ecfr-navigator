# Development Guide

This guide covers the development workflow, best practices, and common tasks for working on the eCFR Navigator project.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Development Workflow](#development-workflow)
- [Working with Services](#working-with-services)
- [Code Organization](#code-organization)
- [Common Tasks](#common-tasks)
- [Testing](#testing)
- [Debugging](#debugging)
- [Contributing](#contributing)

## Prerequisites

### Required Software

- **Docker Desktop** (includes Docker Compose)
- **Node.js 18+** (for local development)
- **Git** for version control
- **VS Code** or preferred IDE

### Recommended VS Code Extensions

- Docker
- ESLint
- Prettier
- MongoDB for VS Code
- Thunder Client (API testing)

### System Requirements

- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 20GB free space
- **OS**: Windows (WSL2), macOS, or Linux

## Initial Setup

### 1. Clone and Configure

```bash
# Clone the repository
git clone https://github.com/sam-berry/ecfr-analyzer.git
cd ecfr-analyzer

# Copy environment configuration
cp .env.example .env

# Edit .env with your configuration
# Required: GEMINI_API_KEY and GROK_API_KEY for AI features
```

### 2. Sync Shared Code

The project uses shared modules across services. Always sync after pulling changes:

```bash
./sync-shared.sh
```

### 3. Build and Start Services

```bash
# Quick start (recommended)
./quick-start.sh

# Or manually with docker-compose
docker-compose up -d --build
```

### 4. Verify Services

```bash
# Check all services are running
docker-compose ps

# View logs
docker-compose logs -f

# Check health endpoints
curl http://localhost:3001/health
curl http://localhost:3005/health
```

## Development Workflow

### 1. Service Development Mode

For active development on a specific service:

```bash
# Stop the service in Docker
docker-compose stop frontend

# Run locally with hot reload
cd services/frontend
npm install
npm run dev
```

### 2. Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes to service code**
   - Edit files in `services/[service-name]/`
   - For shared code, edit in `services/shared/` and run `./sync-shared.sh`

3. **Test your changes**
   - Run service locally
   - Test API endpoints
   - Verify UI changes

4. **Rebuild if needed**
   ```bash
   docker-compose build [service-name]
   docker-compose up -d [service-name]
   ```

### 3. Shared Code Management

When modifying shared code:

```bash
# Edit shared code
vi services/shared/models/Document.js

# Sync to all services
./sync-shared.sh

# Rebuild affected services
docker-compose build backend frontend data-refresh data-analysis
docker-compose up -d
```

## Working with Services

### Backend API Service

```bash
# Local development
cd services/backend
npm install
npm run dev  # Runs on port 3001

# Test endpoints
curl http://localhost:3001/api/titles
curl http://localhost:3001/api/search?q=safety

# View API documentation
# See /documentation/API.md
```

### Frontend Service

```bash
# Local development
cd services/frontend
npm install
npm run dev  # Runs on port 3000

# Build for production
npm run build

# Type checking
npm run type-check
```

### Data Refresh Service

```bash
# Trigger manual refresh for a title
curl -X POST http://localhost:3001/api/services/data-refresh/trigger-title \
  -H "Content-Type: application/json" \
  -d '{"titleNumber": 29}'

# Monitor progress
docker-compose logs -f data-refresh
```

### Data Analysis Service

```bash
# Check thread status
curl http://localhost:3001/api/analysis-threads/status

# Start specific thread
curl -X POST http://localhost:3001/api/analysis-threads/section_analysis/start

# View analysis results
curl http://localhost:3001/api/analysis/stats
```

## Code Organization

### Directory Structure

```
ecfr-analyzer/
├── services/
│   ├── shared/          # Shared modules (source)
│   │   ├── db/         # Database connections
│   │   ├── models/     # Mongoose schemas
│   │   └── utils/      # Common utilities
│   ├── backend/        # REST API
│   ├── frontend/       # Next.js app
│   ├── data-refresh/   # XML processing
│   └── data-analysis/  # Metrics generation
├── documentation/      # Project docs
├── mongo-init/        # DB initialization
└── docker-compose.yml # Service orchestration
```

### Naming Conventions

- **Files**: camelCase for JS/TS, PascalCase for React components
- **Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **MongoDB Collections**: camelCase
- **API Routes**: kebab-case

### Code Style

- Use ESLint configuration provided
- 2 spaces for indentation
- Single quotes for strings
- No semicolons (frontend)
- Semicolons required (backend)

## Common Tasks

### Adding a New API Endpoint

1. Create route file in `services/backend/routes/`
2. Add route to `services/backend/index.js`
3. Update API documentation
4. Add frontend API call

Example:
```javascript
// services/backend/routes/myFeature.js
const express = require('express');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    // Implementation
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
```

### Adding a New Frontend Page

1. Create page in `services/frontend/pages/`
2. Add navigation link if needed
3. Create components in `services/frontend/components/`
4. Update TypeScript types if needed

Example:
```tsx
// services/frontend/pages/my-feature.tsx
import { NextPage } from 'next';
import Layout from '../components/Layout';

const MyFeaturePage: NextPage = () => {
  return (
    <Layout>
      <h1>My Feature</h1>
    </Layout>
  );
};

export default MyFeaturePage;
```

### Modifying Database Schema

1. Update model in `services/shared/models/`
2. Run `./sync-shared.sh`
3. Update any affected services
4. Document schema changes

### Adding Environment Variables

1. Add to `.env.example` with description
2. Update service code to use variable
3. Document in service README
4. Update docker-compose.yml if needed

## Testing

### Manual Testing

```bash
# Test API endpoints
curl http://localhost:3001/api/search?q=test

# Test with Postman/Thunder Client
# Import from /documentation/postman-collection.json (if available)

# Browser testing
# Open http://localhost:3000
```

### Database Queries

```bash
# Connect to MongoDB
docker exec -it ecfr-analyzer-mongodb-1 mongosh -u ecfr_admin -p

# Example queries
use ecfr_db
db.titles.find().limit(5)
db.documents.countDocuments()
db.metrics.find({ titleNumber: 29 })
```

### Elasticsearch Queries

```bash
# Check indices
curl http://localhost:9200/_cat/indices

# Search test
curl http://localhost:9200/ecfr_documents/_search?q=safety
```

## Debugging

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# With timestamps
docker-compose logs -f -t data-analysis
```

### Common Issues

1. **Port Already in Use**
   ```bash
   # Find process using port
   lsof -i :3000
   # Kill process
   kill -9 [PID]
   ```

2. **MongoDB Connection Failed**
   ```bash
   # Check MongoDB is running
   docker-compose ps mongodb
   # Restart if needed
   docker-compose restart mongodb
   ```

3. **Shared Code Not Updated**
   ```bash
   # Always run after changes
   ./sync-shared.sh
   # Rebuild services
   docker-compose build
   ```

### Performance Profiling

```bash
# Node.js profiling
node --inspect services/backend/index.js

# MongoDB slow queries
docker exec -it ecfr-analyzer-mongodb-1 mongosh
> db.setProfilingLevel(1, { slowms: 100 })
> db.system.profile.find().limit(5)
```

## Contributing

### Before Submitting

1. **Test your changes thoroughly**
2. **Update documentation** if needed
3. **Check for linting errors**
4. **Ensure services build successfully**

### Pull Request Guidelines

1. **Clear description** of changes
2. **Reference any issues** being fixed
3. **Include screenshots** for UI changes
4. **List any new dependencies**
5. **Note any breaking changes**

### Code Review Checklist

- [ ] Code follows project style guide
- [ ] Shared code is synced properly
- [ ] API changes are documented
- [ ] No sensitive data in code
- [ ] Error handling is appropriate
- [ ] Performance impact considered

## Advanced Topics

### Running Specific Titles Only

For faster development, process only specific titles:

```bash
# Modify data-refresh to process single title
# Edit RefreshService.js to filter titles
```

### Custom Development Stack

```bash
# Run only core services
docker-compose up -d mongodb elasticsearch

# Run other services locally
cd services/backend && npm run dev
cd services/frontend && npm run dev
```

### Database Migrations

```bash
# Backup before migrations
docker exec ecfr-analyzer-mongodb-1 mongodump --out /backup

# Run migration scripts
node scripts/migrate-v1-to-v2.js
```

## Troubleshooting Development Issues

See [Troubleshooting Guide](./TROUBLESHOOTING.md) for detailed solutions to common problems.

## Additional Resources

- [Architecture Overview](./ARCHITECTURE.md)
- [API Documentation](./API.md)
- [Deployment Guide](./DEPLOY.md)
- [Service-specific READMEs](../services/)