import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import {
  Container,
  Typography,
  Box,
  Paper,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useQuery } from 'react-query';
import axios from 'axios';
import SearchResults from '../components/SearchResults';
import TitlesList from '../components/TitlesList';
import AggregateMetrics from '../components/AggregateMetrics';
import HighlightedSections from '../components/HighlightedSections';
import Navigation from '../components/Navigation';

type SortOption = 'number' | 'recent' | 'oldest' | 'wordCount';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams, setSearchParams] = useState({});
  const [isSearching, setIsSearching] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('number');

  const { data: titles, isLoading: titlesLoading } = useQuery(
    'titles',
    async () => {
      const response = await axios.get('/api/titles');
      return response.data;
    }
  );

  const { data: aggregateMetrics } = useQuery(
    'aggregateMetrics',
    async () => {
      const response = await axios.get('/api/metrics/aggregate');
      return response.data;
    }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchParams({ query: searchQuery });
      setIsSearching(true);
    }
  };

  // Sort titles based on selected option
  const sortedTitles = useMemo(() => {
    if (!titles) return [];
    
    const titlesCopy = [...titles];
    
    switch (sortBy) {
      case 'number':
        return titlesCopy.sort((a, b) => a.number - b.number);
      
      case 'recent':
        return titlesCopy.sort((a, b) => {
          const dateA = a.latestAmendmentDate ? new Date(a.latestAmendmentDate).getTime() : 0;
          const dateB = b.latestAmendmentDate ? new Date(b.latestAmendmentDate).getTime() : 0;
          return dateB - dateA; // Most recent first
        });
      
      case 'oldest':
        return titlesCopy.sort((a, b) => {
          const dateA = a.latestAmendmentDate ? new Date(a.latestAmendmentDate).getTime() : Date.now();
          const dateB = b.latestAmendmentDate ? new Date(b.latestAmendmentDate).getTime() : Date.now();
          return dateA - dateB; // Oldest first
        });
      
      case 'wordCount':
        return titlesCopy.sort((a, b) => {
          const countA = a.wordCount || 0;
          const countB = b.wordCount || 0;
          return countB - countA; // Highest word count first
        });
      
      default:
        return titlesCopy;
    }
  }, [titles, sortBy]);

  return (
    <>
      <Head>
        <title>eCFR Navigator</title>
        <meta name="description" content="Navigate Federal Regulations" />
      </Head>

      <Navigation />

      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          {/* Search Section */}
          <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
            <form onSubmit={handleSearch}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={10}>
                  <TextField
                    fullWidth
                    label="Search regulations"
                    variant="outlined"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter keywords, title, part, section..."
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    type="submit"
                    startIcon={<SearchIcon />}
                    sx={{ height: '56px' }}
                  >
                    Search
                  </Button>
                </Grid>
              </Grid>
            </form>
          </Paper>

          {/* Search Results */}
          {isSearching && (
            <SearchResults
              searchParams={searchParams}
              onClose={() => {
                setIsSearching(false);
                setSearchParams({});
              }}
            />
          )}


          {/* Aggregate Metrics */}
          {!isSearching && aggregateMetrics && (
            <AggregateMetrics metrics={aggregateMetrics} />
          )}

          {/* Highlighted Sections - Analysis Insights */}
          {!isSearching && (
            <HighlightedSections />
          )}

          {/* Titles List */}
          {!isSearching && (
            <Box sx={{ mt: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4">
                  Federal Regulation Titles
                </Typography>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel id="sort-select-label">Sort by</InputLabel>
                  <Select
                    labelId="sort-select-label"
                    id="sort-select"
                    value={sortBy}
                    label="Sort by"
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                  >
                    <MenuItem value="number">Title Number</MenuItem>
                    <MenuItem value="recent">Most Recently Updated</MenuItem>
                    <MenuItem value="oldest">Least Recently Updated</MenuItem>
                    <MenuItem value="wordCount">Word Count</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              {titlesLoading ? (
                <LinearProgress />
              ) : (
                <TitlesList titles={sortedTitles} />
              )}
            </Box>
          )}
        </Box>
      </Container>
    </>
  );
}