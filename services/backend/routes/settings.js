const express = require('express');
const router = express.Router();
const Settings = require('../shared/models/Settings');
const logger = require('../shared/utils/logger');

// Get regulatory keywords
router.get('/keywords', async (req, res, next) => {
  try {
    const keywords = await Settings.getSetting('regulatory_keywords', Settings.getDefaultKeywords());
    res.json({ keywords });
  } catch (error) {
    logger.error('Failed to get keywords:', error);
    next(error);
  }
});

// Update regulatory keywords
router.put('/keywords', async (req, res, next) => {
  try {
    const { keywords } = req.body;
    
    if (!Array.isArray(keywords)) {
      return res.status(400).json({ error: 'Keywords must be an array' });
    }
    
    // Validate keywords
    const validKeywords = keywords.filter(k => 
      typeof k === 'string' && 
      k.trim().length > 0 && 
      k.trim().length <= 100
    ).map(k => k.trim().toLowerCase());
    
    if (validKeywords.length === 0) {
      return res.status(400).json({ error: 'At least one valid keyword is required' });
    }
    
    // Remove duplicates
    const uniqueKeywords = [...new Set(validKeywords)];
    
    await Settings.setSetting(
      'regulatory_keywords', 
      uniqueKeywords,
      'Custom regulatory keywords for text analysis'
    );
    
    res.json({ 
      success: true,
      keywords: uniqueKeywords 
    });
  } catch (error) {
    logger.error('Failed to update keywords:', error);
    next(error);
  }
});

// Reset keywords to defaults
router.post('/keywords/reset', async (req, res, next) => {
  try {
    const defaultKeywords = Settings.getDefaultKeywords();
    
    await Settings.setSetting(
      'regulatory_keywords', 
      defaultKeywords,
      'Default regulatory keywords for text analysis'
    );
    
    res.json({ 
      success: true,
      keywords: defaultKeywords 
    });
  } catch (error) {
    logger.error('Failed to reset keywords:', error);
    next(error);
  }
});

module.exports = router;