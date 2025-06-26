const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const metricsRouter = require('../../../../services/backend/routes/metrics');
const Metric = require('../../../../services/shared/models/Metric');
const Document = require('../../../../services/shared/models/Document');
const SectionAnalysis = require('../../../../services/shared/models/SectionAnalysis');
const { DatabaseHelper, TestDataBuilder } = require('../../../utils/testHelpers');
const { sampleMetrics } = require('../../../fixtures/sampleData');

describe('Metrics API Integration Tests', () => {
  let app;

  beforeAll(async () => {
    const mongoUri = `mongodb://${process.env.MONGO_ROOT_USERNAME}:${process.env.MONGO_ROOT_PASSWORD}@localhost:27017/${process.env.MONGO_DATABASE}?authSource=admin`;
    await DatabaseHelper.connectMongo(mongoUri);

    // Set up Express app
    app = express();
    app.use(express.json());
    app.use('/api/metrics', metricsRouter);
    
    // Error handler
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ 
        error: err.message || 'Internal server error' 
      });
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await DatabaseHelper.clearDatabase();
  });

  describe('GET /api/metrics/title/:titleNumber', () => {
    beforeEach(async () => {
      // Create metrics for different titles
      await Metric.insertMany([
        sampleMetrics.title,
        sampleMetrics.part,
        {
          ...sampleMetrics.title,
          titleNumber: 2,
          metrics: {
            ...sampleMetrics.title.metrics,
            totalSections: 25,
            totalWords: 5000
          }
        }
      ]);
    });

    it('should retrieve metrics for a specific title', async () => {
      const response = await request(app)
        .get('/api/metrics/title/1');

      expect(response.status).toBe(200);
      expect(response.body.titleNumber).toBe(1);
      expect(response.body.metrics).toBeDefined();
      expect(response.body.metrics.totalSections).toBe(15);
      expect(response.body.metrics.totalWords).toBe(2500);
    });

    it('should return 404 for non-existent title metrics', async () => {
      const response = await request(app)
        .get('/api/metrics/title/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Metrics not found');
    });

    it('should validate title number', async () => {
      const response = await request(app)
        .get('/api/metrics/title/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid title number');
    });

    it('should handle title numbers out of range', async () => {
      const response = await request(app)
        .get('/api/metrics/title/51');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('must be between');
    });
  });

  describe('GET /api/metrics/part/:titleNumber/:partNumber', () => {
    beforeEach(async () => {
      await Metric.insertMany([
        sampleMetrics.part,
        {
          ...sampleMetrics.part,
          identifier: 'part-2',
          metrics: {
            ...sampleMetrics.part.metrics,
            totalSections: 10
          }
        }
      ]);
    });

    it('should retrieve metrics for a specific part', async () => {
      const response = await request(app)
        .get('/api/metrics/part/1/1');

      expect(response.status).toBe(200);
      expect(response.body.titleNumber).toBe(1);
      expect(response.body.identifier).toBe('part-1');
      expect(response.body.metrics.totalSections).toBe(5);
    });

    it('should return 404 for non-existent part metrics', async () => {
      const response = await request(app)
        .get('/api/metrics/part/1/999');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/metrics/aggregate', () => {
    beforeEach(async () => {
      // Create metrics for multiple titles
      await Metric.insertMany([
        sampleMetrics.title,
        {
          ...sampleMetrics.title,
          titleNumber: 2,
          metrics: {
            totalSections: 20,
            totalWords: 3000,
            averageWordsPerSection: 150,
            complexityScore: 0.7,
            readabilityScore: 40
          }
        },
        {
          ...sampleMetrics.title,
          titleNumber: 3,
          metrics: {
            totalSections: 10,
            totalWords: 1000,
            averageWordsPerSection: 100,
            complexityScore: 0.5,
            readabilityScore: 55
          }
        }
      ]);
    });

    it('should return aggregate metrics across all titles', async () => {
      const response = await request(app)
        .get('/api/metrics/aggregate');

      expect(response.status).toBe(200);
      expect(response.body.totalTitles).toBe(3);
      expect(response.body.totalSections).toBe(45); // 15 + 20 + 10
      expect(response.body.totalWords).toBe(6500); // 2500 + 3000 + 1000
      expect(response.body.averageComplexityScore).toBeCloseTo(0.617, 2); // (0.65 + 0.7 + 0.5) / 3
      expect(response.body.averageReadabilityScore).toBeCloseTo(46.73, 1); // (45.2 + 40 + 55) / 3
    });

    it('should handle empty metrics collection', async () => {
      await Metric.deleteMany({});
      
      const response = await request(app)
        .get('/api/metrics/aggregate');

      expect(response.status).toBe(200);
      expect(response.body.totalTitles).toBe(0);
      expect(response.body.totalSections).toBe(0);
      expect(response.body.totalWords).toBe(0);
      expect(response.body.averageComplexityScore).toBe(0);
      expect(response.body.averageReadabilityScore).toBe(0);
    });
  });

  describe('GET /api/metrics/timeline/:titleNumber', () => {
    beforeEach(async () => {
      // Create metrics with different calculation dates
      const baseDate = new Date();
      const metricsData = [];
      
      for (let i = 0; i < 5; i++) {
        const calculatedAt = new Date(baseDate);
        calculatedAt.setDate(baseDate.getDate() - i * 7); // Weekly intervals
        
        metricsData.push({
          titleNumber: 1,
          type: 'title',
          identifier: null,
          metrics: {
            totalSections: 15 + i,
            totalWords: 2500 + (i * 100),
            averageWordsPerSection: 166.67,
            complexityScore: 0.65 + (i * 0.02),
            readabilityScore: 45.2 - (i * 0.5)
          },
          calculatedAt
        });
      }
      
      await Metric.insertMany(metricsData);
    });

    it('should return metrics timeline for a title', async () => {
      const response = await request(app)
        .get('/api/metrics/timeline/1');

      expect(response.status).toBe(200);
      expect(response.body.titleNumber).toBe(1);
      expect(response.body.timeline).toHaveLength(5);
      
      // Should be sorted by date ascending
      const dates = response.body.timeline.map(t => new Date(t.calculatedAt).getTime());
      expect(dates).toEqual([...dates].sort((a, b) => a - b));
      
      // Verify metrics change over time
      expect(response.body.timeline[0].metrics.totalSections).toBe(19); // Oldest
      expect(response.body.timeline[4].metrics.totalSections).toBe(15); // Newest
    });

    it('should limit timeline results', async () => {
      const response = await request(app)
        .get('/api/metrics/timeline/1')
        .query({ limit: 3 });

      expect(response.status).toBe(200);
      expect(response.body.timeline).toHaveLength(3);
    });

    it('should return empty timeline for non-existent title', async () => {
      const response = await request(app)
        .get('/api/metrics/timeline/999');

      expect(response.status).toBe(200);
      expect(response.body.timeline).toEqual([]);
    });
  });

  describe('GET /api/metrics/keywords/:titleNumber', () => {
    beforeEach(async () => {
      await Metric.create({
        titleNumber: 1,
        type: 'title',
        identifier: null,
        metrics: {
          totalSections: 15,
          totalWords: 2500,
          keywordFrequency: new Map([
            ['shall', 150],
            ['must', 120],
            ['required', 80],
            ['prohibited', 45],
            ['compliance', 30],
            ['violation', 25],
            ['penalty', 20],
            ['enforce', 15],
            ['regulate', 10],
            ['mandatory', 5]
          ])
        },
        calculatedAt: new Date()
      });
    });

    it('should return keyword frequency data', async () => {
      const response = await request(app)
        .get('/api/metrics/keywords/1');

      expect(response.status).toBe(200);
      expect(response.body.titleNumber).toBe(1);
      expect(response.body.keywords).toBeDefined();
      expect(response.body.keywords).toHaveLength(10);
      
      // Should be sorted by frequency descending
      expect(response.body.keywords[0]).toEqual({ keyword: 'shall', count: 150 });
      expect(response.body.keywords[1]).toEqual({ keyword: 'must', count: 120 });
      expect(response.body.keywords[9]).toEqual({ keyword: 'mandatory', count: 5 });
    });

    it('should limit keyword results', async () => {
      const response = await request(app)
        .get('/api/metrics/keywords/1')
        .query({ limit: 5 });

      expect(response.status).toBe(200);
      expect(response.body.keywords).toHaveLength(5);
    });

    it('should return empty keywords for title without metrics', async () => {
      const response = await request(app)
        .get('/api/metrics/keywords/999');

      expect(response.status).toBe(200);
      expect(response.body.keywords).toEqual([]);
    });
  });

  describe('GET /api/metrics/section-analysis/:titleNumber', () => {
    beforeEach(async () => {
      // Create documents and their analyses
      const docs = await Document.insertMany([
        TestDataBuilder.createDocument({ 
          titleNumber: 1,
          identifier: 'section-1.1',
          title: 'Antiquated Section'
        }),
        TestDataBuilder.createDocument({ 
          titleNumber: 1,
          identifier: 'section-1.2',
          title: 'Business Unfriendly Section'
        }),
        TestDataBuilder.createDocument({ 
          titleNumber: 1,
          identifier: 'section-1.3',
          title: 'Modern Section'
        })
      ]);

      await SectionAnalysis.insertMany([
        {
          documentId: docs[0]._id,
          titleNumber: 1,
          sectionIdentifier: 'section-1.1',
          analysis: { summary: 'Very old regulations' },
          scores: { 
            antiquatedScore: 85,
            businessUnfriendlyScore: 60
          },
          modelUsed: 'test',
          analysisVersion: 'v1'
        },
        {
          documentId: docs[1]._id,
          titleNumber: 1,
          sectionIdentifier: 'section-1.2',
          analysis: { summary: 'Complex business requirements' },
          scores: { 
            antiquatedScore: 50,
            businessUnfriendlyScore: 90
          },
          modelUsed: 'test',
          analysisVersion: 'v1'
        },
        {
          documentId: docs[2]._id,
          titleNumber: 1,
          sectionIdentifier: 'section-1.3',
          analysis: { summary: 'Modern streamlined regulations' },
          scores: { 
            antiquatedScore: 20,
            businessUnfriendlyScore: 15
          },
          modelUsed: 'test',
          analysisVersion: 'v1'
        }
      ]);
    });

    it('should return section analysis metrics', async () => {
      const response = await request(app)
        .get('/api/metrics/section-analysis/1');

      expect(response.status).toBe(200);
      expect(response.body.titleNumber).toBe(1);
      expect(response.body.mostAntiquated).toHaveLength(3);
      expect(response.body.mostBusinessUnfriendly).toHaveLength(3);
      expect(response.body.statistics).toBeDefined();
      
      // Check ordering
      expect(response.body.mostAntiquated[0].scores.antiquatedScore).toBe(85);
      expect(response.body.mostBusinessUnfriendly[0].scores.businessUnfriendlyScore).toBe(90);
      
      // Check statistics
      expect(response.body.statistics.totalAnalyzed).toBe(3);
      expect(response.body.statistics.averageAntiquatedScore).toBeCloseTo(51.67, 1);
      expect(response.body.statistics.averageBusinessUnfriendlyScore).toBeCloseTo(55, 1);
      expect(response.body.statistics.highPriorityCount).toBe(2); // Scores >= 70
    });

    it('should limit results', async () => {
      const response = await request(app)
        .get('/api/metrics/section-analysis/1')
        .query({ limit: 2 });

      expect(response.status).toBe(200);
      expect(response.body.mostAntiquated).toHaveLength(2);
      expect(response.body.mostBusinessUnfriendly).toHaveLength(2);
    });

    it('should filter by minimum score', async () => {
      const response = await request(app)
        .get('/api/metrics/section-analysis/1')
        .query({ minScore: 80 });

      expect(response.status).toBe(200);
      expect(response.body.mostAntiquated).toHaveLength(1);
      expect(response.body.mostBusinessUnfriendly).toHaveLength(1);
    });

    it('should handle title without analyses', async () => {
      const response = await request(app)
        .get('/api/metrics/section-analysis/999');

      expect(response.status).toBe(200);
      expect(response.body.mostAntiquated).toEqual([]);
      expect(response.body.mostBusinessUnfriendly).toEqual([]);
      expect(response.body.statistics.totalAnalyzed).toBe(0);
    });
  });
});