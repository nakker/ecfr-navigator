# eCFR Navigator Architecture

This document provides a comprehensive overview of the eCFR Navigator system architecture, including services, data flow, and key design decisions.

## System Overview

The eCFR Navigator is a microservices-based application designed to download, parse, store, and analyze the entire US Code of Federal Regulations. It provides search capabilities, metrics generation, and AI-powered insights to help identify opportunities for regulatory improvement.

## Architecture Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Frontend       │────▶│  Backend API    │◀────│  External APIs  │
│  (Next.js)      │     │  (Express)      │     │  (Grok/Gemini)  │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
              ┌─────▼─────┐           ┌──────▼──────┐
              │           │           │             │
              │  MongoDB  │           │Elasticsearch│
              │           │           │             │
              └─────▲─────┘           └──────▲──────┘
                    │                         │
        ┌───────────┴─────────────────────────┴───────────┐
        │                                                 │
┌───────▼─────────┐                         ┌────────────▼──────┐
│                 │                         │                   │
│ Data Refresh    │                         │ Data Analysis     │
│ Service         │                         │ Service           │
│                 │                         │                   │
└─────────────────┘                         └───────────────────┘
        │                                             │
        │                                             │
        ▼                                             ▼
┌─────────────────┐                         ┌───────────────────┐
│ govinfo.gov     │                         │ Worker Threads    │
│ eCFR API        │                         │ (4 types)         │
└─────────────────┘                         └───────────────────┘
```

## Core Services

### 1. Frontend Service (Port 3000)

**Technology**: Next.js 14, React 18, Material-UI 5, TypeScript

**Responsibilities**:
- User interface for search and navigation
- Metrics visualization with Recharts
- Real-time service monitoring
- AI chat interface
- Document browsing and export

**Key Features**:
- Server-side rendering (SSR)
- Responsive design
- Dark mode support
- Real-time updates via polling

### 2. Backend API Service (Port 3001)

**Technology**: Express.js 4, Node.js 18

**Responsibilities**:
- REST API gateway
- Service orchestration
- Authentication/authorization (future)
- Rate limiting and security
- External API integration

**API Groups**:
- `/api/search` - Full-text search
- `/api/documents` - Document operations
- `/api/titles` - Title management
- `/api/metrics` - Analytics data
- `/api/analysis` - AI analysis results
- `/api/chat` - Chat completions
- `/api/services` - Service control
- `/api/refresh` - Refresh monitoring
- `/api/analysis-threads` - Thread management
- `/api/settings` - Configuration

### 3. Data Refresh Service (Port 3005 - health only)

**Technology**: Node.js 18, xml2js

**Responsibilities**:
- Download XML from govinfo.gov
- Parse hierarchical document structure
- Store documents in MongoDB
- Index content in Elasticsearch
- Track version history
- Handle large files (500+ MB)

**Data Sources**:
- Title list: `https://www.ecfr.gov/api/versioner/v1/titles.json`
- XML data: `https://www.govinfo.gov/bulkdata/ECFR/title-{number}/`

### 4. Data Analysis Service (Port 3003 - internal API)

**Technology**: Node.js 18 with Worker Threads

**Responsibilities**:
- Generate text metrics (complexity, readability)
- AI-powered section analysis
- Track regulation age
- Monitor version changes
- Manage analysis threads

**Worker Threads**:
1. `text_metrics` - Word count, complexity, readability
2. `age_distribution` - Regulation age tracking
3. `version_history` - Change monitoring
4. `section_analysis` - AI analysis with Grok

## Data Stores

### MongoDB

**Purpose**: Primary data storage

**Collections**:
- `titles` - Raw XML data with metadata
- `documents` - Parsed regulation sections
- `metrics` - Analysis results
- `versionHistory` - Change tracking
- `sectionAnalyses` - AI analysis results
- `refreshProgress` - Download progress
- `analysisThreads` - Thread status
- `regulatoryKeywords` - Configurable keywords

**GridFS**: Used for storing large content fields that exceed MongoDB document limits

### Elasticsearch

**Purpose**: Full-text search engine

**Index**: `ecfr_documents`

**Features**:
- Full-text search with highlighting
- Filtering by title, type, hierarchy
- Relevance scoring
- Autocomplete suggestions

## External Integrations

### Grok API (X.AI)

**Purpose**: AI-powered section analysis

**Features**:
- Section summaries
- Antiquated scores (1-100)
- Business unfriendly scores (1-100)
- Explanations for scores

**Configuration**:
- Model: `grok-3-mini`
- Rate limit: 15 requests/minute
- Temperature: 0.3 (consistent results)

### Gemini API (Google)

**Purpose**: Interactive chat about regulations

**Features**:
- Context-aware responses
- Regulation explanations
- Multiple model support

**Configuration**:
- Model: `gemini-2.0-flash-exp`
- Timeout: 120 seconds

## Key Design Patterns

### 1. Microservices Architecture

**Benefits**:
- Independent scaling
- Technology flexibility
- Fault isolation
- Easier maintenance

**Trade-offs**:
- Network complexity
- Data consistency challenges
- Operational overhead

### 2. Worker Thread Pattern

**Implementation**: Data Analysis Service

**Benefits**:
- Parallel processing
- Memory isolation
- Progress tracking
- Graceful failure handling

### 3. Shared Code Management

**Solution**: `sync-shared.sh` script

