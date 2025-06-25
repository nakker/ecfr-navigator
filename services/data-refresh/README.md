# Data Refresh Service

The Data Refresh Service is responsible for downloading, parsing, and storing the entire Code of Federal Regulations (CFR) from the official eCFR sources. It handles the complex XML structure and maintains an up-to-date local copy of all federal regulations.

## Overview

This service performs scheduled and on-demand synchronization of federal regulations data by:
1. Downloading XML files from govinfo.gov
2. Parsing the hierarchical XML structure
3. Storing parsed documents in MongoDB
4. Indexing content in Elasticsearch for search

## Features

- **Automated Scheduling**: Configurable refresh intervals (default: 24 hours)
- **Progress Tracking**: Resume capability for interrupted downloads
- **Change Detection**: Skip unchanged titles based on checksums
- **Large File Support**: Handles XML files up to 500+ MB
- **Compression**: Gzip compression for storage efficiency
- **Error Recovery**: Retry logic and graceful error handling
- **GridFS Integration**: Stores oversized content that exceeds MongoDB limits
- **Batch Processing**: Efficient bulk inserts with fallback strategies

## Tech Stack

- **Runtime**: Node.js 18
- **XML Parsing**: xml2js 0.6.2
- **Database**: MongoDB (via Mongoose 8.0.0)
- **Search**: Elasticsearch 8.11.0
- **HTTP Client**: Axios 1.6.2
- **Compression**: Built-in zlib
- **Logging**: Winston 3.11.0

## Project Structure

```
data-refresh/
├── services/
│   ├── RefreshService.js    # Main orchestration logic
│   └── XMLParser.js         # XML parsing and extraction
├── shared/                  # Shared modules (synced)
│   ├── db/                 # Database connections
│   ├── models/             # Mongoose models
│   └── utils/              # Common utilities
├── index.js                # Service entry point
├── package.json            # Dependencies
└── Dockerfile              # Container configuration
```

## Data Sources

1. **Title List**: `https://www.ecfr.gov/api/versioner/v1/titles.json`
   - Provides metadata for all CFR titles
   - Used to determine which titles to download

2. **XML Files**: `https://www.govinfo.gov/bulkdata/ECFR/title-{number}/ECFR-title{number}.xml`
   - Full content of each CFR title
   - Contains hierarchical structure and regulation text

## XML Structure

The eCFR XML follows a hierarchical DIV structure:

```
DIV1 → Title (e.g., Title 29 - Labor)
├── DIV2 → Subtitle
├── DIV3 → Chapter
├── DIV4 → Subchapter
├── DIV5 → Part
├── DIV6 → Subpart
├── DIV7 → Subject Group
├── DIV8 → Section
└── DIV9 → Appendix
```

## Data Flow

### 1. Download Phase
```javascript
// Downloads XML from govinfo.gov
// Calculates SHA256 checksum
// Compresses with gzip (if < 500MB)
// Stores in MongoDB titles collection
```

### 2. Parse Phase
```javascript
// Parses XML structure recursively
// Extracts content in multiple formats:
//   - Plain text (for search)
//   - Formatted text (preserves HTML tags)
//   - Structured content (paragraphs, tables)
// Creates document hierarchy
```

### 3. Storage Phase
```javascript
// Deletes existing documents for title
// Inserts new documents in batches
// Falls back to GridFS for large content
// Indexes in Elasticsearch
```

## Environment Variables

```bash
# Service Configuration
PORT=3005
NODE_ENV=production
REFRESH_INTERVAL_HOURS=24

# Database
MONGO_URI=mongodb://username:password@mongodb:27017/ecfr_db
ELASTICSEARCH_URL=http://elasticsearch:9200

# Processing
DOWNLOAD_DELAY_MS=5000      # Delay between downloads
BATCH_SIZE=50               # Documents per batch insert
MAX_RETRIES=3               # Retry attempts for failures

# Logging
LOG_LEVEL=info
```

## Development

### Local Setup

1. Ensure MongoDB and Elasticsearch are running
2. Copy `.env.example` to `.env` and configure
3. Sync shared modules: `../../sync-shared.sh`
4. Install dependencies: `npm install`
5. Start service: `npm start`

### Running with Docker

```bash
# From project root
docker-compose up data-refresh
```

### Manual Refresh

Trigger a refresh for a specific title:

```bash
# Via backend API
curl -X POST http://localhost:3001/api/services/data-refresh/trigger-title \
  -H "Content-Type: application/json" \
  -d '{"titleNumber": 29}'
```

## Progress Tracking

The service maintains progress in the `refreshProgress` collection:

```javascript
{
  titleNumber: 29,
  status: 'in_progress',
  phase: 'parsing',
  startTime: Date,
  lastUpdateTime: Date,
  errorCount: 0
}
```

## Performance Considerations

### Memory Management
- Streaming for large XML files
- Batch processing to limit memory usage
- GridFS for content exceeding 1MB

### Storage Optimization
- Gzip compression reduces storage by ~80%
- Skips compression for files > 500MB
- Checksum-based change detection

### Processing Speed
- Configurable delays between downloads
- Parallel parsing where possible
- Efficient batch inserts

## Error Handling

### Common Issues

1. **Large File Errors**
   - Files > 500MB skip compression
   - GridFS used for oversized content
   - Individual insert fallback for large batches

2. **Network Timeouts**
   - Automatic retry with exponential backoff
   - Progress saved for resume capability
   - Manual retry via API

3. **Memory Issues**
   - Increase Node.js heap size if needed
   - Monitor memory usage during parsing
   - Consider processing fewer titles concurrently

### Monitoring

- Health endpoint: `GET /health`
- Progress API: `GET /api/refresh/progress`
- Logs: Structured Winston logging
- Metrics: Document count, processing time

## Data Integrity

- **Checksums**: SHA256 for change detection
- **Validation**: XML structure validation
- **Atomicity**: Transactional updates where possible
- **Backup**: Consider MongoDB backups before refresh

## Troubleshooting

### View Logs
```bash
# Docker logs
docker-compose logs -f data-refresh

# Local logs
npm start
```

### Check Progress
```bash
# Via backend API
curl http://localhost:3001/api/refresh/progress
```

### Reset Service
```bash
# Clear progress and restart
docker-compose restart data-refresh
```

## Related Documentation

- [XML Parser Documentation](/documentation/XML-PARSER-FIXES.md)
- [Backend API Documentation](/services/backend/README.md)
- [Troubleshooting Guide](/documentation/TROUBLESHOOTING.md)