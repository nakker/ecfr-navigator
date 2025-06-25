require('dotenv').config();
const cron = require('node-cron');
const express = require('express');
const { connect: connectMongo, disconnect: disconnectMongo } = require('./shared/db/mongodb');
const { connect: connectElasticsearch, disconnect: disconnectElasticsearch } = require('./shared/db/elasticsearch');
const logger = require('./shared/utils/logger');
const RefreshService = require('./services/RefreshService');
const RefreshProgress = require('./shared/models/RefreshProgress');
const { initGridFS } = require('./shared/utils/gridfs');

async function connectWithRetry(connectFn, serviceName, url, maxRetries = 5, retryDelay = 5000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Attempting to connect to ${serviceName} (attempt ${attempt}/${maxRetries})...`);
      await connectFn(url);
      logger.info(`Successfully connected to ${serviceName}`);
      return;
    } catch (error) {
      lastError = error;
      logger.error(`Failed to connect to ${serviceName} (attempt ${attempt}/${maxRetries}):`, error.message);
      
      if (attempt < maxRetries) {
        logger.info(`Waiting ${retryDelay / 1000} seconds before retrying...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  throw new Error(`Failed to connect to ${serviceName} after ${maxRetries} attempts: ${lastError.message}`);
}

async function startService() {
  try {
    // Connect to databases with retry logic
    await connectWithRetry(connectMongo, 'MongoDB', process.env.MONGO_URI);
    await connectWithRetry(connectElasticsearch, 'Elasticsearch', process.env.ELASTICSEARCH_HOST);
    
    // Initialize GridFS
    initGridFS();
    
    logger.info('Data Refresh Service started');

    // Create refresh service instance
    const refreshService = new RefreshService();

    // Initial download after delay
    const initialDelayMinutes = parseInt(process.env.INITIAL_DOWNLOAD_DELAY_MINUTES || '5');
    const initialDelay = initialDelayMinutes === 0 ? 100 : initialDelayMinutes * 60 * 1000; // Allow immediate start with 0
    logger.info(`Scheduling initial download in ${initialDelay < 1000 ? '0' : initialDelay / 60000} minutes`);
    
    setTimeout(async () => {
      logger.info('Starting initial download');
      try {
        await refreshService.performInitialDownload();
      } catch (error) {
        logger.error('Initial download failed:', error.message);
        // Don't exit the process, continue running for scheduled refreshes
      }
    }, initialDelay);

    // Schedule periodic refresh
    const refreshInterval = parseInt(process.env.REFRESH_INTERVAL_HOURS || '24');
    const cronExpression = `0 */${refreshInterval} * * *`; // Every N hours
    
    cron.schedule(cronExpression, async () => {
      logger.info('Starting scheduled refresh');
      try {
        await refreshService.performRefresh();
      } catch (error) {
        logger.error('Scheduled refresh failed:', error.message);
        // Don't exit the process, continue running for next scheduled refresh
      }
    });

    logger.info(`Refresh scheduled every ${refreshInterval} hours`);

    // Start health check server
    const app = express();
    const healthPort = 3005;
    
    app.get('/health', async (req, res) => {
      try {
        // Check MongoDB connection using mongoose
        const mongoose = require('mongoose');
        const mongoStatus = mongoose.connection.readyState === 1;
        
        // Check if we have an active refresh
        const activeRefresh = await RefreshProgress.findOne({ status: 'in_progress' });
        
        res.json({
          status: 'healthy',
          service: 'data-refresh',
          timestamp: new Date().toISOString(),
          mongodb: mongoStatus ? 'connected' : 'disconnected',
          activeRefresh: activeRefresh ? {
            titleNumber: activeRefresh.currentTitle?.number,
            progress: `${activeRefresh.processedTitles}/${activeRefresh.totalTitles}`
          } : null
        });
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          service: 'data-refresh',
          error: error.message
        });
      }
    });
    
    app.listen(healthPort, () => {
      logger.info(`Health check server listening on port ${healthPort}`);
    });

    // Check for manual triggers periodically
    setInterval(async () => {
      await checkForManualTriggers(refreshService);
    }, 30 * 1000); // Check every 30 seconds

    // Store reference to refresh service for graceful shutdown
    let currentRefreshService = refreshService;
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      
      // Save current progress if download is in progress
      try {
        const progress = await RefreshProgress.findOne({
          status: 'in_progress'
        }).sort({ createdAt: -1 });
        
        if (progress) {
          logger.info(`Saving progress: ${progress.processedTitles} titles processed, current title: ${progress.currentTitle?.number || 'none'}`);
          // Progress is automatically saved by the RefreshService methods
          // Just log the current state
          if (progress.failedTitles.length > 0) {
            logger.info(`Failed titles: ${progress.failedTitles.map(t => t.number).join(', ')}`);
          }
        }
      } catch (error) {
        logger.error('Error saving progress during shutdown:', error);
      }
      
      await disconnectMongo();
      await disconnectElasticsearch();
      process.exit(0);
    });
    
    // Also handle SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      
      // Save current progress if download is in progress
      try {
        const progress = await RefreshProgress.findOne({
          status: 'in_progress'
        }).sort({ createdAt: -1 });
        
        if (progress) {
          logger.info(`Saving progress: ${progress.processedTitles} titles processed, current title: ${progress.currentTitle?.number || 'none'}`);
          if (progress.failedTitles.length > 0) {
            logger.info(`Failed titles: ${progress.failedTitles.map(t => t.number).join(', ')}`);
          }
        }
      } catch (error) {
        logger.error('Error saving progress during shutdown:', error);
      }
      
      await disconnectMongo();
      await disconnectElasticsearch();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start Data Refresh Service:', error);
    process.exit(1);
  }
}

// Function to check for manual triggers
async function checkForManualTriggers(refreshService) {
  try {
    // Check for pending manual triggers (both full refresh and single title)
    const pendingTrigger = await RefreshProgress.findOne({
      status: 'pending',
      $or: [
        { triggeredBy: 'manual' },
        { triggeredBy: 'manual_single' }
      ]
    }).sort({ createdAt: 1 });

    if (pendingTrigger) {
      // Check if there's already a refresh in progress
      const inProgress = await RefreshProgress.findOne({
        status: 'in_progress'
      });

      if (!inProgress) {
        logger.info(`Found manual trigger (type: ${pendingTrigger.type}), starting refresh`);
        pendingTrigger.status = 'in_progress';
        pendingTrigger.startedAt = new Date();
        await pendingTrigger.save();
        
        try {
          // Check if it's a single title refresh
          if (pendingTrigger.type === 'single_title' && pendingTrigger.metadata?.targetTitle) {
            logger.info(`Running single title refresh for title ${pendingTrigger.metadata.targetTitle}`);
            await refreshService.refreshSingleTitle(pendingTrigger.metadata.targetTitle);
          } else {
            // Run full refresh
            logger.info('Running full refresh');
            await refreshService.performRefresh();
          }
        } catch (error) {
          logger.error('Manual refresh failed:', error.message);
          pendingTrigger.status = 'failed';
          pendingTrigger.completedAt = new Date();
          pendingTrigger.lastError = error.message;
          await pendingTrigger.save();
        }
      }
    }
  } catch (error) {
    logger.error('Error checking for manual triggers:', error);
  }
}

startService();