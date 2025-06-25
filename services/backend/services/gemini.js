const axios = require('axios');
const logger = require('../shared/utils/logger');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.model = process.env.CHAT_DEFAULT_MODEL || 'gemini-2.0-flash-exp';
    
    if (!this.apiKey) {
      logger.warn('GEMINI_API_KEY not set - Gemini features will be disabled');
    }
  }

  async generateContent(prompt, options = {}) {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const {
      temperature = 0.7,
      maxOutputTokens = 1000,
      topP = 0.9,
      topK = 40
    } = options;

    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature,
            topP,
            topK,
            maxOutputTokens,
            stopSequences: []
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        },
        {
          timeout: parseInt(process.env.CHAT_TIMEOUT_SECONDS || '120') * 1000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.candidates && response.data.candidates[0]) {
        const content = response.data.candidates[0].content;
        if (content && content.parts && content.parts[0]) {
          return content.parts[0].text;
        }
      }

      throw new Error('Invalid response from Gemini API');
    } catch (error) {
      if (error.response) {
        logger.error('Gemini API error:', error.response.data);
        throw new Error(`Gemini API error: ${error.response.data.error?.message || 'Unknown error'}`);
      }
      throw error;
    }
  }

  async chat(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Convert OpenAI-style messages to Gemini format
    const contents = messages.map(msg => {
      let role = msg.role;
      if (role === 'system') {
        // Gemini doesn't have a system role, so we'll prepend it to the first user message
        return null;
      }
      if (role === 'assistant') {
        role = 'model';
      }
      
      return {
        role: role,
        parts: [{
          text: msg.content
        }]
      };
    }).filter(Boolean);

    // Handle system message by prepending to first user message
    const systemMessage = messages.find(m => m.role === 'system');
    if (systemMessage && contents.length > 0) {
      contents[0].parts[0].text = `${systemMessage.content}\n\n${contents[0].parts[0].text}`;
    }

    const {
      temperature = 0.7,
      maxOutputTokens = 1000,
      topP = 0.9,
      topK = 40
    } = options;

    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`,
        {
          contents,
          generationConfig: {
            temperature,
            topP,
            topK,
            maxOutputTokens
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        },
        {
          timeout: parseInt(process.env.CHAT_TIMEOUT_SECONDS || '120') * 1000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.candidates && response.data.candidates[0]) {
        const content = response.data.candidates[0].content;
        if (content && content.parts && content.parts[0]) {
          return {
            id: 'chat-' + Date.now(),
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: this.model,
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: content.parts[0].text
              },
              finish_reason: 'stop'
            }],
            usage: {
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0
            }
          };
        }
      }

      throw new Error('Invalid response from Gemini API');
    } catch (error) {
      if (error.response) {
        logger.error('Gemini API error:', error.response.data);
        throw new Error(`Gemini API error: ${error.response.data.error?.message || 'Unknown error'}`);
      }
      throw error;
    }
  }
}

module.exports = new GeminiService();