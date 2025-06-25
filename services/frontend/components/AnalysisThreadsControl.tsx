import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Grid,
  Box,
  Typography,
  Button,
  ButtonGroup,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Alert,
  Skeleton,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import MemoryIcon from '@mui/icons-material/Memory';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';


interface ThreadStatus {
  threadType: string;
  status: 'stopped' | 'running' | 'completed' | 'failed';
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  currentItem?: {
    titleNumber?: number;
    titleName?: string;
    description?: string;
  };
  lastStartTime?: string;
  lastCompletedTime?: string;
  error?: string;
  statistics?: {
    itemsProcessed: number;
    itemsFailed: number;
    averageTimePerItem: number;
  };
}

interface ThreadsResponse {
  success: boolean;
  threads: ThreadStatus[];
}

const threadTypeLabels: Record<string, string> = {
  text_metrics: 'Text Metrics Analysis',
  age_distribution: 'Age Distribution Analysis',
  version_history: 'Version History Sync',
  section_analysis: 'AI Section Analysis',
};

const threadTypeDescriptions: Record<string, string> = {
  text_metrics: 'Analyzes word count, complexity, and readability',
  age_distribution: 'Calculates regulation age distributions',
  version_history: 'Fetches version history from eCFR API',
  section_analysis: 'AI-powered analysis of regulation sections',
};

