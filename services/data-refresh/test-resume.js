require('dotenv').config();
const { connect: connectMongo, disconnect: disconnectMongo } = require('./shared/db/mongodb');
const RefreshProgress = require('./shared/models/RefreshProgress');
const logger = require('./shared/utils/logger');

async function testResumeCapability() {
  try {
    // Connect to MongoDB
    await connectMongo(process.env.MONGO_URI);
    logger.info('Connected to MongoDB');
    
    // Check for existing progress
    const existingProgress = await RefreshProgress.findOne({
      type: 'initial',
      status: { $in: ['pending', 'in_progress'] }
    }).sort({ createdAt: -1 });
    
    if (existingProgress) {
      logger.info('Found existing progress:');
      logger.info(`  Status: ${existingProgress.status}`);
      logger.info(`  Total titles: ${existingProgress.totalTitles}`);
      logger.info(`  Processed titles: ${existingProgress.processedTitles}`);
      logger.info(`  Progress: ${existingProgress.totalTitles > 0 ? Math.round((existingProgress.processedTitles / existingProgress.totalTitles) * 100) : 0}%`);
      
      if (existingProgress.currentTitle) {
        logger.info(`  Current title: ${existingProgress.currentTitle.number} - ${existingProgress.currentTitle.name}`);
      }
      
      if (existingProgress.lastProcessedTitle) {
        logger.info(`  Last processed: ${existingProgress.lastProcessedTitle.number} - ${existingProgress.lastProcessedTitle.name}`);
      }
      
      if (existingProgress.failedTitles.length > 0) {
        logger.info(`  Failed titles: ${existingProgress.failedTitles.length}`);
        existingProgress.failedTitles.forEach(title => {
          logger.info(`    - Title ${title.number}: ${title.error}`);
        });
      }
      
      // Show which titles have been processed
      if (existingProgress.processedTitleNumbers.length > 0) {
        logger.info(`  Processed title numbers: ${existingProgress.processedTitleNumbers.sort((a, b) => a - b).join(', ')}`);
      }
    } else {
      logger.info('No in-progress download found. Ready to start fresh.');
    }
    
    // Check completed downloads
    const completedCount = await RefreshProgress.countDocuments({
      type: 'initial',
      status: 'completed'
    });
    
    if (completedCount > 0) {
      logger.info(`\nFound ${completedCount} completed initial download(s)`);
      
      const lastCompleted = await RefreshProgress.findOne({
        type: 'initial',
        status: 'completed'
      }).sort({ completedAt: -1 });
      
      if (lastCompleted) {
        logger.info(`Last completed download:`);
        logger.info(`  Completed at: ${lastCompleted.completedAt}`);
        logger.info(`  Total titles: ${lastCompleted.totalTitles}`);
        logger.info(`  Duration: ${Math.round((lastCompleted.completedAt - lastCompleted.startedAt) / 60000)} minutes`);
      }
    }
    
  } catch (error) {
    logger.error('Test failed:', error);
  } finally {
    await disconnectMongo();
    logger.info('Disconnected from MongoDB');
  }
}

testResumeCapability();