import React, { useState } from 'react';
import Head from 'next/head';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import BusinessIcon from '@mui/icons-material/Business';
import LaunchIcon from '@mui/icons-material/Launch';
import RefreshIcon from '@mui/icons-material/Refresh';
import ViewListIcon from '@mui/icons-material/ViewList';
import GridViewIcon from '@mui/icons-material/GridView';
import { useQuery } from 'react-query';
import { useRouter } from 'next/router';
import axios from 'axios';
import Navigation from '../components/Navigation';


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
  analyzedAt: string;
}

interface AnalysisStats {
  totalAnalyzed: number;
  totalSections: number;
  percentageAnalyzed: number;
  averageAntiquatedScore: number;
  averageBusinessUnfriendlyScore: number;
}

const getScoreColor = (score: number) => {
  if (score <= 30) return '#4caf50';
  if (score <= 60) return '#ff9800';
  return '#f44336';
};

export default function AnalysisDashboard() {
  const theme = useTheme();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'antiquated' | 'business'>('antiquated');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Fetch analysis statistics
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<AnalysisStats>(
    'analysisStats',
    async () => {
      const response = await axios.get(`/api/analysis/stats`);
      return response.data;
    },
    {
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
    }
  );

  // Fetch analyzed sections
  const { 
    data: sections, 
    isLoading: sectionsLoading, 
    refetch: refetchSections 
  } = useQuery<AnalyzedSection[]>(
    ['analyzedSections', sortBy, page, rowsPerPage],
    async () => {
      const response = await axios.get(
        `/api/analysis/${sortBy}?limit=${rowsPerPage}&offset=${page * rowsPerPage}`
      );
      return response.data;
    },
    {
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
    }
  );

  const handleNavigate = (section: AnalyzedSection) => {
    router.push({
      pathname: `/title/${section.titleNumber}`,
      query: { section: section.identifier }
    });
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleRefresh = () => {
    refetchStats();
    refetchSections();
  };

  if (statsLoading || sectionsLoading) {
    return (
      <>
        <Head>
          <title>Analysis Dashboard - eCFR Navigator</title>
        </Head>
        <Navigation />
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Analysis Dashboard - eCFR Navigator</title>
        <meta name="description" content="AI Analysis Dashboard for Federal Regulations" />
      </Head>

      <Navigation />

      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              AI Analysis Dashboard
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton onClick={handleRefresh} color="primary">
                <RefreshIcon />
              </IconButton>
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(e, newMode) => newMode && setViewMode(newMode)}
                size="small"
              >
                <ToggleButton value="grid">
                  <GridViewIcon />
                </ToggleButton>
                <ToggleButton value="list">
                  <ViewListIcon />
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>

          {/* Statistics Cards */}
          {stats && (
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Sections Analyzed
                    </Typography>
                    <Typography variant="h4" sx={{ mb: 1 }}>
                      {stats.totalAnalyzed.toLocaleString()}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={stats.percentageAnalyzed}
                      sx={{ mb: 1 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {stats.percentageAnalyzed}% of {stats.totalSections.toLocaleString()} total
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Coverage
                    </Typography>
                    <Typography variant="h4" sx={{ mb: 1 }}>
                      {stats.percentageAnalyzed}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      of all sections analyzed
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <HistoryIcon sx={{ color: '#f57c00' }} />
                      <Typography color="text.secondary">
                        Avg. Antiquated Score
                      </Typography>
                    </Box>
                    <Typography variant="h4" sx={{ color: getScoreColor(stats.averageAntiquatedScore) }}>
                      {stats.averageAntiquatedScore.toFixed(1)}/100
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <BusinessIcon sx={{ color: '#d32f2f' }} />
                      <Typography color="text.secondary">
                        Avg. Business Impact
                      </Typography>
                    </Box>
                    <Typography variant="h4" sx={{ color: getScoreColor(stats.averageBusinessUnfriendlyScore) }}>
                      {stats.averageBusinessUnfriendlyScore.toFixed(1)}/100
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Sort Controls */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1">Sort by:</Typography>
              <ToggleButtonGroup
                value={sortBy}
                exclusive
                onChange={(e, newSort) => newSort && setSortBy(newSort)}
                size="small"
              >
                <ToggleButton value="antiquated">
                  <HistoryIcon sx={{ mr: 1 }} />
                  Most Outdated
                </ToggleButton>
                <ToggleButton value="business-unfriendly">
                  <BusinessIcon sx={{ mr: 1 }} />
                  Highest Business Burden
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Paper>

          {/* Sections Display */}
          {sections && sections.length > 0 ? (
            viewMode === 'grid' ? (
              <>
                <Grid container spacing={2}>
                  {sections.map((section) => (
                    <Grid item xs={12} md={6} key={section._id}>
                      <Card 
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': { 
                            boxShadow: 4,
                            transform: 'translateY(-2px)',
                            transition: 'all 0.2s'
                          }
                        }}
                        onClick={() => handleNavigate(section)}
                      >
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                {section.cfr}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {section.documentId?.heading || section.identifier}
                              </Typography>
                            </Box>
                            <IconButton size="small">
                              <LaunchIcon fontSize="small" />
                            </IconButton>
                          </Box>

                          <Typography variant="body2" sx={{ mb: 2, fontStyle: 'italic' }}>
                            "{section.summary}"
                          </Typography>

                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Chip
                              icon={<HistoryIcon />}
                              label={`Antiquated: ${section.antiquatedScore}/100`}
                              size="small"
                              sx={{
                                backgroundColor: getScoreColor(section.antiquatedScore),
                                color: 'white',
                              }}
                            />
                            <Chip
                              icon={<BusinessIcon />}
                              label={`Business Impact: ${section.businessUnfriendlyScore}/100`}
                              size="small"
                              sx={{
                                backgroundColor: getScoreColor(section.businessUnfriendlyScore),
                                color: 'white',
                              }}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                  <TablePagination
                    component="div"
                    count={stats?.totalAnalyzed || 0}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[10, 25, 50, 100]}
                  />
                </Box>
              </>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>CFR Reference</TableCell>
                      <TableCell>Title</TableCell>
                      <TableCell>Summary</TableCell>
                      <TableCell align="center">Antiquated Score</TableCell>
                      <TableCell align="center">Business Impact</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sections.map((section) => (
                      <TableRow 
                        key={section._id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => handleNavigate(section)}
                      >
                        <TableCell>{section.cfr}</TableCell>
                        <TableCell>{section.documentId?.heading || section.identifier}</TableCell>
                        <TableCell sx={{ maxWidth: 400 }}>
                          <Typography variant="body2" noWrap>
                            {section.summary}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`${section.antiquatedScore}/100`}
                            size="small"
                            sx={{
                              backgroundColor: getScoreColor(section.antiquatedScore),
                              color: 'white',
                            }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`${section.businessUnfriendlyScore}/100`}
                            size="small"
                            sx={{
                              backgroundColor: getScoreColor(section.businessUnfriendlyScore),
                              color: 'white',
                            }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <IconButton size="small">
                            <LaunchIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination
                  component="div"
                  count={stats?.totalAnalyzed || 0}
                  page={page}
                  onPageChange={handleChangePage}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  rowsPerPageOptions={[10, 25, 50, 100]}
                />
              </TableContainer>
            )
          ) : (
            <Alert severity="info">
              No sections have been analyzed yet. Analysis will begin during the next processing cycle.
            </Alert>
          )}

          {/* Call to Action */}
          {stats && stats.percentageAnalyzed < 100 && (
            <Box sx={{ mt: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {stats.totalSections - stats.totalAnalyzed} sections remaining to analyze
              </Typography>
              <Button
                variant="outlined"
                onClick={() => router.push('/settings')}
              >
                Go to Settings to Trigger Analysis
              </Button>
            </Box>
          )}
        </Box>
      </Container>
    </>
  );
}