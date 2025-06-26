# eCFR Navigator

A comprehensive web application for analyzing US Federal Regulations to provide insights for deregulation efforts.

## Overview

The eCFR Navigator downloads, stores, and analyzes the entire Electronic Code of Federal Regulations (eCFR) - over 200,000 pages of federal regulations across ~150 agencies. It provides powerful search capabilities, AI-powered analysis, and analytical metrics to help identify areas for potential regulatory improvement.

## Features

- **Full-text search** across all federal regulations with Elasticsearch
- **AI-powered analysis** using Grok models to assess regulatory impact
- **Analytics dashboard** with word counts, complexity scores, and readability metrics
- **Interactive chat** for asking questions about specific regulations
- **Automated section analysis** identifying antiquated and business-unfriendly regulations
- **Version history** tracking with timeline visualization
- **Service monitoring** with real-time status updates and manual triggers
- **Document export** with checksums for integrity verification

## Getting Started

### Prerequisites
- Docker and Docker Compose
- 10GB+ free disk space for data storage
- Internet connection for downloading eCFR data

### Installation

1. Clone the repository:
```bash
git clone https://github.com/sam-berry/ecfr-analyzer.git
cd ecfr-analyzer
```

2. Copy the environment file and configure:
```bash
cp .env.example .env
# Edit .env with your preferred settings
```

**Important**: To enable AI features, you need API keys:
- **Grok API** (for analysis): Get access from [x.ai](https://x.ai)
- Set GROK_API_KEY` in your `.env` file

3. Build and start the services:
```bash
# Quick start - builds and starts all services
./quick-start.sh

# Or use Docker Compose directly
docker-compose up -d --build
```

4. Wait for initial data download (this may take 30-60 minutes):
```bash
docker-compose logs -f data-refresh
```

5. Access the application at http://localhost:8080

### Note on Build Time
The initial build may take 5-10 minutes. Initial data download will take 30-60 minutes.

## Architecture

The eCFR Navigator uses a microservices architecture with the following components:

- **Nginx**: Reverse proxy routing traffic on port 8080
- **Frontend**: Next.js React application with Material-UI
- **Backend API**: Express.js REST API server
- **Data Refresh**: Downloads and parses eCFR XML data
- **Data Analysis**: Generates metrics and AI-powered insights
- **MongoDB**: Document database for storing regulations and metrics
- **Elasticsearch**: Full-text search engine for fast content queries

## Access Points

- **Main Application**: http://localhost:8080 (via Nginx)
- **Frontend** (direct): http://localhost:3000
- **Backend API** (direct): http://localhost:3001
- **MongoDB**: localhost:27017
- **Elasticsearch**: http://localhost:9200

Note: For normal usage, access the application through Nginx at port 8080. Direct service ports are provided for development/debugging.

## Service Documentation

Each service has its own README with detailed information:

- [Backend API Service](./services/backend/README.md) - REST API documentation
- [Frontend Service](./services/frontend/README.md) - UI components and features
- [Data Refresh Service](./services/data-refresh/README.md) - XML parsing and data flow
- [Data Analysis Service](./services/data-analysis/README.md) - Metrics and AI integration

## Project Documentation

For additional documentation, see the [`/documentation`](./documentation) folder:

- [API Reference](./documentation/API.md) - Complete API endpoint documentation
- [Deployment Guide](./documentation/DEPLOY.md) - Production deployment instructions
- [Troubleshooting](./documentation/TROUBLESHOOTING.md) - Common issues and solutions
- [Settings Page](./documentation/settings-page.md) - Service monitoring and control
- [Chat Configuration](./documentation/chat-configuration.md) - AI chat customization
- [Grok Setup](./documentation/grok-setup.md) - Section analysis configuration

## License

This project is provided as-is for educational and analytical purposes.