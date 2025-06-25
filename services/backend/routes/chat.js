const express = require('express');
const router = express.Router();
const logger = require('../shared/utils/logger');
const grokService = require('../services/grok');

router.post('/', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    logger.info('Chat request received', { 
      messageCount: messages.length
    });

    // Use Grok API for chat completion
    const response = await grokService.chat(messages, {
      temperature: 0.7,
      maxOutputTokens: 1000
    });

    // Extract the response content
    const content = response.choices[0]?.message?.content || '';
    
    logger.info('Chat response received', { 
      contentLength: content.length,
      model: response.model
    });

    res.json({
      content,
      model: response.model,
      usage: response.usage,
    });

  } catch (error) {
    logger.error('Chat API error:', {
      message: error.message,
      stack: error.stack
    });
    
    if (error.message.includes('GROK_API_KEY not configured')) {
      return res.status(503).json({ 
        error: 'Chat service is not configured. Please set the GROK_API_KEY environment variable.' 
      });
    }

    if (error.message.includes('timeout')) {
      return res.status(504).json({ 
        error: 'Request timeout. Please try again with a shorter message.' 
      });
    }

    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Endpoint to get chat configuration
router.get('/config', (req, res) => {
  res.json({
    systemPrompt: process.env.CHAT_SYSTEM_PROMPT || "You are an expert at analyzing federal regulations. Your goal is to help the user understand what they are reading. As a secondary goal you are to help the user identify where the potential for deregulatory action could be taken.",
    defaultModel: process.env.CHAT_DEFAULT_MODEL || 'grok-3-mini',
    timeoutSeconds: parseInt(process.env.CHAT_TIMEOUT_SECONDS) || 120
  });
});

module.exports = router;