export default function AnalysisThreadsControl() {
  const queryClient = useQueryClient();
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch thread status
  const { data, isLoading, error, refetch } = useQuery<ThreadsResponse>(
    'analysis-threads',
    async () => {
      const response = await axios.get(`/api/analysis-threads/status`);
      return response.data;
    },
    {
      refetchInterval: 2000, // Poll every 2 seconds
    }
  );

  // Thread control mutations
  const startThreadMutation = useMutation(
    async ({ threadType, restart }: { threadType: string; restart: boolean }) => {
      const response = await axios.post(`/api/analysis-threads/${threadType}/start`, { restart });
      return response.data;
    },
    {
      onSuccess: (data, variables) => {
        setMessage({ type: 'success', text: `${threadTypeLabels[variables.threadType]} started successfully` });
        queryClient.invalidateQueries('analysis-threads');
      },
      onError: (error: any, variables) => {
        setMessage({ 
          type: 'error', 
          text: error.response?.data?.message || `Failed to start ${threadTypeLabels[variables.threadType]}` 
        });
      },
    }
  );

  const stopThreadMutation = useMutation(
    async (threadType: string) => {
      const response = await axios.post(`/api/analysis-threads/${threadType}/stop`);
      return response.data;
    },
    {
      onSuccess: (data, threadType) => {
        setMessage({ type: 'success', text: `${threadTypeLabels[threadType]} stopped successfully` });
        queryClient.invalidateQueries('analysis-threads');
      },
      onError: (error: any, threadType) => {
        setMessage({ 
          type: 'error', 
          text: error.response?.data?.message || `Failed to stop ${threadTypeLabels[threadType]}` 
        });
      },
    }
  );

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <PlayArrowIcon color="primary" fontSize="small" />;
      case 'completed':
        return <CheckCircleIcon color="success" fontSize="small" />;
      case 'failed':
        return <ErrorIcon color="error" fontSize="small" />;
      case 'stopped':
      default:
        return <PauseCircleIcon color="disabled" fontSize="small" />;
    }
  };

  const getStatusColor = (status: string): 'default' | 'primary' | 'success' | 'error' => {
    switch (status) {
      case 'running':
        return 'primary';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatDuration = (startTime?: string, endTime?: string) => {
    if (!startTime) return 'N/A';
    const start = new Date(startTime).getTime();
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    const duration = end - start;
    
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((duration % (1000 * 60)) / 1000);
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const formatAvgTime = (avgTime?: number) => {
    if (!avgTime) return 'N/A';
    const seconds = Math.floor(avgTime / 1000);
    const ms = Math.floor(avgTime % 1000);
    return `${seconds}.${ms}s`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader
          title="Analysis Threads Control"
          avatar={<MemoryIcon />}
        />
        <CardContent>
          <Grid container spacing={2}>
            {[1, 2, 3, 4].map((i) => (
              <Grid item xs={12} key={i}>
                <Skeleton variant="rectangular" height={60} />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader
          title="Analysis Threads Control"
          avatar={<MemoryIcon />}
        />
        <CardContent>
          <Alert severity="error">
            Failed to load thread status. Please try refreshing the page.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const threads = data?.threads || [];

  return (
    <Card>
      <CardHeader
        title="Analysis Threads Control"
        avatar={<MemoryIcon />}
        action={
          <Tooltip title="Refresh status">
            <IconButton onClick={() => refetch()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        }
      />
      <CardContent>
        <Typography variant="body2" color="text.secondary" paragraph>
          Control individual analysis threads. Each thread can be started, stopped, or restarted independently.
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Thread Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Progress</TableCell>
                <TableCell>Current Task</TableCell>
                <TableCell>Statistics</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {threads.map((thread) => (
                <TableRow key={thread.threadType}>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {threadTypeLabels[thread.threadType]}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {threadTypeDescriptions[thread.threadType]}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={getStatusIcon(thread.status)}
                      label={thread.status}
                      size="small"
                      color={getStatusColor(thread.status)}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ minWidth: 120 }}>
                      {thread.progress.total > 0 ? (
                        <>
                          <Box display="flex" alignItems="center">
                            <Box width="100%" mr={1}>
                              <LinearProgress 
                                variant="determinate" 
                                value={thread.progress.percentage} 
                              />
                            </Box>
                            <Box minWidth={35}>
                              <Typography variant="body2" color="text.secondary">
                                {thread.progress.percentage}%
                              </Typography>
                            </Box>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {thread.progress.current} / {thread.progress.total}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          No progress data
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {thread.currentItem ? (
                      <Box>
                        {thread.currentItem.titleNumber && (
                          <Typography variant="caption">
                            Title {thread.currentItem.titleNumber}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" display="block">
                          {thread.currentItem.description || 'Processing...'}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        {thread.status === 'stopped' ? 'Not running' : 'Idle'}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box>
                      {thread.statistics && (
                        <>
                          <Typography variant="caption" display="block">
                            Processed: {thread.statistics.itemsProcessed}
                          </Typography>
                          {thread.statistics.itemsFailed > 0 && (
                            <Typography variant="caption" color="error" display="block">
                              Failed: {thread.statistics.itemsFailed}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary" display="block">
                            Avg: {formatAvgTime(thread.statistics.averageTimePerItem)}
                          </Typography>
                        </>
                      )}
                      {thread.lastStartTime && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Duration: {formatDuration(thread.lastStartTime, thread.lastCompletedTime)}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <ButtonGroup size="small" variant="outlined">
                      <Tooltip title={thread.status === 'running' ? 'Thread is already running' : 'Start thread'}>
                        <span>
                          <Button
                            startIcon={<PlayArrowIcon />}
                            onClick={() => startThreadMutation.mutate({ threadType: thread.threadType, restart: false })}
                            disabled={thread.status === 'running' || startThreadMutation.isLoading}
                          >
                            Start
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title={thread.status !== 'running' ? 'Thread is not running' : 'Stop thread'}>
                        <span>
                          <Button
                            startIcon={<StopIcon />}
                            onClick={() => stopThreadMutation.mutate(thread.threadType)}
                            disabled={thread.status !== 'running' || stopThreadMutation.isLoading}
                            color="error"
                          >
                            Stop
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title="Restart thread from beginning">
                        <span>
                          <Button
                            startIcon={<RestartAltIcon />}
                            onClick={() => startThreadMutation.mutate({ threadType: thread.threadType, restart: true })}
                            disabled={startThreadMutation.isLoading}
                          >
                            Restart
                          </Button>
                        </span>
                      </Tooltip>
                    </ButtonGroup>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box mt={3} display="flex" gap={2}>
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={async () => {
              try {
                await axios.post(`/api/analysis-threads/start-all`);
                setMessage({ type: 'success', text: 'All threads started successfully' });
                queryClient.invalidateQueries('analysis-threads');
              } catch (error) {
                setMessage({ type: 'error', text: 'Failed to start all threads' });
              }
            }}
          >
            Start All
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<StopIcon />}
            onClick={async () => {
              try {
                await axios.post(`/api/analysis-threads/stop-all`);
                setMessage({ type: 'success', text: 'All threads stopped successfully' });
                queryClient.invalidateQueries('analysis-threads');
              } catch (error) {
                setMessage({ type: 'error', text: 'Failed to stop all threads' });
              }
            }}
          >
            Stop All
          </Button>
        </Box>

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="caption">
            <strong>Note:</strong> Each thread analyzes different aspects of the regulations:
          </Typography>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li><Typography variant="caption">Text Metrics: Word count, complexity, readability scores</Typography></li>
            <li><Typography variant="caption">Age Distribution: When regulations were last updated</Typography></li>
            <li><Typography variant="caption">Version History: Historical changes from eCFR API</Typography></li>
            <li><Typography variant="caption">Section Analysis: AI-powered insights on each regulation section</Typography></li>
          </ul>
        </Alert>
      </CardContent>
    </Card>
  );
}