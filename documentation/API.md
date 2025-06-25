# eCFR Navigator API Documentation

Base URL: `http://localhost:3001/api`

## Endpoints

### Search

#### Full-text Search
```
GET /search?query={term}
```

Query Parameters:
- `query` (required): Search term (min 2 chars)
- `titleNumber` (optional): Filter by title number (1-50)
- `type` (optional): Document type (chapter, part, section, appendix)
- `chapter` (optional): Filter by chapter
- `part` (optional): Filter by part
- `subpart` (optional): Filter by subpart
- `section` (optional): Filter by section
- `from` (optional): Pagination offset (default: 0)
- `size` (optional): Results per page (default: 20, max: 100)

Response:
```json
{
  "total": 150,
  "hits": [
    {
      "id": "1_101.1",
      "score": 8.5,
      "titleNumber": 1,
      "titleName": "General Provisions",
      "documentType": "section",
      "identifier": "101.1",
      "heading": "Purpose",
      "highlights": {
        "content": ["...highlighted search results..."]
      }
    }
  ],
  "query": {
    "query": "regulation",
    "from": 0,
    "size": 20
  }
}
```

#### Search Suggestions
```
GET /search/suggest?q={term}
```

Query Parameters:
- `q` (required): Search prefix (min 2 chars)

Response:
```json
{
  "suggestions": [
    { "text": "regulatory", "score": 10.5 },
    { "text": "regulation", "score": 9.8 }
  ]
}
```

### Documents

#### Get Document
```
GET /documents/{titleNumber}/{identifier}
```

Path Parameters:
- `titleNumber`: Title number (1-50)
- `identifier`: Document identifier (URL encoded)

Response:
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "titleNumber": 1,
  "type": "section",
  "identifier": "101.1",
  "chapter": "I",
  "part": "101",
  "section": "101.1",
  "heading": "Purpose",
  "content": "Full document text...",
  "effectiveDate": "2020-01-01T00:00:00.000Z",
  "lastModified": "2024-06-24T00:00:00.000Z"
}
```

#### Download Document
```
GET /documents/{titleNumber}/{identifier}/download
```

Returns document as plain text file with appropriate headers for download.

#### List Documents by Title
```
GET /documents/title/{titleNumber}
```

Query Parameters:
- `type` (optional): Filter by document type
- `limit` (optional): Max documents (default: 100)
- `offset` (optional): Skip documents (default: 0)

Response:
```json
{
  "documents": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "titleNumber": 1,
      "type": "chapter",
      "identifier": "I",
      "heading": "Organization"
    }
  ],
  "total": 245,
  "limit": 100,
  "offset": 0
}
```

### Metrics

#### Get Title Metrics
```
GET /metrics/title/{titleNumber}
```

Response:
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "titleNumber": 1,
  "analysisDate": "2024-06-24T00:00:00.000Z",
  "metrics": {
    "wordCount": 125000,
    "regulationAgeDistribution": {
      "lessThan1Year": 5,
      "oneToFiveYears": 20,
      "fiveToTenYears": 35,
      "tenToTwentyYears": 50,
      "moreThanTwentyYears": 40
    },
    "keywordFrequency": {
      "shall": 450,
      "must": 380,
      "prohibited": 95,
      "required": 220,
      "fee": 88,
      "cost": 156,
      "reportingRequirement": 45
    },
    "complexityScore": 68.5,
    "averageSentenceLength": 24.3,
    "readabilityScore": 42.1
  }
}
```

#### Get Metrics History
```
GET /metrics/title/{titleNumber}/history
```

Query Parameters:
- `limit` (optional): Max results (default: 30)

Returns array of metrics over time.

#### Get Version History
```
GET /metrics/title/{titleNumber}/versions
```

Response:
```json
{
  "titleNumber": 1,
  "lastUpdated": "2024-06-24T00:00:00.000Z",
  "versions": [
    {
      "date": "2024-01-15T00:00:00.000Z",
      "federalRegisterCitation": "89 FR 1234",
      "description": "Updated definitions"
    }
  ]
}
```

#### Get Aggregate Metrics
```
GET /metrics/aggregate
```

Response:
```json
{
  "totalWordCount": 15000000,
  "avgComplexityScore": 72.3,
  "avgReadabilityScore": 38.5,
  "aggregateKeywordFrequency": {
    "shall": 45000,
    "must": 38000,
    "prohibited": 9500,
    "required": 22000,
    "fee": 8800,
    "cost": 15600,
    "reportingRequirement": 4500
  }
}
```

### Titles

#### List All Titles
```
GET /titles
```

Response:
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "number": 1,
    "name": "General Provisions",
    "latestAmendedOn": "2022-12-29T00:00:00.000Z",
    "latestIssueDate": "2024-05-17T00:00:00.000Z",
    "upToDateAsOf": "2025-06-20T00:00:00.000Z",
    "reserved": false,
    "checksum": "a1b2c3d4...",
    "lastDownloaded": "2024-06-24T00:00:00.000Z",
    "lastAnalyzed": "2024-06-24T01:00:00.000Z"
  }
]
```

#### Get Single Title
```
GET /titles/{number}
```

Returns single title object.

#### Get Title Checksum
```
GET /titles/{number}/checksum
```

Response:
```json
{
  "titleNumber": 1,
  "titleName": "General Provisions",
  "checksum": "a1b2c3d4e5f6...",
  "lastDownloaded": "2024-06-24T00:00:00.000Z"
}
```

#### Download Title XML
```
GET /titles/{number}/download
```

Returns compressed XML file of the entire title.

## Error Responses

All endpoints return standard error responses:

```json
{
  "error": "Error message",
  "details": "Additional error details (if available)"
}
```

Common HTTP status codes:
- `400` - Bad Request (invalid parameters)
- `404` - Not Found
- `409` - Conflict (duplicate entry)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Rate Limiting

API requests are limited to 100 requests per 15 minutes per IP address.