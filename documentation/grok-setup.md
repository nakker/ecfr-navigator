# Grok API Setup Guide

## Overview
The eCFR Navigator uses Grok AI for analyzing regulatory sections. This guide explains how to set up and configure the Grok API.

## Getting Started

### 1. Obtain an API Key
1. Visit [https://x.ai/api](https://x.ai/api)
2. Sign up or log in to your account
3. Generate an API key from the dashboard

### 2. Configure Environment Variables
Add the following to your `.env` file:

```env
# Grok API Configuration
GROK_API_KEY=your_api_key_here

# Optional: Configure the model (default: grok-3-mini)
ANALYSIS_MODEL=grok-3-mini

# Optional: Configure rate limiting (default: 15 requests/second)
ANALYSIS_RATE_LIMIT=15

# Optional: Configure timeout (default: 120 seconds)
ANALYSIS_TIMEOUT_SECONDS=120
```

### 3. Test Your Configuration
Run the test script to verify your setup:

```bash
docker-compose exec data-analysis node test-grok.js
```

## Features

### Section Analysis
When configured, the data-analysis service will:
- Generate one-sentence summaries of regulatory sections
- Rate how antiquated/outdated the language is (1-10 scale)
- Rate how business-unfriendly the regulations are (1-10 scale)

### Rate Limiting
The service includes built-in rate limiting to prevent overwhelming the API:
- Default: 15 requests per second
- Configurable via `ANALYSIS_RATE_LIMIT` environment variable
- Automatic request queuing and throttling

## Troubleshooting

### Service Runs Without API Key
If no API key is configured:
- The service will start normally
- Basic text analysis (word count, complexity) will work
- AI-powered section analysis will be skipped
- Warning logs will indicate the missing API key

### Common Issues

1. **"GROK_API_KEY not configured" error**
   - Ensure the API key is set in your `.env` file
   - Restart the service after adding the key

2. **Rate limit errors**
   - Reduce `ANALYSIS_RATE_LIMIT` in your `.env` file
   - The service will automatically queue and retry requests

3. **Timeout errors**
   - Increase `ANALYSIS_TIMEOUT_SECONDS` for slower responses
   - Check your network connection

## Running Analysis

### Automatic Analysis
- Runs on service startup (after 2-minute delay)
- Analyzes only unanalyzed sections

### Manual Analysis
- Full analysis: Use the "Trigger Manually" button in Settings
- Single title: Use the "Reanalyze Title" feature in Settings

## Monitoring
Check service logs for analysis progress:
```bash
docker-compose logs -f data-analysis
```