# System Architecture Overview

## Overview

The eCFR Navigator uses a microservices architecture with seven Docker containers working together to download, parse, analyze, and present federal regulations data. All external traffic is routed through an Nginx reverse proxy.

## Core Services

### Nginx Reverse Proxy (Port 8080)
- **Main entry point for all traffic**
- Routes requests to appropriate services
- Handles static asset serving
- Provides unified access point

### Frontend (Port 3000)
- **Next.js React application** 
- Provides user interface for search, browsing, and analysis
- Accessed via Nginx proxy

### Backend API (Port 3001)
- **Express.js REST API**
- Central gateway for all API requests
- Integrates with Gemini (chat) and Grok (analysis) APIs
- Accessed via Nginx proxy at /api/*

### Data Refresh Service
- **Automated XML processor**
- Downloads CFR data from govinfo.gov every 24 hours
- Parses complex XML structure into documents
- Stores in MongoDB and indexes in Elasticsearch

### Data Analysis Service  
- **Multi-threaded analyzer**
- Calculates text metrics (complexity, readability)
- Manages AI analysis via Grok API
- Runs four specialized worker threads

## Data Storage

### MongoDB
- Primary database for documents, metrics, and analysis results
- GridFS for large content exceeding 16MB limit
- Stores compressed XML, parsed documents, and progress tracking

### Elasticsearch
- Full-text search engine
- Indexes all regulation content
- Provides fast search with highlighting

## Key Architecture Patterns

1. **Shared Code**: Common modules synced across services via script
2. **Worker Threads**: Parallel processing for analysis tasks
3. **Progress Tracking**: Resume capability for long operations
4. **Rate Limiting**: API throttling for external services

## Data Flow

```
                           Nginx (8080)
                               ↓
govinfo.gov → Data Refresh → MongoDB → Data Analysis → AI APIs
                    ↓            ↓           ↓
                   XML      Elasticsearch   Metrics
                              ↓
                         Backend API
                              ↓
                          Frontend
```

## Access Points

- **Main Application**: http://localhost:8080 (via Nginx)
- **Direct Service Access** (development only):
  - Frontend: http://localhost:3000
  - Backend API: http://localhost:3001
  - MongoDB: localhost:27017
  - Elasticsearch: http://localhost:9200

## External Integrations

- **Grok API**: Section-level AI analysis (antiquated/business scores)
- **Gemini API**: Interactive chat about regulations
- **govinfo.gov**: Source for CFR XML data
- **eCFR API**: Version history tracking