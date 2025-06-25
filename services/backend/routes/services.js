const express = require('express');
const router = express.Router();
const axios = require('axios');
const logger = require('../shared/utils/logger');
const RefreshProgress = require('../shared/models/RefreshProgress');
const AnalysisProgress = require('../shared/models/AnalysisProgress');
const IndexRebuildProgress = require('../shared/models/IndexRebuildProgress');
const Document = require('../shared/models/Document');
const { connect: connectElasticsearch, createIndex, bulkIndex } = require('../shared/db/elasticsearch');

// Service URLs - these should match your docker-compose service names
const DATA_REFRESH_URL = process.env.DATA_REFRESH_URL || 'http://data-refresh:3005';
const DATA_ANALYSIS_URL = process.env.DATA_ANALYSIS_URL || 'http://data-analysis:3003';

// Get data-refresh service status
router.get('/data-refresh/status', async (req, res) => {
  try {
    // Get latest refresh progress from database
    const latestProgress = await RefreshProgress.findOne()
      .sort({ createdAt: -1 })
      .lean();

    // Check if service is responsive by attempting to connect
    let serviceHealth = 'unknown';
    let serviceDetails = {};
    
    try {
      // Try to ping the data-refresh service health endpoint
      const healthResponse = await axios.get(`${DATA_REFRESH_URL}/health`, { 
        timeout: 5000,
        validateStatus: () => true // Accept any status code
      });
      
      if (healthResponse.status === 200) {
        serviceHealth = 'healthy';
        serviceDetails = healthResponse.data;
      } else {
        serviceHealth = 'unhealthy';
        serviceDetails.error = `Health check returned status ${healthResponse.status}`;
      }
    } catch (error) {
      // Service is not responding - likely container is down
      serviceHealth = 'unhealthy';
      serviceDetails.error = 'Service is not responding - container may be down';
      
      // Check if there's a stuck in_progress record
      const activeProgress = await RefreshProgress.findOne({ status: 'in_progress' });
      if (activeProgress && latestProgress && latestProgress.updatedAt) {
        const lastUpdateTime = new Date(latestProgress.updatedAt);
        const timeSinceUpdate = Date.now() - lastUpdateTime.getTime();
        const minutesSinceUpdate = timeSinceUpdate / (1000 * 60);
        
        if (minutesSinceUpdate > 10) {
          serviceDetails.stuckProgress = true;
          serviceDetails.minutesSinceUpdate = Math.round(minutesSinceUpdate);
        }
      }
    }

    // Override status to show correct state if no active progress
    const finalStatus = latestProgress ? latestProgress.status : 'unknown';
    
    res.json({
      service: 'data-refresh',
      status: serviceHealth,
      latestRun: latestProgress ? {
        startTime: latestProgress.createdAt,
        endTime: latestProgress.completedAt,
        status: finalStatus === 'in_progress' && serviceHealth === 'unhealthy' ? 'failed' : finalStatus,
        processedTitles: latestProgress.processedTitles,
        totalTitles: latestProgress.totalTitles,
        failedTitles: latestProgress.failedTitles?.length || 0,
        currentTitle: latestProgress.currentTitle
      } : null,
      details: serviceDetails
    });
  } catch (error) {
    logger.error('Error getting data-refresh status:', error);
    res.status(500).json({ error: 'Failed to get service status' });
  }
});

// Get data-analysis service status
router.get('/data-analysis/status', async (req, res) => {
  try {
    // Get latest analysis progress from database
    const latestProgress = await AnalysisProgress.findOne()
      .sort({ createdAt: -1 })
      .lean();

    // Check if service is responsive
    let serviceHealth = 'unknown';
    let serviceDetails = {};
    
    try {
      // Similar health check as above
      if (latestProgress && latestProgress.updatedAt) {
        const lastUpdateTime = new Date(latestProgress.updatedAt);
        const timeSinceUpdate = Date.now() - lastUpdateTime.getTime();
        const hoursSinceUpdate = timeSinceUpdate / (1000 * 60 * 60);
        
        if (hoursSinceUpdate < 12) { // Active within last 12 hours (analysis runs more frequently)
          serviceHealth = 'healthy';
        } else {
          serviceHealth = 'inactive';
        }
      }
    } catch (error) {
      serviceHealth = 'unhealthy';
      serviceDetails.error = error.message;
    }

    res.json({
      service: 'data-analysis',
      status: serviceHealth,
      latestRun: latestProgress ? {
        startTime: latestProgress.startTime,
        endTime: latestProgress.endTime,
        status: latestProgress.status,
        processedTitles: latestProgress.processedTitles || 0,
        totalTitles: latestProgress.totalTitles || 0,
        error: latestProgress.error
      } : null,
      details: serviceDetails
    });
  } catch (error) {
    logger.error('Error getting data-analysis status:', error);
    res.status(500).json({ error: 'Failed to get service status' });
  }
});

