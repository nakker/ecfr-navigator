const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { search } = require('../shared/db/elasticsearch');
const logger = require('../shared/utils/logger');

// Search validation schema
const searchSchema = Joi.object({
  query: Joi.string().min(2).max(500).required(),
  titleNumber: Joi.number().min(1).max(50),
  type: Joi.string().valid('title', 'subtitle', 'chapter', 'subchapter', 'part', 'subpart', 'subjectgroup', 'section', 'appendix'),
  subtitle: Joi.string(),
  chapter: Joi.string(),
  subchapter: Joi.string(),
  part: Joi.string(),
  subpart: Joi.string(),
  subjectGroup: Joi.string(),
  section: Joi.string(),
  from: Joi.number().min(0).default(0),
  size: Joi.number().min(1).max(100).default(20)
});

// Search documents
router.get('/', async (req, res, next) => {
  try {
    // Validate query parameters
    const { error, value } = searchSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { query, titleNumber, type, subtitle, chapter, subchapter, part, subpart, subjectGroup, section, from, size } = value;

    // Build OpenSearch query
    const must = [
      {
        multi_match: {
          query,
          fields: ['content', 'heading^2', 'identifier^3', 'authority', 'source'],
          type: 'best_fields',
          operator: 'or',
          fuzziness: 'AUTO'
        }
      }
    ];

    // Add filters
    const filter = [];
    if (titleNumber) filter.push({ term: { titleNumber } });
    if (type) filter.push({ term: { type } });
    if (subtitle) filter.push({ term: { subtitle } });
    if (chapter) filter.push({ term: { chapter } });
    if (subchapter) filter.push({ term: { subchapter } });
    if (part) filter.push({ term: { part } });
    if (subpart) filter.push({ term: { subpart } });
    if (subjectGroup) filter.push({ term: { subjectGroup } });
    if (section) filter.push({ term: { section } });

    const searchQuery = {
      query: {
        bool: {
          must,
          filter: filter.length > 0 ? filter : undefined
        }
      },
      from,
      size,
      highlight: {
        fields: {
          content: {
            fragment_size: 150,
            number_of_fragments: 3
          }
        }
      },
      _source: {
        excludes: ['content'] // Exclude full content from search results
      }
    };

    const results = await search(searchQuery);

    // Format response
    const response = {
      total: results.hits.total.value,
      hits: results.hits.hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
        highlights: hit.highlight
      })),
      query: value
    };

    res.json(response);
  } catch (error) {
    logger.error('Search error:', error);
    next(error);
  }
});

// Get search suggestions
router.get('/suggest', async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const searchQuery = {
      suggest: {
        text: q,
        'title-suggest': {
          completion: {
            field: 'suggest',
            size: 10
          }
        }
      }
    };

    const results = await search(searchQuery);
    const suggestions = results.suggest['title-suggest'][0].options.map(option => ({
      text: option.text,
      score: option._score
    }));

    res.json({ suggestions });
  } catch (error) {
    logger.error('Suggest error:', error);
    next(error);
  }
});

module.exports = router;