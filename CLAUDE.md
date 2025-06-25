# eCFR Analyzer Project

https://github.com/sam-berry/ecfr-analyzer

## Purpose
The United States Federal Government has over 200,000 pages of federal regulations across ~150 main agencies, all of which can be found within the eCFR at https://www.ecfr.gov/. There is a public API for it which can be found at this website https://www.ecfr.gov/developers/documentation/api/v1.

The goal is to create a simple website to analyze Federal Regulations to allow for more digestible and actionable insights to be made on potential deregulation efforts across the government.

## Current Status - Tasks Completed ✅

### Infrastructure
- ✅ Created project structure with docker-compose.yml
- ✅ Set up MongoDB container with schema initialization
- ✅ **REPLACED OpenSearch with Elasticsearch** (simpler setup, no security warnings)
- ✅ Created base Node.js service structure for all 4 services
- ✅ Implemented shared modules system
- ✅ Created .env configuration and documentation

### Services Implemented
- ✅ **Data Refresh Service**: Downloads XML from govinfo.gov, parses, stores in MongoDB, indexes in Elasticsearch
- ✅ **Data Analysis Service**: Generates metrics (word count, age distribution, keyword frequency, complexity score, readability)
- ✅ **Backend API Service**: REST endpoints for search, documents, metrics, titles
- ✅ **Frontend Service**: Next.js app with Material-UI, search interface, metrics visualization

### Features Implemented
- ✅ Full-text search with filters
- ✅ Document hierarchical browsing
- ✅ Metrics visualization (charts, timelines)
- ✅ Version history tracking
- ✅ Document checksums
- ✅ Custom metrics: Complexity score and Flesch readability score

### Logging Improvements
- ✅ Reduced MongoDB verbosity with --quiet flag
- ✅ Configured Elasticsearch for minimal logging
- ✅ Simplified Node.js service logs

## Important Technical Decisions

### 1. **Elasticsearch instead of OpenSearch**
- Replaced OpenSearch with Elasticsearch 8.11.0
- Disabled security features for development
- Cleaner logs, simpler setup

### 2. **Shared Code Management**
- Created `sync-shared.sh` script to copy shared modules to each service
- Shared modules include: MongoDB/Elasticsearch connections, models, logger
- Each service has its own copy to avoid Docker build context issues

### 3. **Build Optimizations**
- Using standard `npm install` (not `npm ci` due to missing lock files)
- Single build process via `quick-start.sh`
- Frontend build takes 5-10 minutes due to dependencies (normal)

## Key Files and Scripts

- `quick-start.sh` - Main entry point for building and starting services
- `sync-shared.sh` - Syncs shared code to all services
- `docker-compose.yml` - Container orchestration
- `.env` - Environment configuration

## Environment Variables
```
MONGO_ROOT_USERNAME=ecfr_admin
MONGO_ROOT_PASSWORD=ecfr_secure_password_2024
MONGO_DATABASE=ecfr_db
ELASTICSEARCH_PORT=9200
BACKEND_PORT=3001
FRONTEND_PORT=3000
REFRESH_INTERVAL_HOURS=24
ANALYSIS_INTERVAL_HOURS=6
LOG_LEVEL=info
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
CHAT_SYSTEM_PROMPT="You are an expert at analyzing federal regulations..."
CHAT_DEFAULT_MODEL=gemini-2.0-flash-exp
CHAT_TIMEOUT_SECONDS=120
ANALYSIS_MODEL=gemini-2.0-flash-exp
ANALYSIS_BATCH_SIZE=5
ANALYSIS_TIMEOUT=300000
```

## Access Points
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## MongoDB Schema
- **titles**: Stores XML content, checksums, download dates
- **documents**: Individual parts/sections parsed from XML
- **metrics**: Analysis results per title
- **versionHistory**: Historical changes from eCFR API

## API Endpoints
- `/api/search` - Full-text search
- `/api/documents/{titleNumber}/{identifier}` - Get/download documents
- `/api/metrics/title/{titleNumber}` - Get metrics
- `/api/titles` - List all titles

## Known Issues/Considerations
1. Initial data download takes 30-60 minutes
2. Frontend build is slow due to large dependency tree
3. XML parsing is memory intensive for large titles
4. Elasticsearch requires adequate heap memory

## Next Steps if Needed
- Add authentication/authorization if deploying publicly
- Implement caching layer for frequently accessed data
- Add more sophisticated search features (facets, aggregations)
- Optimize XML parsing for very large titles
- Add monitoring/alerting for production deployment

## Commands
```bash
# Start everything
./quick-start.sh

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Sync shared code
./sync-shared.sh

# Rebuild specific service
docker-compose build [service-name]
docker-compose up -d [service-name]
```        


## Project Guidelines
- Only write new documentation in the ./documentation folder not in the root directory
- Remember to use the sync-shared.sh script in the root directory to sync shared code across services

## Error Handling
- Never fail silently

## Logging Best Practices
- When logging objects using logger make sure to convert them to a string first.