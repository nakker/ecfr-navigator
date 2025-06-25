import React, { useState } from 'react';
import {
  Paper,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface AggregateMetricsProps {
  metrics: {
    totalWordCount: number;
    avgComplexityScore: number;
    avgReadabilityScore: number;
    aggregateKeywordFrequency: Record<string, number>;
    keywordByTitle?: Record<string, Record<string, number>>;
  };
}

export default function AggregateMetrics({ metrics }: AggregateMetricsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'total',
    direction: 'desc'
  });

  // Prepare data for stacked bar chart
  let keywordData: any[] = [];
  let titleKeys: string[] = [];
  
  // Debug logging
  console.log('AggregateMetrics - metrics data:', {
    hasKeywordByTitle: !!metrics.keywordByTitle,
    keywordByTitleKeys: metrics.keywordByTitle ? Object.keys(metrics.keywordByTitle) : [],
    keywordByTitleLength: metrics.keywordByTitle ? Object.keys(metrics.keywordByTitle).length : 0,
    hasAggregateKeywordFrequency: !!metrics.aggregateKeywordFrequency,
    aggregateKeywordFrequencyKeys: metrics.aggregateKeywordFrequency ? Object.keys(metrics.aggregateKeywordFrequency) : [],
    sampleKeywordByTitle: metrics.keywordByTitle ? Object.entries(metrics.keywordByTitle).slice(0, 2) : []
  });
  
  // Check if we have valid data
  const hasKeywordByTitle = metrics.keywordByTitle && Object.keys(metrics.keywordByTitle).length > 0;
  const hasAggregateKeywords = metrics.aggregateKeywordFrequency && Object.keys(metrics.aggregateKeywordFrequency).length > 0;
  
  if (hasKeywordByTitle && metrics.keywordByTitle) {
    // Get all unique title numbers
    const allTitles = new Set<string>();
    Object.values(metrics.keywordByTitle).forEach(titleData => {
      Object.keys(titleData).forEach(title => allTitles.add(title));
    });
    titleKeys = Array.from(allTitles).sort((a, b) => {
      const numA = parseInt(a.replace('Title ', ''));
      const numB = parseInt(b.replace('Title ', ''));
      return numA - numB;
    });
    
    console.log('AggregateMetrics - titleKeys found:', titleKeys.length, titleKeys.slice(0, 5));
    
    // Transform data for stacked bar chart
    keywordData = Object.entries(metrics.keywordByTitle).map(([keyword, titleData]) => {
      // Convert camelCase to readable format
      const readableKeyword = keyword.replace(/([A-Z])/g, ' $1').trim();
      // Truncate to 10 characters with ellipsis
      const truncatedKeyword = readableKeyword.length > 10 
        ? readableKeyword.substring(0, 10) + '...' 
        : readableKeyword;
      
      const dataPoint: any = {
        keyword: truncatedKeyword,
        fullKeyword: readableKeyword,
        originalKeyword: keyword, // Store original keyword for click handling
      };
      titleKeys.forEach(title => {
        dataPoint[title] = titleData[title] || 0;
      });
      return dataPoint;
    });
  } else if (hasAggregateKeywords && metrics.aggregateKeywordFrequency) {
    // Fallback to simple bar chart if no title breakdown
    keywordData = Object.entries(metrics.aggregateKeywordFrequency).map(([key, value]) => {
      const readableKeyword = key.replace(/([A-Z])/g, ' $1').trim();
      const truncatedKeyword = readableKeyword.length > 10 
        ? readableKeyword.substring(0, 10) + '...' 
        : readableKeyword;
      return {
        keyword: truncatedKeyword,
        fullKeyword: readableKeyword,
        count: value,
      };
    });
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
              + {othersCount} more titles ({formatNumber(total - topTenTotal)} total)
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
    if (!data || !metrics.keywordByTitle) return;
    
    // The data from the bar click contains the activePayload with the keyword
    let keyword = null;
    
    if (data.activePayload && data.activePayload.length > 0) {
      // Get the keyword from the payload
      const payload = data.activePayload[0].payload;
      keyword = payload.originalKeyword || payload.keyword;
    } else if (data.originalKeyword || data.keyword) {
      // Fallback to direct properties
      keyword = data.originalKeyword || data.keyword;
    }
    
    if (!keyword) {
      console.error('No keyword found in click data:', data);
      return;
    }
    
    setSelectedKeyword(keyword);
    setSearchQuery(''); // Reset search when opening dialog
    setDialogOpen(true);
  };

  // Get data for the selected keyword dialog
  const getKeywordDialogData = () => {
    if (!selectedKeyword || !metrics.keywordByTitle) return [];
    
    // First try direct lookup (if originalKeyword was used)
    let titleData = metrics.keywordByTitle[selectedKeyword];
    
    // If not found, try to find the original keyword key that matches the formatted keyword
    if (!titleData) {
      const keywordKey = Object.keys(metrics.keywordByTitle).find(
        k => k === selectedKeyword || k.replace(/([A-Z])/g, ' $1').trim() === selectedKeyword
      );
      
      if (!keywordKey) {
        console.warn('No keyword found matching:', selectedKeyword);
        return [];
      }
      
      titleData = metrics.keywordByTitle[keywordKey];
    }
    
    if (!titleData || typeof titleData !== 'object') {
      console.warn('No title data found for keyword:', selectedKeyword);
      return [];
    }
    
    // Transform the data for the table
    const data = Object.entries(titleData).map(([title, count]) => ({
      title,
      count: count as number,
      total: 0 // Will be set below
    }));
    
    // Calculate total for percentage calculation
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
      if (sortConfig.key === 'title') {
        return sortConfig.direction === 'asc' 
          ? a.title.localeCompare(b.title)
          : b.title.localeCompare(a.title);
      }
      
      // For count sorting
      return sortConfig.direction === 'asc' 
        ? a.count - b.count
        : b.count - a.count;
    });

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Federal Regulations Overview
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Word Count
              </Typography>
              <Typography variant="h3">
                {formatNumber(metrics.totalWordCount)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Across all federal regulations
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Average Complexity Score
              </Typography>
              <Typography variant="h3">
                {metrics.avgComplexityScore.toFixed(1)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Scale: 0 (simple) - 100 (complex)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Average Readability Score
              </Typography>
              <Typography variant="h3">
                {metrics.avgReadabilityScore.toFixed(1)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Flesch Reading Ease (0-100)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Regulatory Keyword Frequency
            </Typography>
            {keywordData.length === 0 ? (
              <Box sx={{ 
                height: 400, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                bgcolor: 'action.hover',
                borderRadius: 1
              }}>
                <Typography variant="body1" color="text.secondary" align="center">
                  Keyword frequency data is not yet available.
                  <br />
                  Please wait for the text metrics analysis to complete.
                </Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart 
                  data={keywordData}
                  onClick={handleBarClick}
                  style={{ cursor: 'pointer' }}
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
                  content={<CustomTooltip />}
                  formatter={(value) => formatNumber(Number(value))} 
                />
                {metrics.keywordByTitle ? (
                  // Stacked bar chart with title breakdown
                  titleKeys.map((title, index) => {
                    // Generate colors for each title
                    const colors = [
                      '#1976d2', '#dc004e', '#f50057', '#9c27b0', '#673ab7',
                      '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688',
                      '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107',
                      '#ff9800', '#ff5722', '#795548', '#607d8b', '#455a64',
                      '#e91e63', '#00acc1', '#43a047', '#fdd835', '#fb8c00',
                      '#6d4c41', '#546e7a', '#37474f', '#78909c', '#827717',
                      '#bf360c', '#3e2723', '#212121', '#263238', '#1a237e',
                      '#311b92', '#4a148c', '#880e4f', '#b71c1c', '#d50000',
                      '#ff6f00', '#e65100', '#dd2c00', '#bf360c', '#3e2723',
                      '#212121', '#424242', '#616161', '#757575', '#9e9e9e'
                    ];
                    return (
                      <Bar 
                        key={title}
                        dataKey={title} 
                        stackId="a"
                        fill={colors[index % colors.length]}
                      />
                    );
                  })
                ) : (
                  // Simple bar chart
                  <Bar dataKey="count" fill="#1976d2" />
                )}
              </BarChart>
            </ResponsiveContainer>
            )}
            {metrics.keywordByTitle && keywordData.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Stacked by CFR Title. Click on any bar to see the full breakdown.
              </Typography>
            )}
          </Paper>
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
          </Box>
          
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={sortConfig.key === 'title'}
                      direction={sortConfig.key === 'title' ? sortConfig.direction : 'asc'}
                      onClick={() => handleSort('title')}
                    >
                      Title
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
                  <TableRow key={row.title}>
                    <TableCell>{row.title}</TableCell>
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
                        No titles found
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
    </Box>
  );
}