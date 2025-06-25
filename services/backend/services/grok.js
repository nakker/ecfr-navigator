const axios = require('axios');
const logger = require('../shared/utils/logger');

class GrokService {
  constructor() {
    this.apiKey = process.env.GROK_API_KEY;
    this.baseUrl = 'https://api.x.ai/v1';
    this.model = process.env.CHAT_DEFAULT_MODEL || 'grok-3-mini';
    
    if (!this.apiKey) {
      logger.warn('GROK_API_KEY not set - Grok features will be disabled');
    }
  }

  async generateContent(prompt, options = {}) {
    if (!this.apiKey) {
      throw new Error('GROK_API_KEY not configured');
    }

    const {
      temperature = 0.7,
      maxOutputTokens = 1000,
      topP = 0.9
    } = options;

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature,
          max_tokens: maxOutputTokens,
          top_p: topP,
          stream: false
        },
        {
          timeout: parseInt(process.env.CHAT_TIMEOUT_SECONDS || '120') * 1000,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      if (response.data.choices && response.data.choices[0]) {
        return response.data.choices[0].message.content;
      }

      throw new Error('Invalid response from Grok API');
    } catch (error) {
      if (error.response) {
        logger.error('Grok API error:', error.response.data);
        throw new Error(`Grok API error: ${error.response.data.error?.message || 'Unknown error'}`);
      }
      throw error;
    }
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

    try {
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
          timeout: parseInt(process.env.CHAT_TIMEOUT_SECONDS || '120') * 1000,
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
  }
}

module.exports = new GrokService();