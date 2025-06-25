# Error Handling Improvements

## Overview

The data-refresh service has been enhanced with robust error handling to ensure that failures in processing individual titles do not terminate the entire refresh process.

## Key Improvements

### 1. Graceful Failure Handling
- When a title fails to download or process, the error is logged and the service continues with the next title
- Failed titles are tracked in the RefreshProgress collection for visibility
- The service maintains a list of failed titles that can be retried later

### 2. Large File Handling

#### Compression Handling
- Files larger than 500MB skip compression to avoid buffer overflow errors
- If compression fails for any reason, the file is stored uncompressed
- Compression errors are logged but don't stop processing

#### MongoDB Size Limits
- Documents larger than 16MB (MongoDB's limit) are detected before storage
- Oversized titles are saved with metadata only (no XML content)
- An `isOversized` flag is set to indicate the content was too large to store
- This allows the system to track all titles even if their content can't be stored

### 3. Specific Issues Addressed

#### Title 26 (Internal Revenue)
- Title 26 repeatedly failed with "offset out of range" errors during compression
- The service now handles this gracefully by:
  - Detecting oversized files before compression
  - Storing metadata without XML content for oversized titles
  - Continuing with other titles instead of failing

### 4. Error Recovery Features

#### Progress Tracking
- The service tracks which titles have been processed successfully
- Failed titles are recorded with error details
- On restart, the service resumes from where it left off

#### Manual Retry
- Failed titles can be manually retried via the settings page
- The service checks for manual trigger requests every 30 seconds

### 5. Logging Improvements
- More detailed error messages with context
- Size information logged for large files
- Clear indication when fallback strategies are used

## Configuration

No configuration changes are required. The improvements are automatic:
- Large files are detected and handled appropriately
- Compression is skipped for files > 500MB
- MongoDB storage is skipped for documents > 16MB

## Monitoring

View the status of data refresh operations:
1. Navigate to the Settings page (gear icon in top right)
2. Check the Data Refresh Service status
3. Failed titles will be listed with error counts

## Technical Details

### File Size Thresholds
- **Compression Skip**: Files > 500MB
- **MongoDB Skip**: Documents > 16MB after base64 encoding

### Error Types Handled
1. **Download Errors**: Network timeouts, 404s, server errors
2. **Compression Errors**: Buffer overflows, memory issues
3. **Storage Errors**: MongoDB size limits, connection issues
4. **Parsing Errors**: Invalid XML, memory constraints

### Database Schema Changes
- Added `isOversized` boolean field to Title model
- Indicates when XML content was omitted due to size

## Future Improvements

Potential enhancements for handling very large titles:
1. Implement GridFS storage for oversized XML content
2. Stream-based XML parsing for memory efficiency
3. Chunked compression for large files
4. Separate storage service for oversized content