# Backend API Service

The Backend API Service is the core REST API server for the eCFR Navigator project. It provides endpoints for searching, retrieving, and analyzing federal regulations data stored in MongoDB and indexed in Elasticsearch.

## Overview

This service acts as the central hub connecting the frontend application with data storage (MongoDB, Elasticsearch) and other microservices (data-refresh, data-analysis). It handles all client requests and coordinates between different system components.

## Features

- **Full-text search** with Elasticsearch integration
- **Document retrieval** with hierarchical navigation support
- **Metrics and analytics** endpoints for regulatory insights
- **AI-powered chat** integration with Grok API
- **Service orchestration** for triggering and monitoring other microservices
- **Real-time progress tracking** for data refresh and analysis operations
- **Security features** including rate limiting, CORS, and input validation

## Tech Stack

- **Runtime**: Node.js 18
- **Framework**: Express.js 4.18.2
- **Database**: MongoDB (via Mongoose 8.0.0)
- **Search**: Elasticsearch 8.11.0
- **Security**: Helmet, CORS, express-rate-limit
- **Validation**: Joi 17.11.0
- **Logging**: Winston 3.11.0

## Project Structure

```
backend/
├── routes/                 # API route handlers
│   ├── search.js          # Full-text search endpoints
│   ├── documents.js       # Document retrieval endpoints
│   ├── titles.js          # Title management endpoints
│   ├── metrics.js         # Metrics and analytics endpoints
│   ├── chat.js            # AI chat integration
│   ├── analysis.js        # Section analysis endpoints
│   ├── refresh.js         # Data refresh monitoring
│   ├── services.js        # Service orchestration
│   ├── analysisThreads.js # Analysis thread management
│   ├── settings.js        # Application settings
│   └── threads.js         # Thread management
├── shared/                # Shared modules (synced from parent)
│   ├── db/               # Database connections
│   ├── models/           # Mongoose models
│   └── utils/            # Common utilities
├── index.js              # Main server file
├── package.json          # Dependencies and scripts
└── Dockerfile            # Container configuration
```

## API Endpoints

### Search
- `GET /api/search` - Full-text search with filters
- `GET /api/search/suggest` - Search suggestions/autocomplete

### Documents
- `GET /api/documents/title/:titleNumber` - Get documents by title
- `GET /api/documents/:titleNumber/:identifier` - Get specific document
- `GET /api/documents/:titleNumber/:identifier/download` - Download document

### Titles
- `GET /api/titles` - List all titles with metrics
- `GET /api/titles/:number` - Get single title details
- `GET /api/titles/:number/download` - Download title XML

### Metrics
- `GET /api/metrics/title/:titleNumber` - Get metrics for a title
- `GET /api/metrics/aggregate` - Get aggregate metrics

### Chat
- `POST /api/chat` - Chat completion using AI
- `GET /api/chat/config` - Get chat configuration

### Analysis
- `GET /api/analysis/section/:documentId` - Get section analysis
- `GET /api/analysis/antiquated` - Get antiquated sections
- `GET /api/analysis/business-unfriendly` - Get business-unfriendly sections

### Services
- `GET /api/services/*/status` - Get service status
- `POST /api/services/*/trigger` - Trigger service operations

## Environment Variables

```bash
# Server Configuration
PORT=3001
NODE_ENV=production

# Database
MONGO_URI=mongodb://username:password@mongodb:27017/ecfr_db
ELASTICSEARCH_URL=http://elasticsearch:9200

# Security
CORS_ORIGIN=http://localhost:3000

# External Services
DATA_REFRESH_URL=http://data-refresh:3005
DATA_ANALYSIS_URL=http://data-analysis:3003

# AI Integration
GROK_API_KEY=your_grok_api_key
GROK_API_URL=https://api.x.ai/v1/chat/completions
CHAT_SYSTEM_PROMPT="You are an expert at analyzing federal regulations..."
CHAT_DEFAULT_MODEL=grok-2-1212
CHAT_TIMEOUT_SECONDS=120

# Logging
LOG_LEVEL=info
```

## Development

### Local Setup

1. Ensure MongoDB and Elasticsearch are running (use docker-compose)
2. Copy `.env.example` to `.env` and configure
3. Sync shared modules: `../../sync-shared.sh`
4. Install dependencies: `npm install`
5. Start development server: `npm run dev`

### Running with Docker

The service is designed to run as part of the docker-compose stack:

```bash
# From project root
docker-compose up backend
```

### Testing API Endpoints

```bash
# Health check
curl http://localhost:3001/health

# Search example
curl "http://localhost:3001/api/search?q=safety&title=29"

# Get all titles
curl http://localhost:3001/api/titles
```

## Security Features

- **Rate Limiting**: 1000 requests/minute on `/api/search` and `/api/chat`
- **CORS**: Configured for frontend origin
- **Helmet**: Security headers for XSS, clickjacking protection
- **Input Validation**: Joi schemas validate all inputs
- **Error Handling**: Centralized error handler prevents data leaks

## Monitoring

- Health endpoint: `GET /health`
- Structured logging with Winston
- Service status endpoints for all microservices
- Real-time progress tracking for long-running operations

## Performance Considerations

- Request compression enabled
- 10MB JSON body limit for large documents
- GridFS for documents exceeding MongoDB limits
- Efficient pagination for large result sets
- Elasticsearch for fast full-text search

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Check MongoDB is running: `docker-compose ps mongodb`
   - Verify connection string in `.env`
   - Check network connectivity

2. **Elasticsearch Not Responding**
   - Ensure Elasticsearch is healthy: `curl http://localhost:9200/_health`
   - Check memory allocation
   - Verify index exists

3. **Rate Limit Exceeded**
   - Default: 1000 requests/minute
   - Adjust in routes if needed for development

### Logs

View logs in development:
```bash
npm run dev
```

View logs in Docker:
```bash
docker-compose logs -f backend
```

## Related Documentation

- [API Documentation](/documentation/API.md) - Detailed endpoint documentation
- [Deployment Guide](/documentation/DEPLOY.md) - Production deployment
- [Troubleshooting Guide](/documentation/TROUBLESHOOTING.md) - Common issues