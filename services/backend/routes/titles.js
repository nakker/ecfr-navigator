const express = require('express');
const router = express.Router();
const Title = require('../shared/models/Title');
const Metric = require('../shared/models/Metric');
const logger = require('../shared/utils/logger');

// Get all titles
router.get('/', async (req, res, next) => {
  try {
    const titles = await Title.find({})
      .select('-xmlContent') // Exclude large XML content
      .sort({ number: 1 });

    // Get latest metrics for each title to include word count
    const titleNumbers = titles.map(t => t.number);
    const latestMetrics = await Metric.aggregate([
      { $match: { titleNumber: { $in: titleNumbers } } },
      { $sort: { titleNumber: 1, analysisDate: -1 } },
      {
        $group: {
          _id: '$titleNumber',
          wordCount: { $first: '$metrics.wordCount' }
        }
      }
    ]);

    // Get latest amendment dates for each title
    const Document = require('../shared/models/Document');
    const latestAmendments = await Document.aggregate([
      { 
        $match: { 
          titleNumber: { $in: titleNumbers },
          amendmentDate: { $exists: true, $ne: null }
        } 
      },
      { $sort: { amendmentDate: -1 } },
      {
        $group: {
          _id: '$titleNumber',
          latestAmendmentDate: { $first: '$amendmentDate' }
        }
      }
    ]);

    // Create maps for lookup
    const wordCountMap = {};
    latestMetrics.forEach(metric => {
      wordCountMap[metric._id] = metric.wordCount;
    });

    const amendmentDateMap = {};
    latestAmendments.forEach(amendment => {
      amendmentDateMap[amendment._id] = amendment.latestAmendmentDate;
    });

    // Add word count and amendment date to each title
    const titlesWithMetrics = titles.map(title => ({
      ...title.toObject(),
      wordCount: wordCountMap[title.number] || 0,
      latestAmendmentDate: amendmentDateMap[title.number] || null
    }));

    res.json(titlesWithMetrics);
  } catch (error) {
    logger.error('Titles fetch error:', error);
    next(error);
  }
});

// Get single title
router.get('/:number', async (req, res, next) => {
  try {
    const { number } = req.params;
    
    const title = await Title.findOne({ number: parseInt(number) })
      .select('-xmlContent');

    if (!title) {
      return res.status(404).json({ error: 'Title not found' });
    }

    // Get the latest amendment date from documents
    const Document = require('../shared/models/Document');
    const latestAmendment = await Document.findOne({
      titleNumber: parseInt(number),
      amendmentDate: { $exists: true, $ne: null }
    })
    .sort({ amendmentDate: -1 })
    .select('amendmentDate');

    // Add the latest amendment date to the title object
    const titleWithAmendment = {
      ...title.toObject(),
      latestAmendmentDate: latestAmendment ? latestAmendment.amendmentDate : null
    };

    res.json(titleWithAmendment);
  } catch (error) {
    logger.error('Title fetch error:', error);
    next(error);
  }
});

// Get title checksum
router.get('/:number/checksum', async (req, res, next) => {
  try {
    const { number } = req.params;
    
    const title = await Title.findOne({ number: parseInt(number) })
      .select('number name checksum lastDownloaded');

    if (!title) {
      return res.status(404).json({ error: 'Title not found' });
    }

    res.json({
      titleNumber: title.number,
      titleName: title.name,
      checksum: title.checksum,
      lastDownloaded: title.lastDownloaded
    });
  } catch (error) {
    logger.error('Checksum fetch error:', error);
    next(error);
  }
});

// Download title XML
router.get('/:number/download', async (req, res, next) => {
  try {
    const { number } = req.params;
    
    const title = await Title.findOne({ number: parseInt(number) });

    if (!title || !title.xmlContent) {
      return res.status(404).json({ error: 'Title XML not found' });
    }

    // Decompress XML
    const zlib = require('zlib');
    const compressed = Buffer.from(title.xmlContent, 'base64');
    const xml = zlib.gunzipSync(compressed).toString();

    // Set headers for file download
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="ecfr-title-${number}.xml"`);
    
    res.send(xml);
  } catch (error) {
    logger.error('Title download error:', error);
    next(error);
  }
});

module.exports = router;