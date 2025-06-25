# Data Analysis Service

The Data Analysis Service generates comprehensive metrics and AI-powered insights for federal regulations. It uses a multi-threaded architecture to analyze text complexity, track version history, and provide intelligent assessments of regulatory impact.

## Overview

This service performs both traditional text analysis and modern AI-powered evaluation of CFR content:
- Calculates readability and complexity metrics
- Tracks regulation age and version history  
- Uses AI to assess antiquated language and business impact
- Manages analysis through independent worker threads

## Features

- **Multi-threaded Architecture**: Four specialized worker threads for different analysis types
- **AI Integration**: Grok API for intelligent section analysis
- **Progress Tracking**: Resume capability with persistent state
- **Batch Processing**: Efficient handling of large datasets
- **Rate Limiting**: Respects API limits automatically
- **GridFS Support**: Handles large XML content
- **Real-time Monitoring**: Status API for tracking progress

## Tech Stack

- **Runtime**: Node.js 18 with Worker Threads
- **AI Service**: Grok API (X.AI)
- **Database**: MongoDB (via Mongoose 8.0.0)
- **Rate Limiting**: Bottleneck 2.19.5
- **Text Analysis**: Custom algorithms
- **Logging**: Winston 3.11.0

## Architecture

```
data-analysis/
├── services/
│   ├── ThreadManager.js        # Orchestrates worker threads
│   ├── TextAnalyzer.js        # Core text analysis algorithms
│   ├── grok.js                # AI service integration
│   └── workers/
│       ├── text_metricsWorker.js      # Basic metrics calculation
│       ├── age_distributionWorker.js  # Age analysis
│       ├── version_historyWorker.js   # Version tracking
│       └── section_analysisWorker.js  # AI-powered analysis
├── shared/                    # Shared modules (synced)
├── index.js                   # Service entry point
├── package.json              # Dependencies
└── Dockerfile                # Container configuration
```

## Worker Threads

### 1. Text Metrics Worker
Analyzes full title content to generate:
- **Word Count**: Accurate word matching (excludes numbers, punctuation)
- **Keyword Frequency**: Counts regulatory keywords from database
- **Complexity Score**: 0-100 based on:
  - Average sentence length
  - Percentage of complex words (3+ syllables)
  - Sentence length variation
- **Readability Score**: Flesch Reading Ease (0-100)
- **Average Sentence Length**: Words per sentence

### 2. Age Distribution Worker
- Tracks when regulations were last updated
- Builds age distribution histograms
- Identifies outdated regulations

### 3. Version History Worker
- Monitors changes from eCFR API
- Tracks document modifications
- Builds historical timelines

### 4. Section Analysis Worker
AI-powered analysis generating:
- **Summary**: One-sentence description of section purpose
- **Antiquated Score** (1-100): How outdated the regulation is
- **Business Unfriendly Score** (1-100): Regulatory burden on businesses
- **Explanations**: AI reasoning for scores

## AI Integration

### Grok Service Configuration
```javascript
{
  model: "grok-3-mini",
  temperature: 0.3,        // Consistent results
  max_tokens: 150,         // Concise responses
  rate_limit: 15/minute,   // API limits
  timeout: 120 seconds     // Request timeout
}
```

### Customizable Prompts
AI prompts can be customized via environment variables:
- `ANALYSIS_SUMMARY_PROMPT`
- `ANALYSIS_ANTIQUATED_PROMPT`
- `ANALYSIS_BUSINESS_PROMPT`

## Environment Variables

