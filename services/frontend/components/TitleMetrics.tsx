import React, { useState } from 'react';
import {
  Paper,
  Grid,
  Typography,
  Box,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  InputAdornment,
  Autocomplete,
  Stack,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import {
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import VersionTimeline from './VersionTimeline';

interface TitleMetricsProps {
  metrics: {
    metrics: {
      wordCount: number;
      regulationAgeDistribution: Record<string, number>;
      keywordFrequency: Record<string, number>;
      complexityScore: number;
      averageSentenceLength: number;
      readabilityScore: number;
    };
    analysisDate: string;
    keywordByChapter?: Record<string, Record<string, number>>;
  };
  versionHistory?: {
    versions: Array<{
      date: string;
      identifier: string;
      name: string;
      part: string;
      type: string;
    }>;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

// Extended color palette for chapters
const CHAPTER_COLORS = [
  '#1976d2', '#dc004e', '#f50057', '#9c27b0', '#673ab7',
  '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688',
  '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107',
  '#ff9800', '#ff5722', '#795548', '#607d8b', '#455a64',
  '#e91e63', '#00acc1', '#43a047', '#fdd835', '#fb8c00',
  '#6d4c41', '#546e7a', '#37474f', '#78909c', '#827717',
];

export default function TitleMetrics({ metrics, versionHistory }: TitleMetricsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'count',
    direction: 'desc'
  });

  // Early return if no metrics data
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

  const { metrics: data } = metrics;

  // Add null checks to prevent Object.entries from being called on null/undefined
  const ageData = data.regulationAgeDistribution 
    ? Object.entries(data.regulationAgeDistribution).map(([key, value]) => ({
        name: key.replace(/([A-Z])/g, ' $1').trim(),
        value,
      }))
    : [];

  // Prepare keyword data for stacked bar chart
  let keywordData: any[] = [];
  let chapterKeys: string[] = [];
  
  // Debug log
  console.log('TitleMetrics - metrics:', metrics);
  console.log('TitleMetrics - metrics.metrics:', metrics.metrics);
  console.log('TitleMetrics - keywordFrequency:', metrics.metrics?.keywordFrequency);
  console.log('TitleMetrics - keywordByChapter:', metrics.keywordByChapter);
  
  if (metrics.keywordByChapter) {
    // Get all unique chapters
    const allChapters = new Set<string>();
    Object.values(metrics.keywordByChapter).forEach(chapterData => {
      Object.keys(chapterData).forEach(chapter => allChapters.add(chapter));
    });
    chapterKeys = Array.from(allChapters).sort((a, b) => {
      const numA = parseInt(a.replace(/Part |Chapter /, ''));
      const numB = parseInt(b.replace(/Part |Chapter /, ''));
      return numA - numB;
    });
    
    // Transform data for stacked bar chart
    keywordData = Object.entries(metrics.keywordByChapter).map(([keyword, chapterData]) => {
      // Convert camelCase to readable format
      const readableKeyword = keyword.replace(/([A-Z])/g, ' $1').trim();
      // Truncate to 10 characters with ellipsis
      const truncatedKeyword = readableKeyword.length > 10 
        ? readableKeyword.substring(0, 10) + '...' 
        : readableKeyword;
      
      const dataPoint: any = {
        keyword: truncatedKeyword,
        fullKeyword: readableKeyword,
        originalKeyword: keyword,
      };
      chapterKeys.forEach(chapter => {
        dataPoint[chapter] = chapterData[chapter] || 0;
      });
      return dataPoint;
    });
    console.log('TitleMetrics - Transformed keywordData:', keywordData);
    console.log('TitleMetrics - chapterKeys:', chapterKeys);
    
    // Filter out keywords with no data across all chapters
    keywordData = keywordData.filter(item => {
      const hasData = chapterKeys.some(chapter => item[chapter] > 0);
      return hasData;
    });
    console.log('TitleMetrics - Filtered keywordData (with data):', keywordData);
  } else {
    // Fallback to simple bar chart if no chapter breakdown
    console.log('TitleMetrics - Using fallback, keywordFrequency:', data.keywordFrequency);
    keywordData = data.keywordFrequency
      ? Object.entries(data.keywordFrequency).map(([key, value]) => {
          const readableKeyword = key.replace(/([A-Z])/g, ' $1').trim();
          const truncatedKeyword = readableKeyword.length > 10 
            ? readableKeyword.substring(0, 10) + '...' 
            : readableKeyword;
          return {
            keyword: truncatedKeyword,
            fullKeyword: readableKeyword,
            count: value,
          };
        })
      : [];
    console.log('TitleMetrics - Fallback keywordData:', keywordData);
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  // Custom tooltip that shows only top 10
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;

    // Sort payload by value and take top 10
    const sortedPayload = [...payload]
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    
    const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
    const topTenTotal = sortedPayload.reduce((sum: number, entry: any) => sum + entry.value, 0);
    const othersCount = payload.length - 10;

    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Total: {formatNumber(total)}
        </Typography>
        <Box sx={{ mt: 1 }}>
          {sortedPayload.map((entry: any) => (
            <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Box 
                sx={{ 
                  width: 12, 
                  height: 12, 
                  bgcolor: entry.color, 
                  mr: 1,
                  flexShrink: 0
                }} 
              />
              <Typography variant="caption" sx={{ flex: 1 }}>
                {entry.name}: {formatNumber(entry.value)}
              </Typography>
            </Box>
          ))}
          {othersCount > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              + {othersCount} more parts ({formatNumber(total - topTenTotal)} total)
            </Typography>
          )}
        </Box>
        <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
          Click to see full breakdown
        </Typography>
      </Paper>
    );
  };

  // Handle bar click
  const handleBarClick = (data: any) => {
    if (!data || !metrics.keywordByChapter) return;
    
    let keyword = null;
    
    if (data.activePayload && data.activePayload.length > 0) {
      const payload = data.activePayload[0].payload;
      keyword = payload.originalKeyword || payload.keyword;
    } else if (data.originalKeyword || data.keyword) {
      keyword = data.originalKeyword || data.keyword;
    }
    
    if (!keyword) {
      console.error('No keyword found in click data:', data);
      return;
    }
    
    setSelectedKeyword(keyword);
    setSearchQuery('');
    setDialogOpen(true);
  };

  // Get data for the selected keyword dialog
  const getKeywordDialogData = () => {
    if (!selectedKeyword || !metrics.keywordByChapter) return [];
    
    let chapterData = metrics.keywordByChapter[selectedKeyword];
    
    if (!chapterData) {
      const keywordKey = Object.keys(metrics.keywordByChapter).find(
        k => k === selectedKeyword || k.replace(/([A-Z])/g, ' $1').trim() === selectedKeyword
      );
      
      if (!keywordKey) {
        console.warn('No keyword found matching:', selectedKeyword);
        return [];
      }
      
      chapterData = metrics.keywordByChapter[keywordKey];
    }
    
    if (!chapterData || typeof chapterData !== 'object') {
      console.warn('No chapter data found for keyword:', selectedKeyword);
      return [];
    }
    
    const data = Object.entries(chapterData).map(([chapter, count]) => ({
      chapter,
      count: count as number,
      total: 0
    }));
    
    const total = data.reduce((sum, item) => sum + item.count, 0);
    data.forEach(item => {
      item.total = total;
    });
    
    return data;
  };

  // Handle sorting
  const handleSort = (key: string) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
  };

  // Sort dialog data
  const sortedDialogData = getKeywordDialogData()
    .sort((a, b) => {
      if (sortConfig.key === 'chapter') {
        const numA = parseInt(a.chapter.replace(/Part |Chapter /, ''));
        const numB = parseInt(b.chapter.replace(/Part |Chapter /, ''));
        return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
      }
      
      return sortConfig.direction === 'asc' 
        ? a.count - b.count
        : b.count - a.count;
    });

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Analysis Metrics
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Last analyzed: {new Date(metrics.analysisDate).toLocaleString()}
      </Typography>

      <Grid container spacing={3}>
        {/* Basic Metrics Cards */}
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Word Count
              </Typography>
              <Typography variant="h4">
                {formatNumber(data.wordCount || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Complexity Score
              </Typography>
              <Typography variant="h4">
                {data.complexityScore || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                0-100 scale
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Readability
              </Typography>
              <Typography variant="h4">
                {data.readabilityScore || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Flesch score
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Avg Sentence Length
              </Typography>
              <Typography variant="h4">
                {data.averageSentenceLength || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                words
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Version Timeline */}
        <Grid item xs={12} md={6}>
          <Box sx={{ height: 300 }}>
            <Typography variant="h6" gutterBottom>
              Regulation Version Timeline
            </Typography>
            {versionHistory && versionHistory.versions && versionHistory.versions.length > 0 ? (
              <VersionTimeline versions={versionHistory.versions} />
            ) : (
              <Box sx={{ 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexDirection: 'column'
              }}>
                <Typography variant="body2" color="text.secondary" align="center">
                  Version timeline data not available.
                </Typography>
                <Typography variant="caption" color="text.secondary" align="center" sx={{ mt: 1 }}>
                  Run the Version History analysis thread to generate this data.
                </Typography>
              </Box>
            )}
          </Box>
        </Grid>

        {/* Keyword Frequency Chart */}
        <Grid item xs={12} md={6}>
          <Box sx={{ height: 300 }}>
            <Typography variant="h6" gutterBottom>
              Regulatory Keywords
            </Typography>
            {keywordData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={keywordData}
                  onClick={handleBarClick}
                  style={{ cursor: metrics.keywordByChapter ? 'pointer' : 'default' }}
                >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="keyword" 
                  angle={-45} 
                  textAnchor="end" 
                  height={80}
                  tick={(props: any) => {
                    const { x, y, payload } = props;
                    const item = keywordData.find(d => d.keyword === payload.value);
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <title>{item?.fullKeyword || payload.value}</title>
                        <text 
                          x={0} 
                          y={0} 
                          dy={16} 
                          textAnchor="end" 
                          fill="#666" 
                          transform="rotate(-45)"
                        >
                          {payload.value}
                        </text>
                      </g>
                    );
                  }}
                />
                <YAxis />
                <Tooltip 
                  content={metrics.keywordByChapter ? <CustomTooltip /> : undefined}
                  formatter={(value) => formatNumber(Number(value))} 
                />
                {metrics.keywordByChapter ? (
                  // Stacked bar chart with chapter breakdown
                  chapterKeys.map((chapter, index) => (
                    <Bar 
                      key={chapter}
                      dataKey={chapter} 
                      stackId="a"
                      fill={CHAPTER_COLORS[index % CHAPTER_COLORS.length]}
                    />
                  ))
                ) : (
                  // Simple bar chart
                  <Bar dataKey="count" fill="#82ca9d" />
                )}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexDirection: 'column'
              }}>
                <Typography variant="body2" color="text.secondary" align="center">
                  No keyword data available.
                </Typography>
                <Typography variant="caption" color="text.secondary" align="center" sx={{ mt: 1 }}>
                  Run the Text Metrics analysis thread to generate this data.
                </Typography>
              </Box>
            )}
            {metrics.keywordByChapter && keywordData.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Stacked by part. Click on any bar to see the full breakdown.
              </Typography>
            )}
          </Box>
        </Grid>
      </Grid>

      {/* Keyword Detail Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSearchQuery('');
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">
              Keyword: {selectedKeyword ? selectedKeyword.replace(/([A-Z])/g, ' $1').trim() : ''}
            </Typography>
            <IconButton
              onClick={() => {
                setDialogOpen(false);
                setSearchQuery('');
              }}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Autocomplete
              value={selectedKeyword}
              onChange={(event, newValue) => {
                if (newValue) {
                  setSelectedKeyword(newValue);
                  setSearchQuery('');
                }
              }}
              options={Object.keys(metrics.keywordByChapter || {})}
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
          </Box>
          
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={sortConfig.key === 'chapter'}
                      direction={sortConfig.key === 'chapter' ? sortConfig.direction : 'asc'}
                      onClick={() => handleSort('chapter')}
                    >
                      Part
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortConfig.key === 'count'}
                      direction={sortConfig.key === 'count' ? sortConfig.direction : 'asc'}
                      onClick={() => handleSort('count')}
                    >
                      Count
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">Percentage</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedDialogData.map((row) => (
                  <TableRow key={row.chapter}>
                    <TableCell>{row.chapter}</TableCell>
                    <TableCell align="right">{formatNumber(row.count)}</TableCell>
                    <TableCell align="right">
                      {((row.count / row.total) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
                {sortedDialogData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No parts found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Total occurrences: {formatNumber(getKeywordDialogData().reduce((sum, item) => sum + item.count, 0))}
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    </Paper>
  );
}