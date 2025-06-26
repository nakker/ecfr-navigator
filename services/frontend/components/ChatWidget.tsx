import React, { useState, useRef, useEffect } from 'react';
import {
  Fab,
  Drawer,
  IconButton,
  TextField,
  Box,
  Typography,
  Paper,
  CircularProgress,
  Divider,
  Slide,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
} from '@mui/material';
import {
  Chat as ChatIcon,
  Close as CloseIcon,
  Send as SendIcon,
  ChevronRight as ChevronRightIcon,
  Stop as StopIcon,
} from '@mui/icons-material';
import axios from 'axios';
import type { CancelTokenSource } from 'axios';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ChatWidgetProps {
  documentContext?: {
    title: string;
    titleNumber: string;
    identifier?: string;
    content?: string;
  };
  onOpenChange?: (open: boolean) => void;
}

export default function ChatWidget({ documentContext, onOpenChange }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [chatConfig, setChatConfig] = useState({
    systemPrompt: "You are an expert at analyzing federal regulations. Your goal is to help the user understand what they are reading. As a secondary goal you are to help the user identify where the potential for deregulatory action could be taken.",
    defaultModel: 'gemini-2.0-flash-exp',
    timeoutSeconds: 120
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cancelTokenSourceRef = useRef<CancelTokenSource | null>(null);
  const drawerWidth = 400;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch chat configuration on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await axios.get('/api/chat/config');
        setChatConfig(response.data);
      } catch (error) {
        console.error('Failed to fetch chat config:', error);
        // Use defaults if fetch fails
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    // Initialize conversation when opened for the first time
    if (open && !initialized && documentContext) {
      initializeChat();
    }
  }, [open, initialized, documentContext]);

  // Clear conversation when title changes
  useEffect(() => {
    if (documentContext?.titleNumber) {
      // Clear messages and reset initialization when title changes
      setMessages([]);
      setInitialized(false);
    }
  }, [documentContext?.titleNumber]);

  const handleStopGeneration = () => {
    if (cancelTokenSourceRef.current) {
      cancelTokenSourceRef.current.cancel('User stopped the generation');
      cancelTokenSourceRef.current = null;
      setLoading(false);
    }
  };

  const initializeChat = async () => {
    if (!documentContext) return;

    setLoading(true);
    cancelTokenSourceRef.current = axios.CancelToken.source();
    
    try {
      // First, get the list of documents to find the title document
      const listResponse = await axios.get(`/api/documents/title/${documentContext.titleNumber}`, {
        params: { 
          limit: 1000,
          type: 'title' // Only get title type documents
        },
        cancelToken: cancelTokenSourceRef.current.token
      });
      
      const documents = listResponse.data.documents || [];
      
      // Find the main title document
      const titleDoc = documents.find((doc: any) => doc.type === 'title');
      
      if (!titleDoc) {
        throw new Error('Title document not found');
      }
      
      // Now fetch the full content of the title document using its identifier
      const contentResponse = await axios.get(`/api/documents/${documentContext.titleNumber}/${titleDoc.identifier}`, {
        cancelToken: cancelTokenSourceRef.current.token
      });
      
      const fullContent = contentResponse.data.content || '';
      
      // Build context with full text content
      let contextMessage = `Title ${documentContext.titleNumber}: ${documentContext.title}\n\n`;
      contextMessage += `Full Text Content:\n\n`;
      
      // Strip any HTML tags and provide plain text
      const plainText = fullContent
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace nbsp with space
        .replace(/&amp;/g, '&')  // Replace HTML entities
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')    // Normalize whitespace
        .trim();
      
      contextMessage += plainText;
      
      // Trim if too long (staying under token limits)
      //const maxLength = 50000; // Approximately 12k tokens
      //if (contextMessage.length > maxLength) {
      //  contextMessage = contextMessage.substring(0, maxLength) + '\n\n[Content truncated due to length...]';
      //}
      
      // Send initial context to LLM
      const chatResponse = await axios.post('/api/chat', {
        messages: [
          { role: 'system', content: chatConfig.systemPrompt },
          { 
            role: 'user', 
            content: contextMessage + '\n\nI have provided you with the full text of this title. Please provide a brief overview of what this title covers and its main regulatory areas.'
          }
        ],
        model: chatConfig.defaultModel,
      }, {
        timeout: chatConfig.timeoutSeconds * 1000, // Convert to milliseconds
        cancelToken: cancelTokenSourceRef.current.token
      });
      
      setMessages([
        {
          role: 'system',
          content: chatConfig.systemPrompt,
          timestamp: new Date(),
        },
        {
          role: 'assistant',
          content: chatResponse.data.content,
          timestamp: new Date(),
        },
      ]);
      setInitialized(true);
      
    } catch (error: any) {
      if (axios.isCancel(error)) {
        console.log('Chat initialization was cancelled');
      } else {
        console.error('Failed to initialize chat:', error);
        // Fallback to simple initialization
        setMessages([
          {
            role: 'system',
            content: chatConfig.systemPrompt,
            timestamp: new Date(),
          },
          {
            role: 'assistant',
            content: `I'm here to help you understand Title ${documentContext.titleNumber}: ${documentContext.title}. I can explain complex regulatory language, identify key requirements, and suggest areas where deregulation might be beneficial. What specific aspects would you like to explore?`,
            timestamp: new Date(),
          },
        ]);
        setInitialized(true);
      }
    } finally {
      setLoading(false);
      cancelTokenSourceRef.current = null;
    }
  };

  const handleToggle = () => {
    const newState = !open;
    setOpen(newState);
    onOpenChange?.(newState);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    cancelTokenSourceRef.current = axios.CancelToken.source();

    try {
      const chatMessages = messages
        .filter((m) => m.role !== 'system')
        .concat(userMessage)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await axios.post('/api/chat', {
        messages: [
          { role: 'system', content: chatConfig.systemPrompt },
          ...chatMessages,
        ],
        model: chatConfig.defaultModel,
      }, {
        timeout: chatConfig.timeoutSeconds * 1000, // Convert to milliseconds
        cancelToken: cancelTokenSourceRef.current.token
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      if (axios.isCancel(error)) {
        console.log('Chat request was cancelled');
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Response generation was stopped.',
            timestamp: new Date(),
          },
        ]);
      } else {
        console.error('Chat error:', error);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Sorry, I encountered an error. Please try again.',
            timestamp: new Date(),
          },
        ]);
      }
    } finally {
      setLoading(false);
      cancelTokenSourceRef.current = null;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating action button */}
      <Slide direction="left" in={!open} mountOnEnter unmountOnExit>
        <Fab
          color="primary"
          aria-label="chat"
          onClick={handleToggle}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1200,
          }}
        >
          <ChatIcon />
        </Fab>
      </Slide>

      {/* Docked sidebar */}
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        variant="persistent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            height: '100vh',
            position: 'fixed',
            right: 0,
            top: 0,
            borderLeft: 1,
            borderColor: 'divider',
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Regulatory AI Assistant
              </Typography>
              {documentContext && (
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  Title {documentContext.titleNumber}: {documentContext.title}
                </Typography>
              )}
            </Box>
            <IconButton 
              onClick={handleToggle} 
              size="small"
              sx={{ color: 'inherit' }}
            >
              <ChevronRightIcon />
            </IconButton>
          </Box>
          
        </Box>

        {/* Chat content */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 80px)', // Adjusted for header only
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {/* Show initialization loading state */}
            {!initialized && loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <Paper elevation={1} sx={{ p: 3, textAlign: 'center', backgroundColor: 'action.hover' }}>
                  <CircularProgress size={24} sx={{ mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    Analyzing Title {documentContext?.titleNumber} structure...
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    This may take a moment for large titles
                  </Typography>
                </Paper>
              </Box>
            )}
            
            {messages
              .filter((m) => m.role !== 'system')
              .map((message, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <Paper
                    elevation={1}
                    sx={{
                      p: 1.5,
                      maxWidth: '85%',
                      backgroundColor:
                        message.role === 'user' ? 'primary.main' : 'action.hover',
                      color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
                      borderRadius: 2,
                      boxShadow: message.role === 'user' ? 2 : 1,
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {message.content}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        mt: 0.5,
                        opacity: 0.7,
                      }}
                    >
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </Typography>
                  </Paper>
                </Box>
              ))}
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Paper elevation={1} sx={{ p: 2, backgroundColor: 'action.hover' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">
                      Analyzing...
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<StopIcon />}
                      onClick={handleStopGeneration}
                      sx={{ ml: 2 }}
                    >
                      Stop
                    </Button>
                  </Box>
                </Paper>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Input area */}
          <Box
            sx={{
              p: 2,
              borderTop: 1,
              borderColor: 'divider',
              backgroundColor: 'background.paper',
              display: 'flex',
              gap: 1,
              alignItems: 'flex-end',
            }}
          >
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Ask about this regulation..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              multiline
              maxRows={4}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />
            <IconButton
              color="primary"
              onClick={handleSend}
              disabled={!input.trim() || loading}
              sx={{
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
                '&:disabled': {
                  backgroundColor: 'action.disabledBackground',
                },
              }}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Box>
      </Drawer>
    </>
  );
}