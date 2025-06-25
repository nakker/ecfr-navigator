import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Box,
} from '@mui/material';
import Link from 'next/link';
import { format } from 'date-fns';

interface Title {
  number: number;
  name: string;
  reserved: boolean;
  upToDateAsOf: string;
  lastDownloaded: string;
  lastAnalyzed?: string;
  wordCount?: number;
  latestAmendmentDate?: string;
}

interface TitlesListProps {
  titles: Title[];
}

export default function TitlesList({ titles }: TitlesListProps) {
  return (
    <Grid container spacing={3}>
      {titles.map((title) => (
        <Grid item xs={12} sm={6} md={4} lg={3} key={title.number}>
          <Card
            component={Link}
            href={`/title/${title.number}`}
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              textDecoration: 'none',
              transition: 'all 0.3s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 4,
              },
            }}
          >
            <CardContent sx={{ flexGrow: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Typography variant="h6" component="h2" gutterBottom>
                  Title {title.number}
                </Typography>
                {title.reserved && (
                  <Chip label="Reserved" size="small" color="warning" />
                )}
              </Box>
              
              <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                {title.name}
              </Typography>
              
              {title.wordCount !== undefined && title.wordCount > 0 && (
                <Box sx={{ mt: 1, mb: 2 }}>
                  <Chip 
                    label={`${title.wordCount.toLocaleString()} words`}
                    size="small"
                    variant="outlined"
                    color="primary"
                  />
                </Box>
              )}
              
              <Box sx={{ mt: 2 }}>
                {title.latestAmendmentDate && (
                  <Typography variant="body2" color="text.secondary">
                    Current as of: {format(new Date(title.latestAmendmentDate), 'MMM d, yyyy')}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary">
                  Downloaded: {format(new Date(title.lastDownloaded), 'MMM d, yyyy')}
                </Typography>
                {title.lastAnalyzed && (
                  <Typography variant="body2" color="text.secondary">
                    Analyzed: {format(new Date(title.lastAnalyzed), 'MMM d, yyyy')}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}