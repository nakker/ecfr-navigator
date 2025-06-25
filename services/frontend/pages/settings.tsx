import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  CardHeader,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Switch,
  FormControlLabel,
  TextField,
  LinearProgress,
  IconButton,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PendingIcon from '@mui/icons-material/Pending';
import ScheduleIcon from '@mui/icons-material/Schedule';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import StorageIcon from '@mui/icons-material/Storage';
import SpeedIcon from '@mui/icons-material/Speed';
import SecurityIcon from '@mui/icons-material/Security';
import SyncIcon from '@mui/icons-material/Sync';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import StopIcon from '@mui/icons-material/Stop';
import SearchIcon from '@mui/icons-material/Search';
import BuildIcon from '@mui/icons-material/Build';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RestoreIcon from '@mui/icons-material/Restore';
import LabelIcon from '@mui/icons-material/Label';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import Navigation from '../components/Navigation';
import { useTheme } from '../contexts/ThemeContext';
import AnalysisThreadsControl from '../components/AnalysisThreadsControl';


interface ServiceStatus {
  service: string;
  status: 'healthy' | 'unhealthy' | 'inactive' | 'unknown';
  latestRun: {
    startTime?: string;
    endTime?: string;
    status: string;
    processedTitles?: number;
    totalTitles?: number;
    failedTitles?: number;
    error?: string;
  } | null;
  details?: any;
}

const ServiceStatusCard: React.FC<{
  title: string;
  serviceKey: string;
  onTrigger: () => void;
  isTriggering: boolean;
  onStop?: () => void;
  isStopping?: boolean;
}> = ({ title, serviceKey, onTrigger, isTriggering, onStop, isStopping }) => {
  const { data: status, isLoading, error } = useQuery<ServiceStatus>(
    ['service-status', serviceKey],
    async () => {
      const response = await axios.get(`/api/services/${serviceKey}/status`);
      return response.data;
    },
    {
      refetchInterval: 10000, // Refresh every 10 seconds
    }
  );

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'unhealthy':
        return 'error';
      case 'inactive':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleIcon color="success" />;
      case 'unhealthy':
        return <ErrorIcon color="error" />;
      case 'inactive':
        return <PendingIcon color="warning" />;
      default:
        return <ScheduleIcon />;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (start?: string, end?: string) => {
    if (!start || !end) return 'N/A';
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">Failed to load service status</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="h6" component="h2">
            {title}
          </Typography>
          <Chip
            icon={getStatusIcon(status?.status)}
            label={status?.status || 'unknown'}
            color={getStatusColor(status?.status)}
            size="small"
          />
        </Box>

        <Divider sx={{ my: 1 }} />

        {status?.latestRun && (
          <Box sx={{ mt: 1 }}>
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <ScheduleIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {formatDate(status.latestRun.startTime)}
                {status.latestRun.endTime && ` • ${formatDuration(status.latestRun.startTime, status.latestRun.endTime)}`}
              </Typography>
            </Box>

            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
              <Chip
                label={status.latestRun.status}
                size="small"
                color={status.latestRun.status === 'completed' ? 'success' : 
                       status.latestRun.status === 'failed' ? 'error' : 'default'}
              />
              
              {status.latestRun.processedTitles !== undefined && (
                <Typography variant="caption" color="text.secondary">
                  {status.latestRun.processedTitles} / {status.latestRun.totalTitles || 0} titles
                </Typography>
              )}
              
              {status.latestRun.failedTitles !== undefined && status.latestRun.failedTitles > 0 && (
                <Typography variant="caption" color="error">
                  {status.latestRun.failedTitles} failed
                </Typography>
              )}
            </Box>

            {status.latestRun.error && (
              <Alert severity="error" sx={{ mt: 1, py: 0.5 }}>
                <Typography variant="caption">{status.latestRun.error}</Typography>
              </Alert>
            )}
          </Box>
        )}

        {!status?.latestRun && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            No run history available
          </Typography>
        )}
      </CardContent>

      <CardActions sx={{ pt: 0, pb: 1.5 }}>
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={onTrigger}
          disabled={isTriggering || status?.latestRun?.status === 'in_progress' || isStopping}
          variant="contained"
        >
          {isTriggering ? 'Triggering...' : 'Trigger Manually'}
        </Button>
        {serviceKey === 'data-analysis' && status?.latestRun?.status === 'in_progress' && onStop && (
          <Button
            size="small"
            startIcon={<StopIcon />}
            onClick={onStop}
            disabled={isStopping}
            variant="outlined"
            color="error"
            sx={{ ml: 1 }}
          >
            {isStopping ? 'Stopping...' : 'Stop Analysis'}
          </Button>
        )}
      </CardActions>
    </Card>
  );
};

