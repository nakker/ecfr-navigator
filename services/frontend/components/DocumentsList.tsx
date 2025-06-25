import React, { useState } from 'react';
import {
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
  Box,
  Chip,
  IconButton,
  Collapse,
  LinearProgress,
  Alert,
  Button,
  useTheme,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useQuery } from 'react-query';
import axios from 'axios';
import SectionAnalysis from './SectionAnalysis';
import { useEffect, useRef } from 'react';

interface Document {
  _id: string;
  titleNumber: number;
  type: string;
  identifier: string;
  heading: string;
  node: string;
  subtitle: string;
  chapter: string;
  subchapter: string;
  part: string;
  subpart: string;
  subjectGroup: string;
  section: string;
  authority: string;
  source: string;
  effectiveDate: string;
  amendmentDate: string;
}

interface DocumentsListProps {
  titleNumber: number;
  targetSection?: string;
  onSectionReady?: () => void;
}


export default function DocumentsList({ titleNumber, targetSection, onSectionReady }: DocumentsListProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [documentContent, setDocumentContent] = useState<Record<string, any>>({});
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const hasScrolledToTarget = useRef(false);
  const theme = useTheme();

  const { data, isLoading, error } = useQuery(
    ['documents', titleNumber],
    async () => {
      const response = await axios.get(`/api/documents/title/${titleNumber}`, {
        params: { limit: 9000000 }
      });
      return response.data;
    }
  );

  const fetchDocumentContent = async (doc: Document) => {
    if (documentContent[doc.identifier]) {
      return;
    }

    try {
      const response = await axios.get(
        `/api/documents/${doc.titleNumber}/${encodeURIComponent(doc.identifier)}`
      );
      setDocumentContent(prev => ({
        ...prev,
        [doc.identifier]: response.data
      }));
    } catch (error) {
      console.error('Failed to fetch document content:', error);
      setDocumentContent(prev => ({
        ...prev,
        [doc.identifier]: { error: 'Failed to load content' }
      }));
    }
  };

  const handleItemClick = async (doc: Document) => {
    if (expandedItem === doc.identifier) {
      setExpandedItem(null);
    } else {
      setExpandedItem(doc.identifier);
      await fetchDocumentContent(doc);
    }
  };

  const handleCopyContent = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      // Could add a snackbar notification here
    }).catch(err => {
      console.error('Failed to copy content:', err);
    });
  };

  const getDocumentTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      title: '#1976d2',
      subtitle: '#388e3c',
      chapter: '#d32f2f',
      subchapter: '#f57c00',
      part: '#7b1fa2',
      subpart: '#303f9f',
      subjectgroup: '#c2185b',
      section: '#00796b',
      appendix: '#5d4037'
    };
    return colors[type] || '#757575';
  };

  const formatHierarchy = (doc: Document) => {
    const parts = [];
    if (doc.subtitle) parts.push(`Subtitle ${doc.subtitle}`);
    if (doc.chapter) parts.push(`Chapter ${doc.chapter}`);
    if (doc.subchapter) parts.push(`Subchapter ${doc.subchapter}`);
    if (doc.part) parts.push(`Part ${doc.part}`);
    if (doc.subpart) parts.push(`Subpart ${doc.subpart}`);
    if (doc.subjectGroup) parts.push(`Subject Group ${doc.subjectGroup}`);
    if (doc.section) parts.push(`Section ${doc.section}`);
    return parts.join(' › ');
  };

  const getIndentLevel = (doc: Document) => {
    // Calculate indentation based on document type hierarchy
    const indentMap: Record<string, number> = {
      'title': 0,
      'subtitle': 0,
      'chapter': 0,
      'subchapter': 2,    // 16px indent
      'part': 4,          // 32px indent
      'subpart': 6,       // 48px indent
      'subjectgroup': 8,  // 64px indent
      'section': 10,      // 80px indent
      'appendix': 4       // 32px indent (same as part)
    };
    
    return indentMap[doc.type] || 0;
  };

  // Handle auto-expanding and scrolling to target section
  // This must be before any conditional returns
  useEffect(() => {
    if (targetSection && data?.documents && data.documents.length > 0 && !hasScrolledToTarget.current) {
      const targetDoc = data.documents.find((doc: Document) => doc.identifier === targetSection);
      if (targetDoc) {
        hasScrolledToTarget.current = true;
        // Directly expand the item
        setExpandedItem(targetDoc.identifier);
        
        // Fetch content for the target document
        axios.get(
          `/api/documents/${targetDoc.titleNumber}/${encodeURIComponent(targetDoc.identifier)}`
        ).then(response => {
          setDocumentContent(prev => ({
            ...prev,
            [targetDoc.identifier]: response.data
          }));
          
          // Notify parent and scroll after content is loaded
          onSectionReady?.();
          
          // Scroll to the section after a delay to ensure it's rendered
          setTimeout(() => {
            const element = sectionRefs.current[targetSection];
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 500);
        }).catch(error => {
          console.error('Failed to fetch document content:', error);
          setDocumentContent(prev => ({
            ...prev,
            [targetDoc.identifier]: { error: 'Failed to load content' }
          }));
        });
      }
    }
  }, [targetSection, data, onSectionReady]);

  // Listen for custom navigation events
  useEffect(() => {
    const handleNavigateToSection = (event: CustomEvent) => {
      const sectionId = event.detail.sectionId;
      console.log('DocumentsList - navigateToSection event received:', sectionId);
      console.log('DocumentsList - available documents:', data?.documents?.length);
      
      if (!sectionId || !data?.documents) return;

      // Try to find the document by identifier
      const targetDoc = data.documents.find((doc: Document) => doc.identifier === sectionId);
      console.log('DocumentsList - found target document:', targetDoc);
      
      // If not found, log available identifiers for debugging
      if (!targetDoc) {
        console.log('DocumentsList - No match found. Available identifiers:', 
          data.documents.slice(0, 10).map((d: Document) => ({
            identifier: d.identifier,
            type: d.type,
            heading: d.heading
          }))
        );
      }
      
      if (targetDoc) {
        // Expand the item
        setExpandedItem(targetDoc.identifier);
        
        // Fetch content for the target document
        axios.get(
          `/api/documents/${targetDoc.titleNumber}/${encodeURIComponent(targetDoc.identifier)}`
        ).then(response => {
          setDocumentContent(prev => ({
            ...prev,
            [targetDoc.identifier]: response.data
          }));
          
          // Scroll to the section after a delay to ensure it's rendered
          setTimeout(() => {
            const element = sectionRefs.current[sectionId];
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 500);
        }).catch(error => {
          console.error('Failed to fetch document content:', error);
          setDocumentContent(prev => ({
            ...prev,
            [targetDoc.identifier]: { error: 'Failed to load content' }
          }));
        });
      } else {
        console.log('DocumentsList - no matching document found for identifier:', sectionId);
        // Log first few document identifiers for debugging
        console.log('DocumentsList - sample identifiers:', data.documents.slice(0, 5).map((d: Document) => d.identifier));
      }
    };

    window.addEventListener('navigateToSection', handleNavigateToSection as EventListener);
    return () => {
      window.removeEventListener('navigateToSection', handleNavigateToSection as EventListener);
    };
  }, [data]);

  const documents: Document[] = data?.documents || [];

  if (isLoading) {
    return (
      <Box sx={{ mt: 2 }}>
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>Loading documents...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load documents. Please try again later.
      </Alert>
    );
  }

  return (
    <Paper elevation={2} sx={{ mt: 2, p: 2 }}>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          Documents ({documents.length})
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Click on any document to view its content
        </Typography>
      </Box>

      <List>
        {documents.map((doc) => (
          <React.Fragment key={doc.identifier}>
            <ListItem
              ref={(el) => { sectionRefs.current[doc.identifier] = el; }}
              button
              onClick={() => handleItemClick(doc)}
              sx={{
                borderBottom: '1px solid #e0e0e0',
                py: 2,
                px: 3,
                alignItems: 'flex-start',
                '&:hover': {
                  backgroundColor: '#f5f5f5',
                },
              }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip
                      label={doc.type.toUpperCase()}
                      size="small"
                      sx={{
                        backgroundColor: getDocumentTypeColor(doc.type),
                        color: 'white',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        minWidth: '100px',
                        justifyContent: 'center',
                      }}
                    />
                    <Box sx={{ flex: 1, pl: getIndentLevel(doc) }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                        {doc.heading || doc.identifier}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {formatHierarchy(doc)}
                      </Typography>
                    </Box>
                  </Box>
                }
              />
              <IconButton size="small" sx={{ mt: 1 }}>
                {expandedItem === doc.identifier ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </ListItem>

            <Collapse in={expandedItem === doc.identifier} timeout="auto" unmountOnExit>
              <Box sx={{ p: 3, backgroundColor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
                {documentContent[doc.identifier]?.error ? (
                  <Alert severity="error">{documentContent[doc.identifier].error}</Alert>
                ) : documentContent[doc.identifier] ? (
                  <Box>
                    {/* Show analysis for sections only */}
                    {doc.type === 'section' && (
                      <SectionAnalysis documentId={doc._id} />
                    )}
                    
                    <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <Box>
                        {documentContent[doc.identifier].authority && (
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Authority:</strong> {documentContent[doc.identifier].authority}
                          </Typography>
                        )}
                        {documentContent[doc.identifier].source && (
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Source:</strong> {documentContent[doc.identifier].source}
                          </Typography>
                        )}
                      </Box>
                      <Button
                        startIcon={<ContentCopyIcon />}
                        size="small"
                        onClick={() => handleCopyContent(documentContent[doc.identifier].content || '')}
                      >
                        Copy
                      </Button>
                    </Box>
                    
                    <Box 
                      sx={{ 
                        mt: 2, 
                        p: 2, 
                        backgroundColor: 'background.paper', 
                        borderRadius: 1,
                        border: 1,
                        borderColor: 'divider',
                        maxHeight: '500px',
                        overflow: 'auto'
                      }}
                    >
                      {documentContent[doc.identifier].formattedContent ? (
                        <Box
                          sx={{
                            '& *': {
                              color: 'inherit !important',
                            },
                            '& p, & div': {
                              margin: '0.5em 0',
                            },
                            '& span[style*="font-variant: small-caps"]': {
                              fontVariant: 'small-caps',
                              fontStyle: 'normal',
                              fontWeight: 'normal',
                            },
                            color: theme.palette.text.primary,
                          }}
                          dangerouslySetInnerHTML={{ 
                            __html: documentContent[doc.identifier].formattedContent 
                          }} 
                        />
                      ) : (
                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                          {documentContent[doc.identifier].content}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ) : (
                  <LinearProgress />
                )}
              </Box>
            </Collapse>
          </React.Fragment>
        ))}
      </List>
    </Paper>
  );
}