import React from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import HistoryIcon from '@mui/icons-material/History';
import LaunchIcon from '@mui/icons-material/Launch';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useQuery } from 'react-query';
import axios from 'axios';
import { useRouter } from 'next/router';

interface AnalyzedSection {
  _id: string;
  documentId: {
    _id: string;
    heading: string;
    identifier: string;
    titleNumber: number;
    part: string;
    section: string;
  };
  titleNumber: number;
  identifier: string;
  summary: string;
  antiquatedScore: number;
  businessUnfriendlyScore: number;
  title: string;
  cfr: string;
}


const getScoreColor = (score: number) => {
  if (score <= 30) return '#4caf50';  // Green for low scores
  if (score <= 60) return '#ff9800';  // Orange for medium scores
  return '#f44336';  // Red for high scores
};

function SectionCard({ 
  title, 
  icon, 
  sections, 
  scoreType,
  onNavigate 
}: {
  title: string;
  icon: React.ReactNode;
  sections: AnalyzedSection[];
  scoreType: 'antiquated' | 'business';
  onNavigate: (section: AnalyzedSection) => void;
}) {
  return (
    <Card elevation={2}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          {icon}
          <Typography variant="h6">{title}</Typography>
        </Box>

        <List sx={{ p: 0 }}>
          {sections.map((section, index) => {
            const score = scoreType === 'antiquated' 
              ? section.antiquatedScore 
              : section.businessUnfriendlyScore;

            return (
              <ListItem 
                key={section._id}
                sx={{ 
                  px: 0,
                  py: 1.5,
                  borderBottom: index < sections.length - 1 ? '1px solid #e0e0e0' : 'none',
                  alignItems: 'flex-start',
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Chip
                        label={`${score}/100`}
                        size="small"
                        sx={{
                          backgroundColor: getScoreColor(score),
                          color: 'white',
                          fontWeight: 600,
                          minWidth: 55,
                        }}
                      />
                      <Typography 
                        variant="subtitle2" 
                        sx={{ 
                          flex: 1,
                          fontWeight: 500,
                          cursor: 'pointer',
                          '&:hover': { textDecoration: 'underline' }
                        }}
                        onClick={() => onNavigate(section)}
                      >
                        {section.cfr} - {section.documentId?.heading || section.identifier}
                      </Typography>
                      <Tooltip title="View section">
                        <IconButton 
                          size="small"
                          onClick={() => onNavigate(section)}
                        >
                          <LaunchIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  }
                  secondary={
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: 'text.secondary',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        mt: 0.5
                      }}
                    >
                      {section.summary}
                    </Typography>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      </CardContent>
    </Card>
  );
}

export default function HighlightedSections() {
  const router = useRouter();

  const { 
    data: antiquatedData, 
    isLoading: antiquatedLoading,
    error: antiquatedError,
    refetch: refetchAntiquated
  } = useQuery<AnalyzedSection[], Error>(
    'antiquatedSections',
    async () => {
      const response = await axios.get(`/api/analysis/antiquated?limit=5`);
      return response.data as AnalyzedSection[];
    },
    {
      staleTime: 10 * 60 * 1000, // Consider data stale after 10 minutes
      cacheTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
      retry: 3, // Retry failed requests 3 times
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    }
  );

  const { 
    data: businessData, 
    isLoading: businessLoading,
    error: businessError,
    refetch: refetchBusiness
  } = useQuery<AnalyzedSection[], Error>(
    'businessUnfriendlySections',
    async () => {
      const response = await axios.get(`/api/analysis/business-unfriendly?limit=5`);
      return response.data as AnalyzedSection[];
    },
    {
      staleTime: 10 * 60 * 1000, // Consider data stale after 10 minutes
      cacheTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
      retry: 3, // Retry failed requests 3 times
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    }
  );

  const handleNavigate = (section: AnalyzedSection) => {
    // Navigate to the title page with the section identifier as a query param
    router.push({
      pathname: `/title/${section.titleNumber}`,
      query: { section: section.identifier }
    });
  };

  if (antiquatedLoading || businessLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const hasData = (antiquatedData && antiquatedData.length > 0) || 
                  (businessData && businessData.length > 0) ||
                  antiquatedError || businessError;

  if (!hasData && !antiquatedLoading && !businessLoading) {
    // Show placeholder when no sections have been analyzed yet
    return (
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
          Regulatory Analysis Insights
        </Typography>
        
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            AI analysis is pending. Sections will be analyzed during the next processing cycle.
            You can manually trigger analysis from the Settings page.
          </Typography>
        </Alert>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card elevation={2}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <HistoryIcon sx={{ color: '#f57c00' }} />
                  <Typography variant="h6">Most Outdated Sections</Typography>
                </Box>
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No sections analyzed yet
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card elevation={2}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <BusinessIcon sx={{ color: '#d32f2f' }} />
                  <Typography variant="h6">Highest Business Burden</Typography>
                </Box>
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No sections analyzed yet
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="outlined"
            onClick={() => router.push('/settings')}
          >
            Go to Settings to Trigger Analysis
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
        Regulatory Analysis Insights
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          {antiquatedError ? (
            <Card elevation={2}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <HistoryIcon sx={{ color: '#f57c00' }} />
                  <Typography variant="h6">Most Outdated Sections</Typography>
                </Box>
                <Alert severity="error" action={
                  <IconButton size="small" onClick={() => refetchAntiquated()}>
                    <RefreshIcon />
                  </IconButton>
                }>
                  Failed to load data
                </Alert>
              </CardContent>
            </Card>
          ) : antiquatedData && antiquatedData.length > 0 ? (
            <SectionCard
              title="Most Outdated Sections"
              icon={<HistoryIcon sx={{ color: '#f57c00' }} />}
              sections={antiquatedData}
              scoreType="antiquated"
              onNavigate={handleNavigate}
            />
          ) : null}
        </Grid>

        <Grid item xs={12} md={6}>
          {businessError ? (
            <Card elevation={2}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <BusinessIcon sx={{ color: '#d32f2f' }} />
                  <Typography variant="h6">Highest Business Burden</Typography>
                </Box>
                <Alert severity="error" action={
                  <IconButton size="small" onClick={() => refetchBusiness()}>
                    <RefreshIcon />
                  </IconButton>
                }>
                  Failed to load data
                </Alert>
              </CardContent>
            </Card>
          ) : businessData && businessData.length > 0 ? (
            <SectionCard
              title="Highest Business Burden"
              icon={<BusinessIcon sx={{ color: '#d32f2f' }} />}
              sections={businessData}
              scoreType="business"
              onNavigate={handleNavigate}
            />
          ) : null}
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="outlined"
          onClick={() => router.push('/analysis')}
        >
          View Full Analysis Dashboard
        </Button>
      </Box>
    </Box>
  );
}