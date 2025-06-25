const express = require('express');
const router = express.Router();
const logger = require('../shared/utils/logger');
const AnalysisThread = require('../shared/models/AnalysisThread');
const axios = require('axios');

// Base URL for data-analysis service internal communication
const ANALYSIS_SERVICE_URL = process.env.ANALYSIS_SERVICE_URL || 'http://data-analysis:3003';

// Get status of all analysis threads
router.get('/status', async (req, res, next) => {
  try {
    const threads = await AnalysisThread.find({}).lean();
    
    const threadStatus = threads.map(thread => ({
      threadType: thread.threadType,
      status: thread.status,
      progress: thread.progress,
      currentItem: thread.currentItem,
      lastStartTime: thread.lastStartTime,
      lastCompletedTime: thread.lastCompletedTime,
      error: thread.error,
      statistics: thread.statistics
    }));

    res.json({
      success: true,
      threads: threadStatus
    });
  } catch (error) {
    logger.error('Failed to get thread status:', error);
    next(error);
  }
});

// Start a specific thread
router.post('/:threadType/start', async (req, res, next) => {
  try {
    const { threadType } = req.params;
    const { restart = false } = req.body;

    // Validate thread type
    const validThreadTypes = ['text_metrics', 'age_distribution', 'version_history', 'section_analysis'];
    if (!validThreadTypes.includes(threadType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid thread type'
      });
    }

    // Check if thread is already running
    const thread = await AnalysisThread.findOne({ threadType });
    if (thread && thread.status === 'running') {
      return res.json({
        success: false,
        message: 'Thread is already running'
      });
    }

    // Send command to data-analysis service
    try {
      const response = await axios.post(`${ANALYSIS_SERVICE_URL}/threads/${threadType}/start`, {
        restart
      });
      
      res.json(response.data);
    } catch (serviceError) {
      // If service communication fails, try updating DB directly
      logger.warn('Direct service communication failed, updating DB directly');
      
      await AnalysisThread.findOneAndUpdate(
        { threadType },
        { 
          status: 'pending_start',
          lastStartTime: new Date(),
          error: null,
          ...(restart ? { resumeData: null, progress: { current: 0, total: 0, percentage: 0 } } : {})
        }
      );

      res.json({
        success: true,
        message: `Thread ${threadType} start requested`
      });
    }
  } catch (error) {
    logger.error(`Failed to start thread ${req.params.threadType}:`, error);
    next(error);
  }
});

// Stop a specific thread
router.post('/:threadType/stop', async (req, res, next) => {
  try {
    const { threadType } = req.params;

    // Validate thread type
    const validThreadTypes = ['text_metrics', 'age_distribution', 'version_history', 'section_analysis'];
    if (!validThreadTypes.includes(threadType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid thread type'
      });
    }

    // Send command to data-analysis service
    try {
      const response = await axios.post(`${ANALYSIS_SERVICE_URL}/threads/${threadType}/stop`);
      res.json(response.data);
    } catch (serviceError) {
      // If service communication fails, try updating DB directly
      logger.warn('Direct service communication failed, updating DB directly');
      
      await AnalysisThread.findOneAndUpdate(
        { threadType },
        { 
          status: 'pending_stop',
          lastStopTime: new Date()
        }
      );

      res.json({
        success: true,
        message: `Thread ${threadType} stop requested`
      });
    }
  } catch (error) {
    logger.error(`Failed to stop thread ${req.params.threadType}:`, error);
    next(error);
  }
});

// Restart a specific thread
router.post('/:threadType/restart', async (req, res, next) => {
  try {
    const { threadType } = req.params;

    // Validate thread type
    const validThreadTypes = ['text_metrics', 'age_distribution', 'version_history', 'section_analysis'];
    if (!validThreadTypes.includes(threadType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid thread type'
      });
    }

    // Send command to data-analysis service
    try {
      const response = await axios.post(`${ANALYSIS_SERVICE_URL}/threads/${threadType}/restart`);
      res.json(response.data);
    } catch (serviceError) {
      // If service communication fails, try updating DB directly
      logger.warn('Direct service communication failed, updating DB directly');
      
      await AnalysisThread.findOneAndUpdate(
        { threadType },
        { 
          status: 'pending_restart',
          lastStartTime: new Date(),
          error: null,
          resumeData: null,
          progress: { current: 0, total: 0, percentage: 0 }
        }
      );

      res.json({
        success: true,
        message: `Thread ${threadType} restart requested`
      });
    }
  } catch (error) {
    logger.error(`Failed to restart thread ${req.params.threadType}:`, error);
    next(error);
  }
});

// Start all threads
router.post('/start-all', async (req, res, next) => {
  try {
    const validThreadTypes = ['text_metrics', 'age_distribution', 'version_history', 'section_analysis'];
    const results = [];

    for (const threadType of validThreadTypes) {
      try {
        const response = await axios.post(`${ANALYSIS_SERVICE_URL}/threads/${threadType}/start`);
        results.push({ threadType, ...response.data });
      } catch (error) {
        results.push({ threadType, success: false, error: error.message });
      }
    }

    res.json({
      success: true,
      results
    });
  } catch (error) {
    logger.error('Failed to start all threads:', error);
    next(error);
  }
});

// Stop all threads
router.post('/stop-all', async (req, res, next) => {
  try {
    const validThreadTypes = ['text_metrics', 'age_distribution', 'version_history', 'section_analysis'];
    const results = [];

    for (const threadType of validThreadTypes) {
      try {
        const response = await axios.post(`${ANALYSIS_SERVICE_URL}/threads/${threadType}/stop`);
        results.push({ threadType, ...response.data });
      } catch (error) {
        results.push({ threadType, success: false, error: error.message });
      }
    }

    res.json({
      success: true,
      results
    });
  } catch (error) {
    logger.error('Failed to stop all threads:', error);
    next(error);
  }
});

module.exports = router;