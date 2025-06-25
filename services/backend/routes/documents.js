const express = require('express');
const router = express.Router();
const Document = require('../shared/models/Document');
const logger = require('../shared/utils/logger');
const { retrieveFromGridFS } = require('../shared/utils/gridfs');

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Documents router is working' });
});

// Debug route to check amendment dates
router.get('/debug/amendment-dates/:titleNumber', async (req, res, next) => {
  try {
    const { titleNumber } = req.params;
    const parsedTitleNumber = parseInt(titleNumber);
    
    if (isNaN(parsedTitleNumber)) {
      return res.status(400).json({ error: 'Invalid title number' });
    }
    
    const documentsWithDates = await Document.countDocuments({
      titleNumber: parsedTitleNumber,
      amendmentDate: { $exists: true, $ne: null }
    });
    
    const totalDocuments = await Document.countDocuments({
      titleNumber: parsedTitleNumber
    });
    
    const sampleDocuments = await Document.find({
      titleNumber: parsedTitleNumber
    })
    .select('type identifier amendmentDate effectiveDate')
    .limit(5);
    
    res.json({
      titleNumber: parsedTitleNumber,
      totalDocuments,
      documentsWithAmendmentDate: documentsWithDates,
      documentsWithoutAmendmentDate: totalDocuments - documentsWithDates,
      sampleDocuments
    });
  } catch (error) {
    logger.error('Debug amendment dates error:', error);
    next(error);
  }
});

// Get documents by title - Define this BEFORE the parameterized routes
router.get('/title/:titleNumber', async (req, res, next) => {
  try {
    const { titleNumber } = req.params;
    const { type, limit = 100, offset = 0, includeContent = false } = req.query;

    // Validate titleNumber
    logger.info(`Documents by title - received titleNumber: ${titleNumber}`);
    const parsedTitleNumber = parseInt(titleNumber);
    logger.info(`Documents by title - parsed titleNumber: ${parsedTitleNumber}`);
    if (isNaN(parsedTitleNumber) || parsedTitleNumber < 1 || parsedTitleNumber > 50) {
      return res.status(400).json({ error: 'Invalid title number. Must be between 1 and 50.' });
    }

    const query = { titleNumber: parsedTitleNumber };
    if (type) query.type = type;

    // Build query with optional content inclusion
    let documentQuery = Document.find(query);
    
    // Only exclude content fields if includeContent is false
    if (includeContent !== 'true' && includeContent !== true) {
      documentQuery = documentQuery.select('-content -structuredContent -formattedContent');
    }
    
    const documents = await documentQuery
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .sort({ _id: 1 }); // Sort by creation order (document order)

    const total = await Document.countDocuments(query);

    res.json({
      documents,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Documents list error:', error);
    next(error);
  }
});

// Get document by ID
router.get('/:titleNumber/:identifier', async (req, res, next) => {
  try {
    const { titleNumber, identifier } = req.params;
    
    // Validate titleNumber
    const parsedTitleNumber = parseInt(titleNumber);
    if (isNaN(parsedTitleNumber) || parsedTitleNumber < 1 || parsedTitleNumber > 50) {
      return res.status(400).json({ error: 'Invalid title number. Must be between 1 and 50.' });
    }
    
    let document = await Document.findOne({
      titleNumber: parsedTitleNumber,
      identifier: decodeURIComponent(identifier)
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Convert to plain object to modify
    document = document.toObject();

    // Retrieve content from GridFS if needed
    if (document.contentGridFS) {
      try {
        const content = await retrieveFromGridFS(document.contentGridFS);
        document.content = content;
      } catch (gridfsError) {
        logger.error('Failed to retrieve content from GridFS:', gridfsError);
        document.content = 'Failed to retrieve content from storage';
      }
    }

    // Retrieve structured content from GridFS if needed
    if (document.structuredContentGridFS) {
      try {
        const structuredContent = await retrieveFromGridFS(document.structuredContentGridFS);
        document.structuredContent = JSON.parse(structuredContent);
      } catch (gridfsError) {
        logger.error('Failed to retrieve structured content from GridFS:', gridfsError);
      }
    }

    // Retrieve formatted content from GridFS if needed
    if (document.formattedContentGridFS) {
      try {
        const formattedContent = await retrieveFromGridFS(document.formattedContentGridFS);
        document.formattedContent = formattedContent;
      } catch (gridfsError) {
        logger.error('Failed to retrieve formatted content from GridFS:', gridfsError);
        document.formattedContent = document.content || 'Failed to retrieve formatted content from storage';
      }
    }

    res.json(document);
  } catch (error) {
    logger.error('Document fetch error:', error);
    next(error);
  }
});

// Download document as text
router.get('/:titleNumber/:identifier/download', async (req, res, next) => {
  try {
    const { titleNumber, identifier } = req.params;
    
    // Validate titleNumber
    const parsedTitleNumber = parseInt(titleNumber);
    if (isNaN(parsedTitleNumber) || parsedTitleNumber < 1 || parsedTitleNumber > 50) {
      return res.status(400).json({ error: 'Invalid title number. Must be between 1 and 50.' });
    }
    
    const document = await Document.findOne({
      titleNumber: parsedTitleNumber,
      identifier: decodeURIComponent(identifier)
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="title-${titleNumber}-${identifier}.txt"`);
    
    // Format document content
    let content = `Title ${titleNumber} - ${document.heading || document.identifier}\n`;
    content += `Type: ${document.type}\n`;
    if (document.subtitle) content += `Subtitle: ${document.subtitle}\n`;
    if (document.chapter) content += `Chapter: ${document.chapter}\n`;
    if (document.subchapter) content += `Subchapter: ${document.subchapter}\n`;
    if (document.part) content += `Part: ${document.part}\n`;
    if (document.subpart) content += `Subpart: ${document.subpart}\n`;
    if (document.subjectGroup) content += `Subject Group: ${document.subjectGroup}\n`;
    if (document.section) content += `Section: ${document.section}\n`;
    if (document.authority) content += `\nAuthority: ${document.authority}\n`;
    if (document.source) content += `Source: ${document.source}\n`;
    if (document.amendmentDate) content += `Amendment Date: ${new Date(document.amendmentDate).toLocaleDateString()}\n`;
    
    // Add citations if present
    if (document.citations && document.citations.length > 0) {
      content += `\nCitations:\n`;
      document.citations.forEach(citation => {
        content += `- ${citation.text}\n`;
      });
    }
    
    // Add editorial notes if present
    if (document.editorialNotes && document.editorialNotes.length > 0) {
      content += `\nEditorial Notes:\n`;
      document.editorialNotes.forEach(note => {
        content += `${note.heading}: ${note.content}\n`;
      });
    }
    
    // Add main content
    content += `\n${document.content}`;
    
    // Add image references if present
    if (document.images && document.images.length > 0) {
      content += `\n\nImages:\n`;
      document.images.forEach(img => {
        content += `- ${img.src}`;
        if (img.pdfLink) content += ` (PDF: ${img.pdfLink})`;
        content += '\n';
      });
    }

    res.send(content);
  } catch (error) {
    logger.error('Document download error:', error);
    next(error);
  }
});

module.exports = router;