**Shared Modules**:
- Database connections
- Mongoose models
- Logger utilities
- GridFS helpers

**Rationale**: Avoids Docker build context issues while maintaining DRY principles

### 4. Progress Tracking

**Implementation**: MongoDB-based state management

**Features**:
- Resume capability
- Error recovery
- Manual intervention
- Progress monitoring

## Data Flow

### 1. Document Ingestion Flow

```
govinfo.gov → Data Refresh → XML Parser → MongoDB → Elasticsearch
                    ↓                         ↓
              Progress Tracking          GridFS (large)
```

### 2. Analysis Flow

```
MongoDB → Data Analysis → Worker Threads → Grok API
   ↓           ↓              ↓              ↓
Documents  Thread Manager  Metrics      AI Insights
```

### 3. Search Flow

```
User Query → Frontend → Backend API → Elasticsearch
                ↓           ↓              ↓
            Response    Rate Limit    Highlighted Results
```

### 4. Chat Flow

```
User Message → Frontend → Backend API → Gemini API
      ↓            ↓           ↓            ↓
   Context    Rate Limit   Validation   AI Response
```

## Security Considerations

### Current Implementation

1. **Rate Limiting**
   - Search: 1000 req/min
   - Chat: 1000 req/min
   - API-wide: configurable

2. **Input Validation**
   - Joi schemas for all endpoints
   - SQL injection prevention
   - XSS protection via Helmet

3. **CORS Configuration**
   - Restricted to frontend origin
   - Credentials support

4. **Error Handling**
   - No sensitive data in errors
   - Centralized error handler

### Future Enhancements

1. **Authentication**
   - JWT tokens
   - Role-based access
   - API key management

2. **Encryption**
   - TLS for all services
   - Encrypted storage for sensitive data
   - Secure API key storage

3. **Monitoring**
   - Security event logging
   - Anomaly detection
   - Audit trails

## Performance Optimizations

### 1. Caching Strategy

- **React Query**: Client-side caching
- **MongoDB Indexes**: Query optimization
- **Elasticsearch**: Search result caching

### 2. Batch Processing

- **Document Inserts**: 50 documents/batch
- **AI Analysis**: 5 sections/batch
- **Search Indexing**: Bulk operations

### 3. Compression

- **XML Storage**: Gzip compression (~80% reduction)
- **API Responses**: Response compression
- **Large Files**: Skip compression for 500+ MB

### 4. Resource Management

- **Worker Threads**: Isolated memory
- **Connection Pooling**: MongoDB/Elasticsearch
- **Request Throttling**: Rate limiting

## Scalability Considerations

### Horizontal Scaling

- **Frontend**: Multiple instances behind load balancer
- **Backend API**: Stateless, easily scalable
- **Data Services**: Queue-based for multiple instances

### Vertical Scaling

- **MongoDB**: Increase memory for large datasets
- **Elasticsearch**: Heap size tuning
- **Worker Threads**: Configurable thread count

### Data Partitioning

- **By Title**: Natural partition boundary
- **Time-based**: Historical data archival
- **Geographic**: Multi-region deployment

## Monitoring and Observability

### Health Checks

- All services expose `/health` endpoints
- Docker health checks configured
- Service status dashboard in frontend

### Logging

- **Winston**: Structured logging
- **Log Levels**: Configurable per service
- **Log Aggregation**: Future enhancement

### Metrics

- Thread progress tracking
- API response times
- Error rates and types
- Resource utilization

## Development Workflow

### Local Development

1. **Environment Setup**: Docker Compose
2. **Code Sharing**: sync-shared.sh
3. **Hot Reload**: Development mode
4. **Testing**: Service isolation

### CI/CD Pipeline (Future)

1. **Build**: Docker multi-stage builds
2. **Test**: Unit and integration tests
3. **Deploy**: Container orchestration
4. **Monitor**: Health checks and alerts

## Technology Decisions

### Why Elasticsearch over OpenSearch?

- Simpler setup and configuration
- Better documentation
- Reduced operational complexity
- Adequate features for our use case

### Why MongoDB?

- Flexible schema for varied XML structure
- GridFS for large file storage
- Good Node.js integration
- Horizontal scaling capability

### Why Worker Threads?

- CPU-intensive analysis tasks
- Memory isolation
- Progress tracking per thread
- Graceful failure handling

### Why Microservices?

- Independent scaling needs
- Different update cycles
- Technology flexibility
- Team scalability

## Future Enhancements

### Planned Features

1. **Advanced Search**
   - Faceted search
   - Query DSL support
   - Saved searches

2. **Collaboration**
   - User accounts
   - Annotation system
   - Sharing capabilities

3. **Export Options**
   - PDF generation
   - Bulk export
   - API access

4. **Analytics**
   - Trend analysis
   - Predictive insights
   - Custom dashboards

### Technical Improvements

1. **Caching Layer**
   - Redis integration
   - CDN for static assets
   - API response caching

2. **Message Queue**
   - RabbitMQ/Kafka
   - Async processing
   - Event-driven updates

3. **Monitoring**
   - Prometheus metrics
   - Grafana dashboards
   - Alert management

## Conclusion

The eCFR Navigator architecture is designed for reliability, scalability, and maintainability. The microservices approach allows for independent evolution of components while maintaining a cohesive system. The use of modern technologies and patterns ensures the system can handle the large scale of federal regulations data while providing a responsive user experience.