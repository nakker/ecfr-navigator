import React from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Chip,
  Button,
  Tooltip,
  IconButton,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useQuery } from 'react-query';
import { useRouter } from 'next/router';
import axios from 'axios';


interface AnalysisStats {
  totalAnalyzed: number;
  totalSections: number;
  percentageAnalyzed: number;
  averageAntiquatedScore: number;
  averageBusinessUnfriendlyScore: number;
}

export default function AnalysisStatus() {
  const router = useRouter();

  const { data: stats, isLoading, refetch } = useQuery<AnalysisStats>(
    'analysisStats',
    async () => {
      const response = await axios.get(`/api/analysis/stats`);
      return response.data;
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    }
  );

  if (isLoading) {
    return null;
  }

  if (!stats) {
    return null;
  }

  const isFullyAnalyzed = stats.percentageAnalyzed === 100;

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            AI Analysis Status
          </Typography>
          <Tooltip title="AI analysis provides summaries and scores for regulatory sections">
            <IconButton size="small">
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={() => refetch()}>
            <RefreshIcon fontSize="small" />
          </IconButton>
          {isFullyAnalyzed ? (
            <Chip
              icon={<CheckCircleIcon />}
              label="Complete"
              color="success"
              size="small"
            />
          ) : (
            <Chip
              icon={<PendingIcon />}
              label="In Progress"
              color="warning"
              size="small"
            />
          )}
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Sections Analyzed
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {stats.totalAnalyzed.toLocaleString()} / {stats.totalSections.toLocaleString()}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={stats.percentageAnalyzed}
          sx={{
            height: 10,
            borderRadius: 5,
            backgroundColor: '#e0e0e0',
            '& .MuiLinearProgress-bar': {
              borderRadius: 5,
              backgroundColor: isFullyAnalyzed ? '#4caf50' : '#ff9800',
            }
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {stats.percentageAnalyzed}% complete
        </Typography>
      </Box>

      {stats.totalAnalyzed > 0 && (
        <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Avg. Antiquated Score
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {stats.averageAntiquatedScore.toFixed(1)}/100
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Avg. Business Impact
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {stats.averageBusinessUnfriendlyScore.toFixed(1)}/100
            </Typography>
          </Box>
        </Box>
      )}

      {!isFullyAnalyzed && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => router.push('/settings')}
          >
            Trigger Analysis
          </Button>
        </Box>
      )}
    </Paper>
  );
}