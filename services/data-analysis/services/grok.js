const axios = require('axios');
const logger = require('../shared/utils/logger');
const Bottleneck = require('bottleneck');

class GrokService {
  constructor() {
    this.apiKey = process.env.GROK_API_KEY;
    this.baseUrl = 'https://api.x.ai/v1';
    this.model = process.env.ANALYSIS_MODEL || 'grok-3-mini';
    
    if (!this.apiKey) {
      logger.warn('GROK_API_KEY not set - Grok features will be disabled');
    }
    
    // Initialize rate limiter
    const requestsPerSecond = parseInt(process.env.ANALYSIS_RATE_LIMIT || '15');
    this.limiter = new Bottleneck({
      maxConcurrent: requestsPerSecond,
      minTime: Math.floor(1000 / requestsPerSecond) // Minimum time between requests in ms
    });
    
    logger.info(`Grok rate limiter initialized: ${requestsPerSecond} requests per second`);
  }

  async generateContent(prompt, options = {}) {
    if (!this.apiKey) {
      const error = new Error('GROK_API_KEY not configured. Please set the GROK_API_KEY environment variable.');
      logger.error(error.message);
      throw error;
    }

    const {
      temperature = 0.7,
      maxOutputTokens = 1000,
      topP = 0.9
    } = options;

    // Use rate limiter to throttle requests
    return this.limiter.schedule(async () => {
      try {
        const request = {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature,
          max_tokens: maxOutputTokens,
          top_p: topP
        };
        
        const response = await axios.post(
          `${this.baseUrl}/messages`,
          request,
          {
            timeout: parseInt(process.env.ANALYSIS_TIMEOUT_SECONDS || '120') * 1000,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            }
          }
        );
        
        // Handle the response based on the new Grok API format
        if (response.data.content && Array.isArray(response.data.content)) {
          // Find the text content in the response
          const textContent = response.data.content.find(item => item.type === 'text');
          if (textContent && textContent.text) {
            const content = textContent.text;
            return content;
          }
          
          // Check if there's only a thinking response (no text)
          const thinkingContent = response.data.content.find(item => item.type === 'thinking');
          if (thinkingContent && response.data.content.length === 1) {
            // API returned only thinking content, no actual response
            logger.error('Grok API returned only thinking content, no text response');
            throw new Error('Grok API returned incomplete response - no text content');
          }
        }
        
        // Check if it's a simple text response (older format)
        if (typeof response.data === 'string') {
          return response.data;
        }

        logger.error('Invalid Grok response structure - no text content found');
        throw new Error('Invalid response from Grok API');
      } catch (error) {
        if (error.response) {
          logger.error('Grok API error:', error.response.data);
          throw new Error(`Grok API error: ${error.response.data.error?.message || 'Unknown error'}`);
        }
        throw error;
      }
    });
  }

  async chat(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('GROK_API_KEY not configured');
    }

    const {
      temperature = 0.7,
      maxOutputTokens = 1000,
      topP = 0.9
    } = options;

    // Use rate limiter to throttle requests
    return this.limiter.schedule(async () => {
      try {
        // For chat, use the /v1/chat/completions endpoint
        const response = await axios.post(
          `${this.baseUrl}/chat/completions`,
          {
            model: this.model,
            messages,
            temperature,
            max_tokens: maxOutputTokens,
            top_p: topP,
            stream: false
          },
          {
            timeout: parseInt(process.env.ANALYSIS_TIMEOUT_SECONDS || '120') * 1000,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            }
          }
        );

        return response.data;
      } catch (error) {
        if (error.response) {
          logger.error('Grok API error:', error.response.data);
          throw new Error(`Grok API error: ${error.response.data.error?.message || 'Unknown error'}`);
        }
        throw error;
      }
    });
  }
}

module.exports = new GrokService();