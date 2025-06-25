const express = require('express');
const router = express.Router();
const Metric = require('../shared/models/Metric');
const VersionHistory = require('../shared/models/VersionHistory');
const logger = require('../shared/utils/logger');

// Get latest metrics for a title
router.get('/title/:titleNumber', async (req, res, next) => {
  try {
    const { titleNumber } = req.params;
    
    const metric = await Metric.findOne({ titleNumber: parseInt(titleNumber) })
      .sort({ analysisDate: -1 });

    if (!metric) {
      return res.status(404).json({ error: 'No metrics found for this title' });
    }

    // Debug: Log the metric data
    logger.info(`Metric found for title ${titleNumber}:`, {
      hasKeywordFrequency: !!metric.metrics.keywordFrequency,
      keywordFrequency: metric.metrics.keywordFrequency
    });

    // Calculate keyword frequency by part (not chapter)
    const Document = require('../shared/models/Document');
    const Settings = require('../shared/models/Settings');
    
    const documents = await Document.find({ 
      titleNumber: parseInt(titleNumber),
      type: 'section'
    }).select('part content identifier heading');

    logger.info(`Found ${documents.length} documents with parts for title ${titleNumber}`);
    
    // Debug: Check a few documents
    if (documents.length > 0) {
      logger.info(`Sample document parts:`, {
        first: documents[0]?.part,
        count: documents.slice(0, 5).map(d => d.part)
      });
    }

    const keywordByChapter = {}; // Keep the name for compatibility
    
    // Get custom keywords from settings
    const customKeywords = await Settings.getSetting('regulatory_keywords', Settings.getDefaultKeywords());
    const keywords = customKeywords.map(keyword => 
      keyword.replace(/\s+(.)/g, (match, chr) => chr.toUpperCase()).replace(/\s+/g, '')
    );
    
    // Initialize keyword data structure
    keywords.forEach(keyword => {
      keywordByChapter[keyword] = {};
    });

    // Count keywords by section (since part is null)
    documents.forEach(doc => {
      if (!doc.content) return;
      
      // Extract part number from identifier or heading if available
      let chapterKey = 'Unknown';
      if (doc.heading) {
        // Try to extract part number from heading (e.g., "§ 2.1" -> "Part 2")
        const partMatch = doc.heading.match(/§\s*(\d+)\./);
        if (partMatch) {
          chapterKey = `Part ${partMatch[1]}`;
        }
      }
      
      const content = doc.content.toLowerCase();
      
      // Use both camelCase keys and original keywords for searching
      customKeywords.forEach((originalKeyword, index) => {
        const camelCaseKey = keywords[index];
        const regex = new RegExp(`\\b${originalKeyword}\\b`, 'gi');
        const matches = content.match(regex) || [];
        
        if (!keywordByChapter[camelCaseKey][chapterKey]) {
          keywordByChapter[camelCaseKey][chapterKey] = 0;
        }
        keywordByChapter[camelCaseKey][chapterKey] += matches.length;
      });
    });

    // Add keywordByChapter to the response
    const response = metric.toObject();
    
    // Ensure all keywords are present in keywordFrequency, matching the custom keywords
    if (response.metrics && response.metrics.keywordFrequency) {
      // Create a new keywordFrequency object with all custom keywords
      const newKeywordFrequency = {};
      customKeywords.forEach(keyword => {
        const camelCaseKey = keyword.replace(/\s+(.)/g, (match, chr) => chr.toUpperCase()).replace(/\s+/g, '');
        // Use the value from existing data if available, otherwise 0
        newKeywordFrequency[camelCaseKey] = response.metrics.keywordFrequency[camelCaseKey] || 0;
      });
      response.metrics.keywordFrequency = newKeywordFrequency;
    }
    
    response.keywordByChapter = keywordByChapter;

    // Debug: Log the response being sent
    logger.info(`Sending metrics response for title ${titleNumber}:`, {
      hasMetrics: !!response.metrics,
      hasKeywordFrequency: !!response.metrics?.keywordFrequency,
      keywordFrequencyKeys: response.metrics?.keywordFrequency ? Object.keys(response.metrics.keywordFrequency) : [],
      hasKeywordByChapter: !!response.keywordByChapter,
      keywordByChapterKeys: Object.keys(response.keywordByChapter)
    });

    res.json(response);
  } catch (error) {
    logger.error('Metrics fetch error:', error);
    next(error);
  }
});

// Get metrics history for a title
router.get('/title/:titleNumber/history', async (req, res, next) => {
  try {
    const { titleNumber } = req.params;
    const { limit = 30 } = req.query;
    
    const metrics = await Metric.find({ titleNumber: parseInt(titleNumber) })
      .sort({ analysisDate: -1 })
      .limit(parseInt(limit))
      .select('-metrics.regulationAgeDistribution');

    res.json(metrics);
  } catch (error) {
    logger.error('Metrics history error:', error);
    next(error);
  }
});

