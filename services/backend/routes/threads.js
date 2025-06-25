const express = require('express');
const router = express.Router();
const axios = require('axios');
const logger = require('../shared/utils/logger');

const DATA_ANALYSIS_API_URL = process.env.DATA_ANALYSIS_API_URL || 'http://data-analysis:3003';

// Proxy thread control to data-analysis service
router.post('/:threadType/start', async (req, res) => {
  try {
    const { threadType } = req.params;
    const response = await axios.post(`${DATA_ANALYSIS_API_URL}/threads/${threadType}/start`, req.body);
    res.json(response.data);
  } catch (error) {
    logger.error('Error starting thread:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      success: false, 
      error: error.response?.data?.error || error.message 
    });
  }
});

router.post('/:threadType/stop', async (req, res) => {
  try {
    const { threadType } = req.params;
    const response = await axios.post(`${DATA_ANALYSIS_API_URL}/threads/${threadType}/stop`);
    res.json(response.data);
  } catch (error) {
    logger.error('Error stopping thread:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      success: false, 
      error: error.response?.data?.error || error.message 
    });
  }
});

router.post('/:threadType/restart', async (req, res) => {
  try {
    const { threadType } = req.params;
    const response = await axios.post(`${DATA_ANALYSIS_API_URL}/threads/${threadType}/restart`);
    res.json(response.data);
  } catch (error) {
    logger.error('Error restarting thread:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      success: false, 
      error: error.response?.data?.error || error.message 
    });
  }
});

router.get('/status', async (req, res) => {
  try {
    const response = await axios.get(`${DATA_ANALYSIS_API_URL}/threads/status`);
    res.json(response.data);
  } catch (error) {
    logger.error('Error getting thread status:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      success: false, 
      error: error.response?.data?.error || error.message 
    });
  }
});

module.exports = router;