```bash
# Service Configuration
PORT=3003
NODE_ENV=production
ANALYSIS_STARTUP_DELAY_MINUTES=2

# AI Configuration
GROK_API_KEY=your_grok_api_key_here
GROK_API_URL=https://api.x.ai/v1/chat/completions
ANALYSIS_MODEL=grok-3-mini
ANALYSIS_BATCH_SIZE=5
ANALYSIS_RATE_LIMIT=15
ANALYSIS_TIMEOUT_SECONDS=120

# Database
MONGO_URI=mongodb://username:password@mongodb:27017/ecfr_db

# Analysis Prompts (optional)
ANALYSIS_SUMMARY_PROMPT="Summarize this regulation in one sentence..."
ANALYSIS_ANTIQUATED_PROMPT="Rate how antiquated this regulation is..."
ANALYSIS_BUSINESS_PROMPT="Rate how business unfriendly this is..."

# Logging
LOG_LEVEL=info
```

## API Endpoints

The service provides an internal API on port 3003:

- `GET /health` - Health check
- `GET /threads/status` - Get all thread statuses
- `POST /threads/:threadType/start` - Start a specific thread
- `POST /threads/:threadType/stop` - Stop a specific thread
- `GET /threads/:threadType/progress` - Get thread progress

## Development

### Local Setup

1. Ensure MongoDB is running
2. Obtain Grok API key from [x.ai](https://x.ai)
3. Copy `.env.example` to `.env` and configure
4. Sync shared modules: `../../sync-shared.sh`
5. Install dependencies: `npm install`
6. Start service: `npm start`

### Running with Docker

```bash
# From project root
docker-compose up data-analysis
```

### Monitoring Threads

```bash
# Check thread status
curl http://localhost:3003/threads/status

# Start specific thread
curl -X POST http://localhost:3003/threads/text_metrics/start

# View progress
curl http://localhost:3003/threads/section_analysis/progress
```

## Metrics Algorithms

### Complexity Score Calculation
```javascript
complexity = (avgSentenceLength * 0.4) + 
            (complexWordPercentage * 0.4) + 
            (sentenceLengthVariation * 0.2)
```

### Flesch Reading Ease
```javascript
readability = 206.835 - 
              (1.015 * avgSentenceLength) - 
              (84.6 * avgSyllablesPerWord)
```

## Performance Optimization

- **Batch Processing**: Reduces database operations
- **Worker Isolation**: Prevents memory leaks
- **Progress Caching**: Minimizes repeated calculations
- **Selective Analysis**: Only processes changed content
- **Rate Limiting**: Prevents API throttling

## Error Handling

### Common Issues

1. **AI API Errors**
   - Check API key validity
   - Monitor rate limits
   - Verify network connectivity

2. **Memory Issues**
   - Workers automatically restart on crash
   - Consider reducing batch size
   - Monitor heap usage

3. **Slow Processing**
   - Check AI API response times
   - Adjust batch sizes
   - Verify MongoDB performance

### Troubleshooting

```bash
# View logs
docker-compose logs -f data-analysis

# Check thread errors
curl http://localhost:3003/threads/status | jq '.section_analysis.errorDetails'

# Restart failed thread
curl -X POST http://localhost:3003/threads/section_analysis/start
```

## Data Storage

### Metrics Collection
```javascript
{
  titleNumber: 29,
  wordCount: 150000,
  keywordFrequency: { "compliance": 45, "safety": 120 },
  complexityScore: 65.5,
  readabilityScore: 45.2,
  avgSentenceLength: 22.5,
  lastUpdated: Date
}
```

### Section Analysis
```javascript
{
  documentId: ObjectId,
  summary: "Defines workplace safety standards...",
  antiquatedScore: 75,
  antiquatedExplanation: "References outdated technology...",
  businessUnfriendlyScore: 60,
  businessExplanation: "Requires extensive documentation...",
  analyzedAt: Date
}
```

## Best Practices

1. **Monitor Thread Health**: Check status regularly
2. **Handle API Limits**: Adjust rate limits based on tier
3. **Optimize Prompts**: Test and refine AI prompts
4. **Track Progress**: Use progress API for monitoring
5. **Plan Maintenance**: Schedule during low-usage periods

## Related Documentation

- [Grok API Setup Guide](/documentation/grok-setup.md)
- [Customizing AI Prompts](/documentation/customizing-ai-prompts.md)
- [Backend API Documentation](/services/backend/README.md)