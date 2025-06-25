# Common Errors and Fixes

## UI/UX Issues

### Keyword Frequency Dialog - Cannot Search for Different Keywords

**Issue**: In the keyword frequency stacked bar chart dialog, typing a new keyword in the search field doesn't show results for that keyword. The search field was only filtering titles, not changing the selected keyword.

**Fix Applied**: 
Added an Autocomplete dropdown to allow selecting different keywords:
```typescript
<Autocomplete
  value={selectedKeyword}
  onChange={(event, newValue) => {
    if (newValue) {
      setSelectedKeyword(newValue);
      setSearchQuery(''); // Reset title search when changing keyword
    }
  }}
  options={Object.keys(metrics.keywordByTitle || {})}
  getOptionLabel={(option) => option.replace(/([A-Z])/g, ' $1').trim()}
  renderInput={(params) => (
    <TextField
      {...params}
      label="Select Keyword"
      size="small"
      fullWidth
    />
  )}
/>
```

**UI Structure**:
1. Keyword selector dropdown (Autocomplete) - to switch between different keywords
2. Title search field - to filter titles within the selected keyword's data
3. Results table showing title breakdown for the selected keyword

## Client-Side Errors

### TypeError: Cannot convert undefined or null to object

**Error Location**: Title page components (TitleMetrics.tsx)

**Error Message**:
```
TypeError: Cannot convert undefined or null to object
    at Object.entries (<anonymous>)
```

**Root Cause**: 
The `Object.entries()` method is being called on `null` or `undefined` values in the TitleMetrics component, specifically on:
- `data.regulationAgeDistribution`
- `data.keywordFrequency`

**Fix Applied**:
1. Add null checks before calling `Object.entries()`:
```typescript
const ageData = data.regulationAgeDistribution 
  ? Object.entries(data.regulationAgeDistribution).map(...)
  : [];

const keywordData = data.keywordFrequency
  ? Object.entries(data.keywordFrequency).map(...)
  : [];
```

2. Add early return if metrics data is missing:
```typescript
if (!metrics || !metrics.metrics) {
  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Analysis Metrics
      </Typography>
      <Typography variant="body2" color="text.secondary">
        No metrics data available for this title.
      </Typography>
    </Paper>
  );
}
```

3. Add default values for numeric fields:
```typescript
{formatNumber(data.wordCount || 0)}
{data.complexityScore || 0}
{data.readabilityScore || 0}
{data.averageSentenceLength || 0}
```

**Prevention**:
- Always check if objects exist before calling `Object.entries()`, `Object.keys()`, or `Object.values()`
- Use optional chaining (`?.`) and nullish coalescing (`??`) operators
- Provide default values for all data that might be undefined
- Consider using TypeScript's strict null checks

## MongoDB/ObjectId Errors

### Cast to ObjectId failed

**Error Location**: section_analysis worker

**Error Message**:
```
Cast to ObjectId failed for value "{ buffer: Binary.createFromBase64(...) }" (type Object) at path "_id"
```

**Root Cause**:
The `lastSectionId` in resumeData is being stored as a complex object instead of a string, causing ObjectId casting to fail.

**Fix Applied**:
Enhanced error handling in section_analysisWorker.js to detect and handle corrupted Binary objects:
```javascript
if (thread.resumeData.lastSectionId.buffer) {
  // Handle corrupted Binary object - reset
  console.error('Corrupted lastSectionId (Binary object), resetting to start');
  currentSectionIndex = 0;
  // Clear corrupted resume data
  await AnalysisThread.findByIdAndUpdate(thread._id, {
    'resumeData.lastSectionId': null,
    'resumeData.lastSectionIndex': 0
  });
}
```

**Prevention**:
- Always store ObjectIds as strings using `.toString()`
- Validate data types before storing in Mixed schema types
- Add data validation in worker threads