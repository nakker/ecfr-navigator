require('dotenv').config();
const grokService = require('./services/grok');
const logger = require('./shared/utils/logger');

async function testGrokAPI() {
  console.log('Testing Grok API configuration...');
  console.log('GROK_API_KEY is', process.env.GROK_API_KEY ? 'SET' : 'NOT SET');
  console.log('API Model:', process.env.ANALYSIS_MODEL || 'grok-3-mini');
  
  if (!process.env.GROK_API_KEY) {
    console.error('\n❌ GROK_API_KEY is not set!');
    console.log('\nTo fix this:');
    console.log('1. Get an API key from https://x.ai/api');
    console.log('2. Add it to your .env file: GROK_API_KEY=your_api_key_here');
    return;
  }
  
  try {
    console.log('\nTesting API connection...');
    const response = await grokService.generateContent('Say "Hello World"', {
      temperature: 0.5,
      maxOutputTokens: 10
    });
    
    console.log('✅ API Response:', response);
    console.log('\nGrok API is working correctly!');
  } catch (error) {
    console.error('\n❌ API test failed:', error.message);
    if (error.response?.data) {
      console.error('API Error Details:', error.response.data);
    }
  }
}

testGrokAPI().then(() => process.exit(0)).catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});