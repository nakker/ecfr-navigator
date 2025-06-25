# System Architecture Overview

## Overview

The eCFR Analyzer uses a microservices architecture with four Docker containers working together to download, parse, analyze, and present federal regulations data.

## Core Services

### Frontend (Port 3000)
- **Next.js React application** 
- Provides user interface for search, browsing, and analysis
- Communicates only with Backend API

### Backend API (Port 3001)
- **Express.js REST API**
- Central gateway for all client requests
- Integrates with Gemini (chat) and Grok (analysis) APIs
- Manages service orchestration

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
govinfo.gov → Data Refresh → MongoDB → Data Analysis → AI APIs
                    ↓            ↓           ↓
                   XML      Elasticsearch   Metrics
                              ↓
                         Backend API
                              ↓
                          Frontend
```

## External Integrations

- **Grok API**: Section-level AI analysis (antiquated/business scores)
- **Gemini API**: Interactive chat about regulations
- **govinfo.gov**: Source for CFR XML data
- **eCFR API**: Version history tracking