// Trigger data-refresh manually
router.post('/data-refresh/trigger', async (req, res) => {
  try {
    // Check if a refresh is already in progress
    const inProgressRefresh = await RefreshProgress.findOne({
      status: 'in_progress'
    });

    if (inProgressRefresh) {
      return res.status(409).json({
        error: 'A refresh is already in progress',
        startedAt: inProgressRefresh.createdAt
      });
    }

    // Create a new refresh progress record to signal the service
    const newRefresh = new RefreshProgress({
      status: 'pending',
      totalTitles: 0,
      processedTitles: 0,
      failedTitles: [],
      triggeredBy: 'manual',
      createdAt: new Date()
    });

    await newRefresh.save();

    // The data-refresh service should pick this up on its next check
    // Alternatively, if the service exposes an endpoint:
    // await axios.post(`${DATA_REFRESH_URL}/trigger`);

    res.json({
      message: 'Data refresh triggered successfully',
      refreshId: newRefresh._id
    });
  } catch (error) {
    logger.error('Error triggering data-refresh:', error);
    res.status(500).json({ error: 'Failed to trigger refresh' });
  }
});

// Trigger data-analysis manually
router.post('/data-analysis/trigger', async (req, res) => {
  try {
    // Check if an analysis is already in progress
    const inProgressAnalysis = await AnalysisProgress.findOne({
      status: 'in_progress'
    });

    if (inProgressAnalysis) {
      return res.status(409).json({
        error: 'An analysis is already in progress',
        startedAt: inProgressAnalysis.startTime
      });
    }

    // Create a new analysis progress record
    const newAnalysis = new AnalysisProgress({
      status: 'pending',
      triggeredBy: 'manual'
      // Note: startTime will be set when the analysis actually begins
    });

    await newAnalysis.save();

    res.json({
      message: 'Data analysis triggered successfully',
      analysisId: newAnalysis._id
    });
  } catch (error) {
    logger.error('Error triggering data-analysis:', error);
    res.status(500).json({ error: 'Failed to trigger analysis' });
  }
});

// Trigger single title refresh
router.post('/data-refresh/trigger-title', async (req, res) => {
  try {
    const { titleNumber } = req.body;
    
    if (!titleNumber) {
      return res.status(400).json({ error: 'Title number is required' });
    }
    
    // Validate title number
    const parsedNumber = parseInt(titleNumber);
    if (isNaN(parsedNumber) || parsedNumber < 1 || parsedNumber > 50) {
      return res.status(400).json({ error: 'Invalid title number. Must be between 1 and 50.' });
    }
    
    // Check if any refresh is already in progress
    const inProgressRefresh = await RefreshProgress.findOne({
      status: 'in_progress'
    });

    if (inProgressRefresh) {
      return res.status(409).json({
        error: 'A refresh is already in progress',
        startedAt: inProgressRefresh.createdAt,
        type: inProgressRefresh.type
      });
    }

    // Create a new refresh progress record for single title
    const newRefresh = new RefreshProgress({
      type: 'single_title',
      status: 'pending',
      totalTitles: 1,
      processedTitles: 0,
      failedTitles: [],
      titlesOrder: [parsedNumber],
      currentTitle: {
        number: parsedNumber,
        startedAt: new Date()
      },
      triggeredBy: 'manual_single',
      metadata: {
        targetTitle: parsedNumber
      },
      createdAt: new Date()
    });

    await newRefresh.save();

    // The data-refresh service should pick this up and process it
    // For immediate processing, we could also call the service directly if it exposes an endpoint

    res.json({
      message: `Single title refresh triggered successfully for title ${titleNumber}`,
      refreshId: newRefresh._id,
      titleNumber: parsedNumber
    });
  } catch (error) {
    logger.error('Error triggering single title refresh:', error);
    res.status(500).json({ error: 'Failed to trigger single title refresh' });
  }
});

