import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Breadcrumbs,
  Link,
  Chip,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import NextLink from 'next/link';
import { useQuery } from 'react-query';
import axios from 'axios';
import TitleMetrics from '../../components/TitleMetrics';
import DocumentsList from '../../components/DocumentsList';
import ChatWidget from '../../components/ChatWidget';
import TitleAnalysisInsights from '../../components/TitleAnalysisInsights';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Navigation from '../../components/Navigation';


export default function TitlePage() {
  const router = useRouter();
  const { number, section } = router.query;
  const [chatOpen, setChatOpen] = useState(false);
  const [shouldScrollToSection, setShouldScrollToSection] = useState(false);
  const [hashSection, setHashSection] = useState<string | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  const { data: title, isLoading: titleLoading } = useQuery(
    ['title', number],
    async () => {
      const response = await axios.get(`/api/titles/${number}`);
      return response.data;
    },
    { enabled: !!number }
  );

  const { data: metrics } = useQuery(
    ['metrics', number],
    async () => {
      const response = await axios.get(`/api/metrics/title/${number}`);
      return response.data;
    },
    { enabled: !!number }
  );

  const { data: versionHistory } = useQuery(
    ['versions', number],
    async () => {
      const response = await axios.get(`/api/metrics/title/${number}/versions`);
      return response.data;
    },
    { enabled: !!number }
  );

  const { data: checksum } = useQuery(
    ['checksum', number],
    async () => {
      const response = await axios.get(`/api/titles/${number}/checksum`);
      return response.data;
    },
    { enabled: !!number }
  );

  const handleDownloadXML = () => {
    window.open(`/api/titles/${number}/download`, '_blank');
  };

  const handleCopyChecksum = () => {
    if (checksum?.checksum) {
      navigator.clipboard.writeText(checksum.checksum);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Extract hash from URL when component mounts or URL changes
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      // Remove the # character
      const sectionId = hash.substring(1);
      setHashSection(decodeURIComponent(sectionId));
    }
  }, [router.asPath]);

  return (
    <>
      <Head>
        <title>{title ? `Title ${title.number}: ${title.name}` : 'Loading...'} - eCFR Navigator</title>
      </Head>

      <Navigation />

      {titleLoading ? (
        <Container>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      ) : !title ? (
        <Container>
          <Alert severity="error" sx={{ mt: 4 }}>
            Title not found
          </Alert>
        </Container>
      ) : (
        <>
          <Box sx={{ 
            display: 'flex', 
            transition: 'margin-right 0.3s ease',
            marginRight: chatOpen ? '400px' : 0 
          }}>
            <Container maxWidth="lg" sx={{ width: '100%' }}>
              <Box sx={{ my: 4 }}>
                <Breadcrumbs sx={{ mb: 2 }}>
                  <NextLink href="/" passHref legacyBehavior>
                    <Link underline="hover" color="inherit">
                      Home
                    </Link>
                  </NextLink>
                  <Typography color="text.primary">Title {title.number}</Typography>
                </Breadcrumbs>

                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Paper elevation={3} sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="h3" gutterBottom>
                            Title {title.number}: {title.name}
                          </Typography>
                          <Box sx={{ mb: 2 }}>
                            {title.reserved && <Chip label="Reserved" color="warning" size="small" sx={{ mr: 1 }} />}
                            {title.latestAmendmentDate && (
                              <Chip 
                                label={`Current as of: ${new Date(title.latestAmendmentDate).toLocaleDateString()}`} 
                                size="small" 
                                sx={{ mr: 1 }} 
                              />
                            )}
                            <Chip 
                              label={`Downloaded: ${new Date(title.lastDownloaded).toLocaleDateString()}`} 
                              size="small" 
                            />
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <Button
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={handleDownloadXML}
                          >
                            Download XML
                          </Button>
                          {checksum && (
                            <Box sx={{ 
                              mt: 1, 
                              display: 'flex', 
                              alignItems: 'center',
                              gap: 0.5
                            }}>
                              <Typography variant="caption" color="text.secondary">
                                SHA256: {checksum.checksum.substring(0, 8)}...
                              </Typography>
                              <Tooltip title={copied ? "Copied!" : "Copy checksum"}>
                                <IconButton 
                                  size="small" 
                                  onClick={handleCopyChecksum}
                                  sx={{ p: 0.5 }}
                                >
                                  <ContentCopyIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>

                  {metrics && (
                    <Grid item xs={12}>
                      <TitleMetrics metrics={metrics} versionHistory={versionHistory} />
                    </Grid>
                  )}

                  <Grid item xs={12}>
                    <TitleAnalysisInsights titleNumber={Number(number)} />
                  </Grid>

                  <Grid item xs={12}>
                    <DocumentsList 
                      titleNumber={Number(number)} 
                      targetSection={hashSection || section as string}
                      onSectionReady={() => setShouldScrollToSection(true)}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Container>
          </Box>

          {/* Chat Widget */}
          <ChatWidget 
            documentContext={{
              title: title.name,
              titleNumber: String(title.number),
              content: title.reserved ? 'This title is reserved.' : undefined
            }}
            onOpenChange={setChatOpen}
          />
        </>
      )}
    </>
  );
}