const express = require('express');
const router = express.Router();
const RefreshProgress = require('../shared/models/RefreshProgress');
const logger = require('../shared/utils/logger');

// Get current refresh progress
router.get('/progress', async (req, res) => {
  try {
    const { type = 'initial' } = req.query;
    
    // Get the most recent progress for the given type
    const progress = await RefreshProgress.findOne({ type })
      .sort({ createdAt: -1 })
      .lean();
    
    if (!progress) {
      return res.json({
        type,
        status: 'no_runs',
        message: 'No refresh runs found'
      });
    }
    
    // Calculate percentage
    const percentage = progress.totalTitles > 0 
      ? Math.round((progress.processedTitles / progress.totalTitles) * 100)
      : 0;
    
    res.json({
      type: progress.type,
      status: progress.status,
      totalTitles: progress.totalTitles,
      processedTitles: progress.processedTitles,
      percentage,
      currentTitle: progress.currentTitle,
      lastProcessedTitle: progress.lastProcessedTitle,
      failedTitles: progress.failedTitles,
      startedAt: progress.startedAt,
      completedAt: progress.completedAt,
      lastError: progress.lastError,
      createdAt: progress.createdAt,
      updatedAt: progress.updatedAt
    });
    
  } catch (error) {
    logger.error('Error getting refresh progress:', error);
    res.status(500).json({ error: 'Failed to get refresh progress' });
  }
});

// Get refresh history
router.get('/history', async (req, res) => {
  try {
    const { type, limit = 10 } = req.query;
    
    const query = {};
    if (type) query.type = type;
    
    const history = await RefreshProgress.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();
    
    res.json(history.map(progress => ({
      id: progress._id,
      type: progress.type,
      status: progress.status,
      totalTitles: progress.totalTitles,
      processedTitles: progress.processedTitles,
      percentage: progress.totalTitles > 0 
        ? Math.round((progress.processedTitles / progress.totalTitles) * 100)
        : 0,
      failedCount: progress.failedTitles.length,
      startedAt: progress.startedAt,
      completedAt: progress.completedAt,
      duration: progress.completedAt && progress.startedAt
        ? Math.round((new Date(progress.completedAt) - new Date(progress.startedAt)) / 1000)
        : null
    })));
    
  } catch (error) {
    logger.error('Error getting refresh history:', error);
    res.status(500).json({ error: 'Failed to get refresh history' });
  }
});

// Retry failed titles
router.post('/retry-failed', async (req, res) => {
  try {
    const { progressId } = req.body;
    
    if (!progressId) {
      return res.status(400).json({ error: 'Progress ID is required' });
    }
    
    const progress = await RefreshProgress.findById(progressId);
    
    if (!progress) {
      return res.status(404).json({ error: 'Progress record not found' });
    }
    
    if (progress.failedTitles.length === 0) {
      return res.json({ message: 'No failed titles to retry' });
    }
    
    // Clear failed titles to allow retry
    const failedNumbers = progress.failedTitles.map(t => t.number);
    progress.failedTitles = [];
    progress.status = 'in_progress';
    await progress.save();
    
    res.json({
      message: 'Failed titles cleared for retry',
      clearedTitles: failedNumbers
    });
    
  } catch (error) {
    logger.error('Error retrying failed titles:', error);
    res.status(500).json({ error: 'Failed to retry titles' });
  }
});

module.exports = router;