export default function Settings() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mode, toggleTheme } = useTheme();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [titleNumber, setTitleNumber] = useState<string>('');
  const [titleRefreshProgress, setTitleRefreshProgress] = useState<any>(null);
  const [analysisTitleNumber, setAnalysisTitleNumber] = useState<string>('');
  const [titleAnalysisProgress, setTitleAnalysisProgress] = useState<any>(null);
  const [newKeyword, setNewKeyword] = useState<string>('');
  const [keywords, setKeywords] = useState<string[]>([]);

  const triggerRefreshMutation = useMutation(
    async () => {
      const response = await axios.post(`/api/services/data-refresh/trigger`);
      return response.data;
    },
    {
      onSuccess: () => {
        setSuccessMessage('Data refresh triggered successfully');
        setErrorMessage(null);
        queryClient.invalidateQueries(['service-status', 'data-refresh']);
        setTimeout(() => setSuccessMessage(null), 5000);
      },
      onError: (error: any) => {
        setErrorMessage(error.response?.data?.error || 'Failed to trigger refresh');
        setSuccessMessage(null);
        setTimeout(() => setErrorMessage(null), 5000);
      },
    }
  );


  const triggerSingleTitleMutation = useMutation(
    async (titleNum: string) => {
      const response = await axios.post(`/api/services/data-refresh/trigger-title`, {
        titleNumber: titleNum
      });
      return response.data;
    },
    {
      onSuccess: (data) => {
        setSuccessMessage(`Title ${titleNumber} refresh triggered successfully`);
        setErrorMessage(null);
        setTitleNumber('');
        queryClient.invalidateQueries(['service-status', 'data-refresh']);
        // Start polling for progress
        pollTitleRefreshProgress(data.refreshId);
        setTimeout(() => setSuccessMessage(null), 5000);
      },
      onError: (error: any) => {
        setErrorMessage(error.response?.data?.error || 'Failed to trigger title refresh');
        setSuccessMessage(null);
        setTimeout(() => setErrorMessage(null), 5000);
      },
    }
  );

  // Poll for single title refresh progress
  const pollTitleRefreshProgress = async (refreshId: string) => {
    try {
      const response = await axios.get(`/api/refresh/progress?type=single_title`);
      const progress = response.data;
      
      if (progress.status === 'in_progress') {
        setTitleRefreshProgress(progress);
        // Continue polling
        setTimeout(() => pollTitleRefreshProgress(refreshId), 2000);
      } else if (progress.status === 'completed' || progress.status === 'failed') {
        setTitleRefreshProgress(progress);
        // Stop polling after a delay
        setTimeout(() => setTitleRefreshProgress(null), 10000);
      }
    } catch (error) {
      console.error('Failed to poll refresh progress:', error);
      setTitleRefreshProgress(null);
    }
  };

  const triggerSingleTitleAnalysisMutation = useMutation(
    async (titleNum: string) => {
      const response = await axios.post(`/api/services/data-analysis/trigger-title`, {
        titleNumber: titleNum
      });
      return response.data;
    },
    {
      onSuccess: (data) => {
        setSuccessMessage(`Title ${analysisTitleNumber} analysis triggered successfully`);
        setErrorMessage(null);
        setAnalysisTitleNumber('');
        queryClient.invalidateQueries(['service-status', 'data-analysis']);
        // Start polling for progress
        pollTitleAnalysisProgress(data.analysisId);
        setTimeout(() => setSuccessMessage(null), 5000);
      },
      onError: (error: any) => {
        setErrorMessage(error.response?.data?.error || 'Failed to trigger title analysis');
        setSuccessMessage(null);
        setTimeout(() => setErrorMessage(null), 5000);
      },
    }
  );

  // Poll for single title analysis progress
  const pollTitleAnalysisProgress = async (analysisId: string) => {
    try {
      const response = await axios.get(`/api/analysis/progress?type=single_title`);
      const progress = response.data;
      
      if (progress && progress.status === 'in_progress') {
        setTitleAnalysisProgress(progress);
        // Continue polling
        setTimeout(() => pollTitleAnalysisProgress(analysisId), 2000);
      } else if (progress && (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled')) {
        setTitleAnalysisProgress(progress);
        // Stop polling after a delay
        setTimeout(() => setTitleAnalysisProgress(null), 10000);
      }
    } catch (error) {
      console.error('Failed to poll analysis progress:', error);
      setTitleAnalysisProgress(null);
    }
  };

  const validateTitleNumber = (value: string) => {
    const num = parseInt(value);
    return !isNaN(num) && num >= 1 && num <= 50;
  };

  // Keywords query
  const { data: keywordsData, refetch: refetchKeywords } = useQuery(
    'regulatory-keywords',
    async () => {
      const response = await axios.get(`/api/settings/keywords`);
      return response.data;
    },
    {
      onSuccess: (data) => {
        setKeywords(data.keywords || []);
      },
    }
  );

  // Update keywords mutation
  const updateKeywordsMutation = useMutation(
    async (updatedKeywords: string[]) => {
      const response = await axios.put(`/api/settings/keywords`, {
        keywords: updatedKeywords
      });
      return response.data;
    },
    {
      onSuccess: (data) => {
        setSuccessMessage('Keywords updated successfully');
        setErrorMessage(null);
        setKeywords(data.keywords);
        queryClient.invalidateQueries('regulatory-keywords');
        setTimeout(() => setSuccessMessage(null), 5000);
      },
      onError: (error: any) => {
        setErrorMessage(error.response?.data?.error || 'Failed to update keywords');
        setSuccessMessage(null);
        setTimeout(() => setErrorMessage(null), 5000);
      },
    }
  );

  // Reset keywords mutation
  const resetKeywordsMutation = useMutation(
    async () => {
      const response = await axios.post(`/api/settings/keywords/reset`);
      return response.data;
    },
    {
      onSuccess: (data) => {
        setSuccessMessage('Keywords reset to defaults');
        setErrorMessage(null);
        setKeywords(data.keywords);
        queryClient.invalidateQueries('regulatory-keywords');
        setTimeout(() => setSuccessMessage(null), 5000);
      },
      onError: (error: any) => {
        setErrorMessage(error.response?.data?.error || 'Failed to reset keywords');
        setSuccessMessage(null);
        setTimeout(() => setErrorMessage(null), 5000);
      },
    }
  );

  const handleAddKeyword = () => {
    const trimmedKeyword = newKeyword.trim().toLowerCase();
    if (trimmedKeyword && !keywords.includes(trimmedKeyword)) {
      const updatedKeywords = [...keywords, trimmedKeyword];
      updateKeywordsMutation.mutate(updatedKeywords);
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (keywordToRemove: string) => {
    const updatedKeywords = keywords.filter(k => k !== keywordToRemove);
    updateKeywordsMutation.mutate(updatedKeywords);
  };

  // Search index rebuild status query
  const { data: searchIndexStatus, refetch: refetchIndexStatus } = useQuery(
    'search-index-status',
    async () => {
      const response = await axios.get(`/api/services/search-index/status`);
      return response.data;
    },
    {
      refetchInterval: (data) => {
        // Poll every 2 seconds if rebuilding
        if (data?.latestRebuild?.status === 'in_progress') {
          return 2000;
        }
        return false;
      },
    }
  );

  // Rebuild search index mutation
  const rebuildIndexMutation = useMutation(
    async () => {
      const response = await axios.post(`/api/services/search-index/rebuild`);
      return response.data;
    },
    {
      onSuccess: () => {
        setSuccessMessage('Search index rebuild started successfully');
        setErrorMessage(null);
        queryClient.invalidateQueries('search-index-status');
        setTimeout(() => setSuccessMessage(null), 5000);
      },
      onError: (error: any) => {
        setErrorMessage(error.response?.data?.error || 'Failed to start index rebuild');
        setSuccessMessage(null);
        setTimeout(() => setErrorMessage(null), 5000);
      },
    }
  );

  return (
    <>
      <Head>
        <title>Settings - eCFR Navigator</title>
        <meta name="description" content="System settings and service management" />
      </Head>

      <Navigation />

      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <IconButton 
              onClick={() => router.back()}
              sx={{ mr: 2 }}
              aria-label="Go back"
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" component="h1">
              System Settings
            </Typography>
          </Box>

          <Typography variant="body1" color="text.secondary" paragraph>
            Monitor and manage system services
          </Typography>

          {successMessage && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {successMessage}
            </Alert>
          )}

          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Appearance Settings */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader
                  title="Appearance"
                  avatar={mode === 'light' ? <Brightness7Icon /> : <Brightness4Icon />}
                />
                <CardContent>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="Dark Mode"
                        secondary="Switch between light and dark themes"
                      />
                      <ListItemSecondaryAction>
                        <Switch
                          checked={mode === 'dark'}
                          onChange={toggleTheme}
                          inputProps={{ 'aria-label': 'toggle dark mode' }}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            {/* Data Refresh Service */}
            <Grid item xs={12} md={6}>
              <ServiceStatusCard
                title="Data Refresh Service"
                serviceKey="data-refresh"
                onTrigger={() => triggerRefreshMutation.mutate()}
                isTriggering={triggerRefreshMutation.isLoading}
              />
            </Grid>

            {/* Analysis Threads Control */}
            <Grid item xs={12}>
              <AnalysisThreadsControl />
            </Grid>

            {/* Regulatory Keywords */}
            <Grid item xs={12}>
              <Card>
                <CardHeader
                  title="Regulatory Keywords"
                  avatar={<LabelIcon />}
                />
                <CardContent>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Customize the keywords that are tracked during text analysis. These keywords are used to calculate
                    frequency statistics and identify regulatory patterns across all CFR titles.
                  </Typography>
                  
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-start' }}>
                      <TextField
                        size="small"
                        label="Add new keyword"
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddKeyword();
                          }
                        }}
                        helperText="Press Enter to add"
                        sx={{ flex: 1, maxWidth: 300 }}
                      />
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleAddKeyword}
                        disabled={!newKeyword.trim() || updateKeywordsMutation.isLoading}
                      >
                        Add
                      </Button>
                    </Box>
                    
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {keywords.map((keyword) => (
                        <Chip
                          key={keyword}
                          label={keyword}
                          onDelete={() => handleRemoveKeyword(keyword)}
                          deleteIcon={<DeleteIcon />}
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                    
                    {keywords.length === 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        No keywords configured. Add keywords to track their frequency in regulations.
                      </Typography>
                    )}
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Button
                      variant="outlined"
                      startIcon={<RestoreIcon />}
                      onClick={() => resetKeywordsMutation.mutate()}
                      disabled={resetKeywordsMutation.isLoading || updateKeywordsMutation.isLoading}
                    >
                      Reset to Defaults
                    </Button>
                    
                    <Typography variant="caption" color="text.secondary">
                      Default keywords: shall, must, prohibited, required, fee, cost, reporting requirement
                    </Typography>
                  </Box>
                  
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="caption">
                      <strong>Note:</strong> Changes to keywords will only affect future text analyses. 
                      You'll need to re-run the text metrics analysis for changes to take effect on existing data.
                    </Typography>
                  </Alert>
                </CardContent>
              </Card>
            </Grid>

            {/* Single Title Resync Card */}
            <Grid item xs={12}>
              <Card>
                <CardHeader
                  title="Resync Specific Title"
                  avatar={<MenuBookIcon />}
                />
                <CardContent>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Refresh a specific CFR title by entering its number (1-50). This will download the latest XML,
                    delete existing documents, and parse the new content.
                  </Typography>
                  
                  {titleRefreshProgress && (
                    <Box mb={3}>
                      <Alert severity={titleRefreshProgress.status === 'failed' ? 'error' : 'info'}>
                        <Typography variant="body2">
                          {titleRefreshProgress.status === 'in_progress' ? (
                            <>
                              <SyncIcon fontSize="small" sx={{ animation: 'spin 2s linear infinite', verticalAlign: 'middle', mr: 1 }} />
                              Processing Title {titleRefreshProgress.currentTitle?.number}: {titleRefreshProgress.currentTitle?.name}
                            </>
                          ) : titleRefreshProgress.status === 'completed' ? (
                            <>
                              <CheckCircleIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                              Successfully refreshed Title {titleRefreshProgress.lastProcessedTitle?.number}: {titleRefreshProgress.lastProcessedTitle?.name}
                            </>
                          ) : (
                            <>
                              <ErrorIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                              Failed to refresh title: {titleRefreshProgress.lastError || 'Unknown error'}
                            </>
                          )}
                        </Typography>
                      </Alert>
                      {titleRefreshProgress.status === 'in_progress' && (
                        <LinearProgress sx={{ mt: 1 }} />
                      )}
                    </Box>
                  )}
                  
                  <Box display="flex" gap={2} alignItems="flex-start">
                    <TextField
                      label="Title Number"
                      value={titleNumber}
                      onChange={(e) => setTitleNumber(e.target.value)}
                      type="number"
                      InputProps={{
                        inputProps: { min: 1, max: 50 }
                      }}
                      error={titleNumber !== '' && !validateTitleNumber(titleNumber)}
                      helperText={
                        titleNumber !== '' && !validateTitleNumber(titleNumber)
                          ? 'Title number must be between 1 and 50'
                          : 'Enter a title number (1-50)'
                      }
                      size="small"
                      sx={{ width: 200 }}
                    />
                    <Button
                      variant="contained"
                      startIcon={<SyncIcon />}
                      onClick={() => triggerSingleTitleMutation.mutate(titleNumber)}
                      disabled={
                        !titleNumber ||
                        !validateTitleNumber(titleNumber) ||
                        triggerSingleTitleMutation.isLoading ||
                        titleRefreshProgress?.status === 'in_progress'
                      }
                    >
                      {triggerSingleTitleMutation.isLoading ? 'Triggering...' : 'Resync Title'}
                    </Button>
                  </Box>
                  
                  <Box mt={2}>
                    <Alert severity="warning" variant="outlined">
                      <Typography variant="caption">
                        <strong>Note:</strong> Title 26 (Internal Revenue) is very large and may take longer to process.
                        The refresh will handle errors gracefully and continue processing.
                      </Typography>
                    </Alert>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Single Title Analysis Card */}
            <Grid item xs={12}>
              <Card>
                <CardHeader
                  title="Reanalyze Specific Title"
                  avatar={<AnalyticsIcon />}
                />
                <CardContent>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Run AI analysis on a specific CFR title by entering its number (1-50). This will analyze all sections
                    in the title for summary, antiquated score, and business-unfriendly score.
                  </Typography>
                  
                  {titleAnalysisProgress && (
                    <Box mb={3}>
                      <Alert severity={
                        titleAnalysisProgress.status === 'failed' ? 'error' : 
                        titleAnalysisProgress.status === 'cancelled' ? 'warning' : 
                        'info'
                      }>
                        <Typography variant="body2">
                          {titleAnalysisProgress.status === 'in_progress' ? (
                            <>
                              <SyncIcon fontSize="small" sx={{ animation: 'spin 2s linear infinite', verticalAlign: 'middle', mr: 1 }} />
                              Analyzing Title {titleAnalysisProgress.currentTitle?.number}
                              {titleAnalysisProgress.processedTitles > 0 && (
                                <> - Progress: {titleAnalysisProgress.processedTitles}/{titleAnalysisProgress.totalTitles}</>
                              )}
                            </>
                          ) : titleAnalysisProgress.status === 'completed' ? (
                            <>
                              <CheckCircleIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                              Successfully analyzed Title {titleAnalysisProgress.metadata?.targetTitle}
                            </>
                          ) : titleAnalysisProgress.status === 'cancelled' ? (
                            <>
                              <StopIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                              Analysis cancelled. Processed {titleAnalysisProgress.processedTitles || 0} of {titleAnalysisProgress.totalTitles || 0} titles.
                            </>
                          ) : (
                            <>
                              <ErrorIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                              Failed to analyze title: {titleAnalysisProgress.error || 'Unknown error'}
                            </>
                          )}
                        </Typography>
                      </Alert>
                      {titleAnalysisProgress.status === 'in_progress' && (
                        <LinearProgress sx={{ mt: 1 }} />
                      )}
                    </Box>
                  )}
                  
                  <Box display="flex" gap={2} alignItems="flex-start">
                    <TextField
                      label="Title Number"
                      value={analysisTitleNumber}
                      onChange={(e) => setAnalysisTitleNumber(e.target.value)}
                      type="number"
                      InputProps={{
                        inputProps: { min: 1, max: 50 }
                      }}
                      error={analysisTitleNumber !== '' && !validateTitleNumber(analysisTitleNumber)}
                      helperText={
                        analysisTitleNumber !== '' && !validateTitleNumber(analysisTitleNumber)
                          ? 'Title number must be between 1 and 50'
                          : 'Enter a title number (1-50)'
                      }
                      size="small"
                      sx={{ width: 200 }}
                    />
                    <Button
                      variant="contained"
                      startIcon={<AnalyticsIcon />}
                      onClick={() => triggerSingleTitleAnalysisMutation.mutate(analysisTitleNumber)}
                      disabled={
                        !analysisTitleNumber ||
                        !validateTitleNumber(analysisTitleNumber) ||
                        triggerSingleTitleAnalysisMutation.isLoading ||
                        titleAnalysisProgress?.status === 'in_progress'
                      }
                    >
                      {triggerSingleTitleAnalysisMutation.isLoading ? 'Triggering...' : 'Reanalyze Title'}
                    </Button>
                  </Box>
                  
                  <Box mt={2}>
                    <Alert severity="info" variant="outlined">
                      <Typography variant="caption">
                        <strong>Note:</strong> This will analyze all sections within the selected title using AI to generate
                        summaries and scores. The analysis may take several minutes depending on the size of the title.
                      </Typography>
                    </Alert>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Search Index Rebuild Card */}
            <Grid item xs={12}>
              <Card>
                <CardHeader
                  title="Search Index Management"
                  avatar={<SearchIcon />}
                />
                <CardContent>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Rebuild the Elasticsearch search index to ensure all documents are properly indexed and searchable.
                    This process will delete the existing index and re-index all documents from the database.
                  </Typography>
                  
                  {searchIndexStatus?.latestRebuild && (
                    <Box mb={3}>
                      <Alert 
                        severity={
                          searchIndexStatus.latestRebuild.status === 'completed' ? 'success' :
                          searchIndexStatus.latestRebuild.status === 'failed' ? 'error' :
                          searchIndexStatus.latestRebuild.status === 'in_progress' ? 'info' : 'info'
                        }
                      >
                        <Typography variant="body2">
                          {searchIndexStatus.latestRebuild.status === 'in_progress' ? (
                            <>
                              <BuildIcon fontSize="small" sx={{ animation: 'spin 2s linear infinite', verticalAlign: 'middle', mr: 1 }} />
                              Rebuilding index... 
                              {searchIndexStatus.latestRebuild.currentTitle && (
                                <> Processing Title {searchIndexStatus.latestRebuild.currentTitle.number}: {searchIndexStatus.latestRebuild.currentTitle.name}</>
                              )}
                            </>
                          ) : searchIndexStatus.latestRebuild.status === 'completed' ? (
                            <>
                              <CheckCircleIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                              Index rebuild completed successfully. 
                              Indexed: {searchIndexStatus.latestRebuild.indexedDocuments?.toLocaleString() || 0} documents
                              {searchIndexStatus.latestRebuild.failedDocuments > 0 && (
                                <>, Failed: {searchIndexStatus.latestRebuild.failedDocuments}</>
                              )}
                            </>
                          ) : searchIndexStatus.latestRebuild.status === 'failed' ? (
                            <>
                              <ErrorIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                              Index rebuild failed: {searchIndexStatus.latestRebuild.error || 'Unknown error'}
                            </>
                          ) : (
                            <>Status: {searchIndexStatus.latestRebuild.status}</>
                          )}
                        </Typography>
                      </Alert>
                      
                      {searchIndexStatus.latestRebuild.status === 'in_progress' && (
                        <Box sx={{ mt: 2 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={
                              searchIndexStatus.latestRebuild.totalDocuments > 0 
                                ? (searchIndexStatus.latestRebuild.processedDocuments / searchIndexStatus.latestRebuild.totalDocuments) * 100 
                                : 0
                            } 
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            Progress: {searchIndexStatus.latestRebuild.processedDocuments?.toLocaleString() || 0} / {searchIndexStatus.latestRebuild.totalDocuments?.toLocaleString() || 0} documents
                          </Typography>
                          
                          {searchIndexStatus.latestRebuild.operations && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="caption" color="text.secondary">
                                <strong>Operations:</strong>
                              </Typography>
                              <List dense sx={{ mt: 0 }}>
                                <ListItem sx={{ py: 0 }}>
                                  <ListItemIcon sx={{ minWidth: 30 }}>
                                    {searchIndexStatus.latestRebuild.operations.deleteIndex?.completed ? 
                                      <CheckCircleIcon fontSize="small" color="success" /> : 
                                      <CircularProgress size={16} />
                                    }
                                  </ListItemIcon>
                                  <ListItemText 
                                    primary="Delete existing index" 
                                    primaryTypographyProps={{ variant: 'caption' }}
                                  />
                                </ListItem>
                                <ListItem sx={{ py: 0 }}>
                                  <ListItemIcon sx={{ minWidth: 30 }}>
                                    {searchIndexStatus.latestRebuild.operations.createIndex?.completed ? 
                                      <CheckCircleIcon fontSize="small" color="success" /> : 
                                      searchIndexStatus.latestRebuild.operations.deleteIndex?.completed ?
                                      <CircularProgress size={16} /> : 
                                      <RadioButtonUncheckedIcon fontSize="small" color="disabled" />
                                    }
                                  </ListItemIcon>
                                  <ListItemText 
                                    primary="Create new index" 
                                    primaryTypographyProps={{ variant: 'caption' }}
                                  />
                                </ListItem>
                                <ListItem sx={{ py: 0 }}>
                                  <ListItemIcon sx={{ minWidth: 30 }}>
                                    {searchIndexStatus.latestRebuild.operations.indexDocuments?.completed ? 
                                      <CheckCircleIcon fontSize="small" color="success" /> : 
                                      searchIndexStatus.latestRebuild.operations.createIndex?.completed ?
                                      <CircularProgress size={16} /> : 
                                      <RadioButtonUncheckedIcon fontSize="small" color="disabled" />
                                    }
                                  </ListItemIcon>
                                  <ListItemText 
                                    primary="Index documents" 
                                    primaryTypographyProps={{ variant: 'caption' }}
                                  />
                                </ListItem>
                              </List>
                            </Box>
                          )}
                        </Box>
                      )}
                    </Box>
                  )}
                  
                  <Box display="flex" alignItems="center" gap={2}>
                    <Button
                      variant="contained"
                      startIcon={<BuildIcon />}
                      onClick={() => rebuildIndexMutation.mutate()}
                      disabled={
                        rebuildIndexMutation.isLoading ||
                        searchIndexStatus?.latestRebuild?.status === 'in_progress'
                      }
                    >
                      {rebuildIndexMutation.isLoading ? 'Starting...' : 'Rebuild Search Index'}
                    </Button>
                    
                    {searchIndexStatus?.latestRebuild?.startTime && (
                      <Typography variant="caption" color="text.secondary">
                        Last rebuild: {new Date(searchIndexStatus.latestRebuild.startTime).toLocaleString()}
                      </Typography>
                    )}
                  </Box>
                  
                  <Box mt={2}>
                    <Alert severity="warning" variant="outlined">
                      <Typography variant="caption">
                        <strong>Warning:</strong> Rebuilding the search index will temporarily make search unavailable.
                        The process may take several minutes depending on the number of documents.
                      </Typography>
                    </Alert>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Paper sx={{ mt: 4, p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Service Information
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              <strong>Data Refresh Service:</strong> Downloads and updates eCFR content from official sources.
              Runs automatically every 24 hours or can be triggered manually.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Analysis Threads:</strong> Multiple independent threads analyze different aspects of regulations:
              text metrics, age distribution, version history, and AI-powered section analysis. Each thread can be
              controlled individually and will resume from where it left off if stopped.
            </Typography>
          </Paper>
        </Box>
      </Container>
    </>
  );
}