// Trigger single title analysis
router.post('/data-analysis/trigger-title', async (req, res) => {
  try {
    const { titleNumber } = req.body;
    
    if (!titleNumber) {
      return res.status(400).json({ error: 'Title number is required' });
    }
    
    // Validate title number
    const parsedNumber = parseInt(titleNumber);
    if (isNaN(parsedNumber) || parsedNumber < 1 || parsedNumber > 50) {
      return res.status(400).json({ error: 'Invalid title number. Must be between 1 and 50.' });
    }
    
    // Check if an analysis is already in progress
    const inProgressAnalysis = await AnalysisProgress.findOne({
      status: 'in_progress'
    });

    if (inProgressAnalysis) {
      return res.status(409).json({
        error: 'An analysis is already in progress',
        startedAt: inProgressAnalysis.startTime,
        type: inProgressAnalysis.type
      });
    }

    // Create a new analysis progress record for single title
    const newAnalysis = new AnalysisProgress({
      type: 'single_title',
      status: 'pending',
      totalTitles: 1,
      processedTitles: 0,
      failedTitles: [],
      currentTitle: {
        number: parsedNumber
      },
      triggeredBy: 'manual',
      metadata: {
        targetTitle: parsedNumber
      }
    });

    await newAnalysis.save();

    res.json({
      message: `Single title analysis triggered successfully for title ${titleNumber}`,
      analysisId: newAnalysis._id,
      titleNumber: parsedNumber
    });
  } catch (error) {
    logger.error('Error triggering single title analysis:', error);
    res.status(500).json({ error: 'Failed to trigger single title analysis' });
  }
});

// Stop running data analysis
router.post('/data-analysis/stop', async (req, res) => {
  try {
    // Find any in-progress analysis
    const inProgressAnalysis = await AnalysisProgress.findOne({
      status: 'in_progress'
    });

    if (!inProgressAnalysis) {
      return res.status(404).json({
        error: 'No analysis is currently in progress'
      });
    }

    // Mark the analysis as cancelled
    inProgressAnalysis.status = 'cancelled';
    inProgressAnalysis.endTime = new Date();
    inProgressAnalysis.error = 'Analysis cancelled by user';
    await inProgressAnalysis.save();

    logger.info(`Analysis ${inProgressAnalysis._id} cancelled by user`);

    res.json({
      message: 'Analysis stop request sent successfully',
      analysisId: inProgressAnalysis._id,
      type: inProgressAnalysis.type,
      processedTitles: inProgressAnalysis.processedTitles,
      totalTitles: inProgressAnalysis.totalTitles
    });
  } catch (error) {
    logger.error('Error stopping data analysis:', error);
    res.status(500).json({ error: 'Failed to stop analysis' });
  }
});

// Get search index rebuild status
router.get('/search-index/status', async (req, res) => {
  try {
    // Get latest rebuild progress
    const latestRebuild = await IndexRebuildProgress.findOne()
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      service: 'search-index',
      latestRebuild: latestRebuild ? {
        status: latestRebuild.status,
        startTime: latestRebuild.startTime,
        endTime: latestRebuild.endTime,
        totalDocuments: latestRebuild.totalDocuments,
        processedDocuments: latestRebuild.processedDocuments,
        indexedDocuments: latestRebuild.indexedDocuments,
        failedDocuments: latestRebuild.failedDocuments,
        currentTitle: latestRebuild.currentTitle,
        error: latestRebuild.error,
        operations: latestRebuild.operations
      } : null
    });
  } catch (error) {
    logger.error('Error getting search index status:', error);
    res.status(500).json({ error: 'Failed to get search index status' });
  }
});

// Trigger search index rebuild
router.post('/search-index/rebuild', async (req, res) => {
  try {
    // Check if a rebuild is already in progress
    const inProgressRebuild = await IndexRebuildProgress.findOne({
      status: 'in_progress'
    });

    if (inProgressRebuild) {
      return res.status(409).json({
        error: 'An index rebuild is already in progress',
        startedAt: inProgressRebuild.startTime
      });
    }

    // Create a new rebuild progress record
    const newRebuild = new IndexRebuildProgress({
      status: 'pending',
      triggeredBy: 'manual',
      startTime: new Date()
    });

    await newRebuild.save();

    // Start the rebuild process asynchronously
    rebuildSearchIndex(newRebuild._id).catch(error => {
      logger.error('Error in rebuild process:', error);
    });

    res.json({
      message: 'Search index rebuild started successfully',
      rebuildId: newRebuild._id
    });
  } catch (error) {
    logger.error('Error triggering search index rebuild:', error);
    res.status(500).json({ error: 'Failed to trigger search index rebuild' });
  }
});

