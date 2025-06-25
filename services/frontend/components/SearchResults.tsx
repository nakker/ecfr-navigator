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
  IconButton,
  Pagination,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useQuery } from 'react-query';
import axios from 'axios';
import Link from 'next/link';

interface SearchResultsProps {
  searchParams: any;
  onClose: () => void;
}

export default function SearchResults({ searchParams, onClose }: SearchResultsProps) {
  const [page, setPage] = React.useState(1);
  const pageSize = 20;

  const { data, isLoading, error } = useQuery(
    ['search', searchParams, page],
    async () => {
      const response = await axios.get('/api/search', {
        params: {
          ...searchParams,
          from: (page - 1) * pageSize,
          size: pageSize,
        },
      });
      return response.data;
    },
    { enabled: !!searchParams.query }
  );

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">
          Search Results {data && `(${data.total} found)`}
        </Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error">
          An error occurred while searching. Please try again.
        </Alert>
      )}

      {data && data.hits.length === 0 && (
        <Alert severity="info">
          No results found for your search query.
        </Alert>
      )}

      {data && data.hits.length > 0 && (
        <>
          <List>
            {data.hits.map((hit: any) => (
              <ListItem
                key={hit.id}
                component={Link}
                href={`/title/${hit.titleNumber}#${hit.identifier}`}
                sx={{
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                  cursor: 'pointer',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <ListItemText
                  primary={
                    <Box>
                      <Typography variant="subtitle1" component="span">
                        {hit.heading || hit.identifier}
                      </Typography>
                      <Box sx={{ mt: 0.5 }}>
                        <Chip
                          label={`Title ${hit.titleNumber}`}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <Chip
                          label={hit.documentType}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ mr: 1 }}
                        />
                        {hit.section && (
                          <Chip
                            label={`§ ${hit.section}`}
                            size="small"
                            sx={{ mr: 1 }}
                          />
                        )}
                      </Box>
                    </Box>
                  }
                  secondary={
                    hit.highlights?.content?.map((highlight: string, index: number) => (
                      <Typography
                        key={index}
                        variant="body2"
                        component="span"
                        dangerouslySetInnerHTML={{ __html: `...${highlight}...` }}
                        sx={{ display: 'block', mt: 0.5 }}
                      />
                    ))
                  }
                />
              </ListItem>
            ))}
          </List>

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(e, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Paper>
  );
}