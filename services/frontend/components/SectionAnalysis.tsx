import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Grid,
  LinearProgress,
  Tooltip,
  Skeleton,
  useTheme,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import BusinessIcon from '@mui/icons-material/Business';
import HistoryIcon from '@mui/icons-material/History';
import PendingIcon from '@mui/icons-material/Pending';
import { useQuery } from 'react-query';
import axios from 'axios';

interface SectionAnalysisData {
  _id: string;
  documentId: string;
  summary: string;
  antiquatedScore: number;
  businessUnfriendlyScore: number;
  analyzedAt: string;
  modelUsed: string;
}

interface SectionAnalysisProps {
  documentId: string;
}


const getScoreColor = (score: number, type: 'antiquated' | 'business') => {
  if (score <= 30) return '#4caf50'; // Green - Good
  if (score <= 60) return '#ff9800'; // Orange - Medium
  return '#f44336'; // Red - High
};

const getScoreLabel = (score: number, type: 'antiquated' | 'business') => {
  if (type === 'antiquated') {
    if (score <= 30) return 'Modern';
    if (score <= 60) return 'Somewhat Dated';
    return 'Very Antiquated';
  } else {
    if (score <= 30) return 'Business-Friendly';
    if (score <= 60) return 'Moderate Burden';
    return 'High Burden';
  }
};

export default function SectionAnalysis({ documentId }: SectionAnalysisProps) {
  const theme = useTheme();
  const { data, isLoading, error } = useQuery(
    ['sectionAnalysis', documentId],
    async () => {
      const response = await axios.get(`/api/analysis/section/${documentId}`);
      return response.data as SectionAnalysisData;
    },
    {
      enabled: !!documentId,
      retry: 2, // Retry twice on failure
      retryDelay: 1000, // Wait 1 second between retries
      staleTime: 30 * 60 * 1000, // Consider data stale after 30 minutes
      cacheTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    }
  );

  if (!documentId) return null;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  // Show placeholder for sections not yet analyzed
  if (error || !data) {
    return (
      <Paper 
        elevation={1} 
        sx={{ 
          p: 2, 
          mb: 2, 
          backgroundColor: theme.palette.mode === 'dark' 
            ? theme.palette.background.paper 
            : theme.palette.grey[50],
          border: `1px solid ${theme.palette.divider}`,
          opacity: 0.7
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <PendingIcon sx={{ fontSize: 20, color: theme.palette.text.secondary }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
            AI Analysis Pending
          </Typography>
        </Box>

        {/* Summary Placeholder */}
        <Box sx={{ mb: 2 }}>
          <Skeleton variant="text" width="100%" height={20} />
          <Skeleton variant="text" width="80%" height={20} />
        </Box>

        {/* Scores Placeholders */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon sx={{ fontSize: 20, color: theme.palette.text.disabled }} />
              <Typography variant="body2" sx={{ fontWeight: 500, color: theme.palette.text.secondary }}>
                Language & Relevance
              </Typography>
            </Box>
            <Box sx={{ mt: 1 }}>
              <Skeleton variant="rectangular" width="100%" height={8} sx={{ borderRadius: 1 }} />
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mt: 0.5, display: 'block' }}>
                Not yet analyzed
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BusinessIcon sx={{ fontSize: 20, color: theme.palette.text.disabled }} />
              <Typography variant="body2" sx={{ fontWeight: 500, color: theme.palette.text.secondary }}>
                Business Impact
              </Typography>
            </Box>
            <Box sx={{ mt: 1 }}>
              <Skeleton variant="rectangular" width="100%" height={8} sx={{ borderRadius: 1 }} />
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mt: 0.5, display: 'block' }}>
                Not yet analyzed
              </Typography>
            </Box>
          </Grid>
        </Grid>

        <Typography variant="caption" sx={{ mt: 2, display: 'block', color: theme.palette.text.secondary }}>
          This section will be analyzed in the next processing cycle
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper 
      elevation={1} 
      sx={{ 
        p: 2, 
        mb: 2, 
        backgroundColor: theme.palette.mode === 'dark' 
          ? theme.palette.background.paper 
          : theme.palette.grey[50],
        border: `1px solid ${theme.palette.divider}`
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: theme.palette.text.primary }}>
        AI Analysis
      </Typography>

      {/* Summary */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ fontStyle: 'italic', color: theme.palette.text.primary }}>
          "{data.summary}"
        </Typography>
      </Box>

      {/* Scores */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon sx={{ fontSize: 20, color: theme.palette.text.secondary }} />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Language & Relevance
            </Typography>
            <Tooltip title="Rates how outdated the language and subject matter are (1-100 scale)">
              <InfoOutlinedIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
            </Tooltip>
          </Box>
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <LinearProgress
                variant="determinate"
                value={data.antiquatedScore}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: theme.palette.action.hover,
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: getScoreColor(data.antiquatedScore, 'antiquated'),
                    borderRadius: 4,
                  }
                }}
              />
            </Box>
            <Chip
              label={`${data.antiquatedScore}/100`}
              size="small"
              sx={{
                backgroundColor: getScoreColor(data.antiquatedScore, 'antiquated'),
                color: 'white',
                fontWeight: 600,
                minWidth: 50,
              }}
            />
          </Box>
          <Typography 
            variant="caption" 
            sx={{ 
              color: getScoreColor(data.antiquatedScore, 'antiquated'),
              fontWeight: 500,
              mt: 0.5,
              display: 'block'
            }}
          >
            {getScoreLabel(data.antiquatedScore, 'antiquated')}
          </Typography>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BusinessIcon sx={{ fontSize: 20, color: theme.palette.text.secondary }} />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Business Impact
            </Typography>
            <Tooltip title="Rates regulatory burden on businesses (1-100 scale)">
              <InfoOutlinedIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
            </Tooltip>
          </Box>
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <LinearProgress
                variant="determinate"
                value={data.businessUnfriendlyScore}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: theme.palette.action.hover,
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: getScoreColor(data.businessUnfriendlyScore, 'business'),
                    borderRadius: 4,
                  }
                }}
              />
            </Box>
            <Chip
              label={`${data.businessUnfriendlyScore}/100`}
              size="small"
              sx={{
                backgroundColor: getScoreColor(data.businessUnfriendlyScore, 'business'),
                color: 'white',
                fontWeight: 600,
                minWidth: 50,
              }}
            />
          </Box>
          <Typography 
            variant="caption" 
            sx={{ 
              color: getScoreColor(data.businessUnfriendlyScore, 'business'),
              fontWeight: 500,
              mt: 0.5,
              display: 'block'
            }}
          >
            {getScoreLabel(data.businessUnfriendlyScore, 'business')}
          </Typography>
        </Grid>
      </Grid>

      <Typography variant="caption" sx={{ mt: 2, display: 'block', color: theme.palette.text.secondary }}>
        Analyzed on {new Date(data.analyzedAt).toLocaleDateString()} using {data.modelUsed}
      </Typography>
    </Paper>
  );
}