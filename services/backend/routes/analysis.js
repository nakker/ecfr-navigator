const express = require('express');
const router = express.Router();
const SectionAnalysis = require('../shared/models/SectionAnalysis');
const Document = require('../shared/models/Document');
const AnalysisProgress = require('../shared/models/AnalysisProgress');
const logger = require('../shared/utils/logger');

// Get analysis for a specific section
router.get('/section/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const analysis = await SectionAnalysis.findOne({ documentId })
      .populate('documentId', 'heading identifier')
      .lean();
    
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found for this section' });
    }
    
    res.json(analysis);
  } catch (error) {
    logger.error('Error fetching section analysis:', error);
    res.status(500).json({ error: 'Failed to fetch section analysis' });
  }
});

// Get most antiquated sections
router.get('/antiquated', async (req, res) => {
  try {
    const { limit = 10, offset = 0, titleNumber } = req.query;
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);
    
    // Build query filter
    const query = {};
    if (titleNumber) {
      query.titleNumber = parseInt(titleNumber);
    }
    
    const sections = await SectionAnalysis
      .find(query)
      .sort({ antiquatedScore: -1 })
      .skip(offsetNum)
      .limit(limitNum)
      .populate({
        path: 'documentId',
        select: 'heading identifier titleNumber part section'
      })
      .lean();
    
    // Add title information
    const enrichedSections = sections.map(section => ({
      ...section,
      title: `Title ${section.titleNumber}`,
      cfr: `${section.titleNumber} CFR ${section.documentId?.part || ''}.${section.documentId?.section || ''}`
    }));
    
    res.json(enrichedSections);
  } catch (error) {
    logger.error('Error fetching antiquated sections:', error);
    res.status(500).json({ error: 'Failed to fetch antiquated sections' });
  }
});

// Get most business-unfriendly sections
router.get('/business-unfriendly', async (req, res) => {
  try {
    const { limit = 10, offset = 0, titleNumber } = req.query;
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);
    
    // Build query filter
    const query = {};
    if (titleNumber) {
      query.titleNumber = parseInt(titleNumber);
    }
    
    const sections = await SectionAnalysis
      .find(query)
      .sort({ businessUnfriendlyScore: -1 })
      .skip(offsetNum)
      .limit(limitNum)
      .populate({
        path: 'documentId',
        select: 'heading identifier titleNumber part section'
      })
      .lean();
    
    // Add title information
    const enrichedSections = sections.map(section => ({
      ...section,
      title: `Title ${section.titleNumber}`,
      cfr: `${section.titleNumber} CFR ${section.documentId?.part || ''}.${section.documentId?.section || ''}`
    }));
    
    res.json(enrichedSections);
  } catch (error) {
    logger.error('Error fetching business-unfriendly sections:', error);
    res.status(500).json({ error: 'Failed to fetch business-unfriendly sections' });
  }
});

// Get analysis statistics
router.get('/stats', async (req, res) => {
  try {
    const totalAnalyzed = await SectionAnalysis.countDocuments();
    const totalSections = await Document.countDocuments({ type: 'section' });
    
    const avgScores = await SectionAnalysis.aggregate([
      {
        $group: {
          _id: null,
          avgAntiquated: { $avg: '$antiquatedScore' },
          avgBusinessUnfriendly: { $avg: '$businessUnfriendlyScore' }
        }
      }
    ]);
    
    const stats = {
      totalAnalyzed,
      totalSections,
      percentageAnalyzed: totalSections > 0 ? Math.round((totalAnalyzed / totalSections) * 100) : 0,
      averageAntiquatedScore: avgScores[0]?.avgAntiquated || 0,
      averageBusinessUnfriendlyScore: avgScores[0]?.avgBusinessUnfriendly || 0
    };
    
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching analysis statistics:', error);
    res.status(500).json({ error: 'Failed to fetch analysis statistics' });
  }
});

// Get analysis for multiple sections (batch)
router.post('/sections/batch', async (req, res) => {
  try {
    const { documentIds } = req.body;
    
    if (!Array.isArray(documentIds)) {
      return res.status(400).json({ error: 'documentIds must be an array' });
    }
    
    const analyses = await SectionAnalysis
      .find({ documentId: { $in: documentIds } })
      .lean();
    
    // Create a map for easy lookup
    const analysisMap = {};
    analyses.forEach(analysis => {
      analysisMap[analysis.documentId.toString()] = analysis;
    });
    
    res.json(analysisMap);
  } catch (error) {
    logger.error('Error fetching batch section analyses:', error);
    res.status(500).json({ error: 'Failed to fetch section analyses' });
  }
});

// Get analysis progress
router.get('/progress', async (req, res) => {
  try {
    const { type } = req.query;
    
    let query = { status: { $ne: 'pending' } };
    if (type) {
      query.type = type;
    }
    
    const progress = await AnalysisProgress
      .findOne(query)
      .sort({ createdAt: -1 })
      .lean();
    
    res.json(progress);
  } catch (error) {
    logger.error('Error fetching analysis progress:', error);
    res.status(500).json({ error: 'Failed to fetch analysis progress' });
  }
});

module.exports = router;