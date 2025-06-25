require('dotenv').config();
const { connect: connectMongo, disconnect: disconnectMongo } = require('./shared/db/mongodb');
const logger = require('./shared/utils/logger');
const ThreadManager = require('./services/ThreadManager');
const AnalysisProgress = require('./shared/models/AnalysisProgress');
const { setThreadManager, startApiServer } = require('./api');

// Global thread manager instance
let threadManager = null;

async function startService() {
  try {
    // Connect to MongoDB
    await connectMongo(process.env.MONGO_URI);
    
    logger.info('Data Analysis Service started with thread-based architecture');

    // Initialize thread manager
    threadManager = new ThreadManager();
    await threadManager.initialize();
    
    // Set thread manager for API and start internal API server
    setThreadManager(threadManager);
    startApiServer(3003);

    // Wait for startup delay
    const startupDelayMinutes = parseInt(process.env.ANALYSIS_STARTUP_DELAY_MINUTES || '2');
    logger.info(`Waiting ${startupDelayMinutes} minutes before starting analysis threads...`);
    
    setTimeout(async () => {
      logger.info('Starting all analysis threads...');
      const threadTypes = ['text_metrics', 'age_distribution', 'version_history', 'section_analysis'];
      
      for (const threadType of threadTypes) {
        const result = await threadManager.startThread(threadType);
        logger.info(`Thread ${threadType}: ${result.message}`);
      }
    }, startupDelayMinutes * 60 * 1000);

    // Check for legacy manual triggers periodically (for backward compatibility)
    setInterval(async () => {
      await checkForLegacyManualTriggers();
    }, 30 * 1000); // Check every 30 seconds

    // Log thread status every 5 minutes
    setInterval(async () => {
      const status = await threadManager.getThreadStatus();
      logger.info('Thread Status Update:', JSON.stringify(status, null, 2));
    }, 5 * 60 * 1000);

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      if (threadManager) {
        await threadManager.stopAllThreads();
      }
      await disconnectMongo();
      process.exit(0);
    });

    // Also handle SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      if (threadManager) {
        await threadManager.stopAllThreads();
      }
      await disconnectMongo();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start Data Analysis Service:', error);
    process.exit(1);
  }
}

// Function to check for legacy manual triggers (for backward compatibility)
async function checkForLegacyManualTriggers() {
  try {
    // Clean up old stuck pending triggers (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await AnalysisProgress.deleteMany({
      status: 'pending',
      createdAt: { $lt: oneHourAgo }
    });

    // Check for pending manual triggers
    const pendingTrigger = await AnalysisProgress.findOne({
      status: 'pending',
      triggeredBy: 'manual'
    }).sort({ createdAt: 1 });

    if (pendingTrigger) {
      logger.info('Found legacy manual trigger - marking as completed and using thread system');
      
      // Mark as completed since we're using the new thread system
      pendingTrigger.status = 'completed';
      pendingTrigger.endTime = new Date();
      pendingTrigger.error = 'Migrated to thread-based analysis system. Use the settings page to control analysis.';
      await pendingTrigger.save();
    }
  } catch (error) {
    logger.error('Error checking for legacy manual triggers:', error);
  }
}

// Export thread manager for external access (e.g., from API endpoints)
module.exports = {
  getThreadManager: () => threadManager
};

startService();