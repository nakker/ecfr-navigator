# Settings Page Documentation

## Overview

The eCFR Navigator now includes a comprehensive settings page that allows administrators to monitor and control the data-refresh and data-analysis services.

## Accessing Settings

Click the gear icon (⚙️) in the upper right corner of the navigation bar from any page to access the settings.

## Features

### Service Status Monitoring

The settings page displays real-time status for both services:

#### Data Refresh Service
- **Status**: Shows if the service is healthy, running a task, or has errors
- **Last Run**: Displays when the last refresh was performed
- **Duration**: Shows how long the last refresh took
- **Progress**: During active refreshes, shows number of titles processed
- **Errors**: Displays any error messages from failed titles

#### Data Analysis Service  
- **Status**: Shows if the service is healthy, running analysis, or has errors
- **Last Run**: Displays when the last analysis was performed
- **Duration**: Shows how long the last analysis took
- **Progress**: During active analysis, shows progress information
- **Errors**: Displays any error messages from failed analyses

### Manual Triggers

Each service has a "Trigger Now" button that allows manual execution:

- **Data Refresh**: Manually starts downloading and parsing all eCFR titles
- **Data Analysis**: Manually starts AI-powered analysis of all sections

### Status Indicators

- 🟢 **Healthy**: Service is running normally
- 🟡 **Running**: Service is actively processing
- 🔴 **Error**: Service encountered errors (but continues running)
- ⚫ **No Data**: No status information available

### Auto-Refresh

The status information automatically refreshes every 10 seconds to provide real-time updates.

## API Endpoints

The settings page uses the following API endpoints:

### Status Endpoints
- `GET /api/services/data-refresh/status` - Get data-refresh service status
- `GET /api/services/data-analysis/status` - Get data-analysis service status

### Trigger Endpoints
- `POST /api/services/data-refresh/trigger` - Manually trigger data refresh
- `POST /api/services/data-analysis/trigger` - Manually trigger data analysis

## Service Behavior

### Error Handling
Both services now include improved error handling:
- Services continue running even if individual operations fail
- Errors are logged but don't terminate the service
- Failed items are tracked and can be retried

### Scheduling
- **Data Refresh**: Runs every 24 hours by default
- **Data Analysis**: Runs every 6 hours by default
- Both services also run initial operations 10 minutes after startup

### Manual Trigger Behavior
- Manual triggers check for existing running operations
- Only one operation can run at a time per service
- Progress is tracked in the database
- Services check for manual trigger requests every 30 seconds

## Troubleshooting

### Common Issues

1. **"Service is already running"**: Wait for the current operation to complete before triggering again
2. **Connection errors**: Ensure all required services (MongoDB, Model Runner) are running
3. **Model API errors**: Check that the model-runner service has loaded the required models

### Monitoring Logs

View detailed logs using Docker:
```bash
# Data refresh logs
docker-compose logs -f data-refresh

# Data analysis logs  
docker-compose logs -f data-analysis
```

## Configuration

Service intervals can be configured in the `.env` file:
```env
REFRESH_INTERVAL_HOURS=24      # Data refresh interval
ANALYSIS_INTERVAL_HOURS=6      # Data analysis interval
ANALYSIS_MODEL=llama4          # Model for analysis
ANALYSIS_BATCH_SIZE=5          # Batch size for analysis
ANALYSIS_TIMEOUT=300000        # Timeout in milliseconds
```