// Async function to rebuild the search index
async function rebuildSearchIndex(rebuildId) {
  const rebuild = await IndexRebuildProgress.findById(rebuildId);
  if (!rebuild) return;

  try {
    // Update status to in_progress
    rebuild.status = 'in_progress';
    rebuild.operations = {
      deleteIndex: { completed: false },
      createIndex: { completed: false },
      indexDocuments: { completed: false }
    };
    await rebuild.save();

    // Get Elasticsearch client
    const esClient = await connectElasticsearch();

    // Step 1: Delete existing index
    try {
      logger.info('Deleting existing search index...');
      const indexExists = await esClient.indices.exists({ index: 'ecfr_documents' });
      if (indexExists) {
        await esClient.indices.delete({ index: 'ecfr_documents' });
      }
      rebuild.operations.deleteIndex = { completed: true };
      await rebuild.save();
    } catch (error) {
      logger.error('Error deleting index:', error);
      rebuild.operations.deleteIndex = { completed: false, error: error.message };
      await rebuild.save();
      throw error;
    }

    // Step 2: Create new index
    try {
      logger.info('Creating new search index...');
      await createIndex();
      rebuild.operations.createIndex = { completed: true };
      await rebuild.save();
    } catch (error) {
      logger.error('Error creating index:', error);
      rebuild.operations.createIndex = { completed: false, error: error.message };
      await rebuild.save();
      throw error;
    }

    // Step 3: Index all documents
    try {
      logger.info('Indexing documents...');
      
      // Get total document count
      const totalCount = await Document.countDocuments({});
      rebuild.totalDocuments = totalCount;
      await rebuild.save();

      // Process documents in batches by title
      const titles = await Document.distinct('titleNumber');
      titles.sort((a, b) => a - b);

      for (const titleNumber of titles) {
        // Check if rebuild was cancelled
        const currentRebuild = await IndexRebuildProgress.findById(rebuildId);
        if (currentRebuild.status === 'cancelled') {
          logger.info('Index rebuild cancelled by user');
          return;
        }

        // Get title name
        const titleDoc = await Document.findOne({ titleNumber }).select('titleName');
        const titleName = titleDoc ? titleDoc.titleName : `Title ${titleNumber}`;

        // Update current title
        rebuild.currentTitle = { number: titleNumber, name: titleName };
        await rebuild.save();

        // Get documents for this title
        const documents = await Document.find({ titleNumber })
          .select('identifier titleNumber titleName subtitle chapter part section heading content contentFormat effectiveDate source authority')
          .lean();

        if (documents.length > 0) {
          // Prepare documents for indexing
          const bulkDocs = documents.map(doc => ({
            id: doc._id.toString(),
            identifier: doc.identifier,
            titleNumber: doc.titleNumber,
            titleName: doc.titleName,
            subtitle: doc.subtitle,
            chapter: doc.chapter,
            part: doc.part,
            section: doc.section,
            heading: doc.heading,
            content: doc.content,
            contentFormat: doc.contentFormat,
            effectiveDate: doc.effectiveDate,
            source: doc.source,
            authority: doc.authority,
            hierarchy: `Title ${doc.titleNumber}${doc.part ? ` > Part ${doc.part}` : ''}${doc.section ? ` > Section ${doc.section}` : ''}`
          }));

          // Index documents in batches
          const batchSize = 100;
          for (let i = 0; i < bulkDocs.length; i += batchSize) {
            const batch = bulkDocs.slice(i, i + batchSize);
            try {
              await bulkIndex(batch);
              rebuild.indexedDocuments += batch.length;
            } catch (error) {
              logger.error(`Error indexing batch for title ${titleNumber}:`, error);
              rebuild.failedDocuments += batch.length;
            }
            rebuild.processedDocuments += batch.length;
            await rebuild.save();
          }
        }
      }

      rebuild.operations.indexDocuments = { completed: true };
      await rebuild.save();

    } catch (error) {
      logger.error('Error indexing documents:', error);
      rebuild.operations.indexDocuments = { completed: false, error: error.message };
      await rebuild.save();
      throw error;
    }

    // Mark as completed
    rebuild.status = 'completed';
    rebuild.endTime = new Date();
    await rebuild.save();

    logger.info(`Search index rebuild completed. Indexed ${rebuild.indexedDocuments} documents, failed ${rebuild.failedDocuments}`);

  } catch (error) {
    logger.error('Search index rebuild failed:', error);
    rebuild.status = 'failed';
    rebuild.endTime = new Date();
    rebuild.error = error.message;
    await rebuild.save();
  }
}

module.exports = router;