// Get version history for a title
router.get('/title/:titleNumber/versions', async (req, res, next) => {
  try {
    const { titleNumber } = req.params;
    
    const versionHistory = await VersionHistory.findOne({ 
      titleNumber: parseInt(titleNumber) 
    });

    if (!versionHistory) {
      return res.status(404).json({ error: 'No version history found for this title' });
    }

    res.json(versionHistory);
  } catch (error) {
    logger.error('Version history error:', error);
    next(error);
  }
});

// Get aggregate metrics across all titles
router.get('/aggregate', async (req, res, next) => {
  try {
    const latestMetrics = await Metric.aggregate([
      // Get latest metric for each title
      { $sort: { titleNumber: 1, analysisDate: -1 } },
      {
        $group: {
          _id: '$titleNumber',
          latestMetric: { $first: '$$ROOT' }
        }
      },
      {
        $group: {
          _id: null,
          totalWordCount: { $sum: '$latestMetric.metrics.wordCount' },
          avgComplexityScore: { $avg: '$latestMetric.metrics.complexityScore' },
          avgReadabilityScore: { $avg: '$latestMetric.metrics.readabilityScore' },
          totalKeywords: {
            $push: '$latestMetric.metrics.keywordFrequency'
          },
          titleMetrics: {
            $push: {
              titleNumber: '$latestMetric.titleNumber',
              keywordFrequency: '$latestMetric.metrics.keywordFrequency'
            }
          }
        }
      }
    ]);

    if (latestMetrics.length === 0) {
      return res.json({
        totalWordCount: 0,
        avgComplexityScore: 0,
        avgReadabilityScore: 0,
        aggregateKeywordFrequency: {},
        keywordByTitle: {}
      });
    }

    // Get custom keywords from settings
    const Settings = require('../shared/models/Settings');
    const customKeywords = await Settings.getSetting('regulatory_keywords', Settings.getDefaultKeywords());
    
    // Initialize aggregateKeywords and keywordByTitle with all custom keywords
    const aggregateKeywords = {};
    const keywordByTitle = {};
    
    customKeywords.forEach(keyword => {
      const camelCaseKey = keyword.replace(/\s+(.)/g, (match, chr) => chr.toUpperCase()).replace(/\s+/g, '');
      aggregateKeywords[camelCaseKey] = 0;
      keywordByTitle[camelCaseKey] = {};
    });
    
    // Debug logging
    logger.info(`Aggregate metrics - Processing ${latestMetrics[0].titleMetrics.length} titles`);
    let titlesWithData = 0;
    let titlesWithoutData = 0;
    
    // Aggregate keyword frequencies from all titles
    latestMetrics[0].titleMetrics.forEach(titleData => {
      // Skip if keywordFrequency is null or undefined
      if (!titleData.keywordFrequency) {
        titlesWithoutData++;
        logger.debug(`Title ${titleData.titleNumber} has no keywordFrequency data`);
        return;
      }
      
      titlesWithData++;
      
      // Debug: log keywords from first title
      if (titleData.titleNumber === 1) {
        logger.info(`Title 1 keywords in metrics:`, Object.keys(titleData.keywordFrequency));
        logger.info(`Custom keywords expected:`, Object.keys(aggregateKeywords));
      }
      
      Object.entries(titleData.keywordFrequency).forEach(([keyword, count]) => {
        // Only include keywords that are in our custom list
        if (keyword in aggregateKeywords) {
          // Aggregate total
          aggregateKeywords[keyword] = (aggregateKeywords[keyword] || 0) + count;
          
          // Track by title
          keywordByTitle[keyword][`Title ${titleData.titleNumber}`] = count;
        }
      });
    });
    
    logger.info(`Aggregate metrics summary: ${titlesWithData} titles with data, ${titlesWithoutData} without`);
    
    // Debug: Check if any titles were added to keywordByTitle
    const titlesInKeywordByTitle = new Set();
    Object.values(keywordByTitle).forEach(titleData => {
      Object.keys(titleData).forEach(title => titlesInKeywordByTitle.add(title));
    });
    logger.info(`keywordByTitle contains data for ${titlesInKeywordByTitle.size} unique titles`);
    logger.info(`Sample keywordByTitle:`, Object.entries(keywordByTitle).slice(0, 2).map(([k, v]) => ({
      keyword: k,
      titleCount: Object.keys(v).length,
      sampleTitles: Object.keys(v).slice(0, 3)
    })));

    res.json({
      totalWordCount: latestMetrics[0].totalWordCount,
      avgComplexityScore: latestMetrics[0].avgComplexityScore,
      avgReadabilityScore: latestMetrics[0].avgReadabilityScore,
      aggregateKeywordFrequency: aggregateKeywords,
      keywordByTitle: keywordByTitle
    });
  } catch (error) {
    logger.error('Aggregate metrics error:', error);
    next(error);
  }
});

// Get version history for a title
router.get('/title/:titleNumber/versions', async (req, res, next) => {
  try {
    const { titleNumber } = req.params;
    
    const versionHistory = await VersionHistory.findOne({ 
      titleNumber: parseInt(titleNumber) 
    });

    if (!versionHistory) {
      return res.status(404).json({ error: 'No version history found for this title' });
    }

    res.json(versionHistory);
  } catch (error) {
    logger.error('Version history error:', error);
    next(error);
  }
});

module.exports = router;