const mongoose = require('mongoose');
const SectionAnalysis = require('../../../../services/shared/models/SectionAnalysis');
const Document = require('../../../../services/shared/models/Document');
const { DatabaseHelper, TestDataBuilder } = require('../../../utils/testHelpers');

describe('SectionAnalysis Model', () => {
  beforeAll(async () => {
    await DatabaseHelper.connectMongo(process.env.MONGODB_URI);
  });

  afterEach(async () => {
    await DatabaseHelper.clearDatabase();
  });

  describe('Schema Validation', () => {
    it('should create a valid section analysis', async () => {
      const doc = await Document.create(TestDataBuilder.createDocument());
      
      const analysis = new SectionAnalysis({
        documentId: doc._id,
        titleNumber: 1,
        sectionIdentifier: 'section-1.1',
        summary: 'Test summary of the section',
        antiquatedScore: 75,
        antiquatedExplanation: 'This section uses outdated terminology and references obsolete practices',
        businessUnfriendlyScore: 60,
        businessUnfriendlyExplanation: 'Complex compliance requirements that burden small businesses',
        analysisVersion: '1.0',
        metadata: {
          model: 'grok-3-mini',
          temperature: 0.3
        }
      });

      const saved = await analysis.save();
      expect(saved._id).toBeDefined();
      expect(saved.antiquatedScore).toBe(75);
      expect(saved.businessUnfriendlyScore).toBe(60);
      expect(saved.summary).toBe('Test summary of the section');
      expect(saved.antiquatedExplanation).toBeDefined();
      expect(saved.businessUnfriendlyExplanation).toBeDefined();
    });

    it('should validate score ranges (1-100)', async () => {
      const doc = await Document.create(TestDataBuilder.createDocument());
      
      const analysis = new SectionAnalysis({
        documentId: doc._id,
        titleNumber: 1,
        sectionIdentifier: 'section-1.1',
        summary: 'Test summary',
        antiquatedScore: 101, // Invalid
        antiquatedExplanation: 'Test explanation',
        businessUnfriendlyScore: 0, // Invalid
        businessUnfriendlyExplanation: 'Test explanation'
      });

      await expect(analysis.save()).rejects.toThrow(/validation/);
    });

    it('should enforce unique constraint on documentId + analysisVersion', async () => {
      const doc = await Document.create(TestDataBuilder.createDocument());
      
      const analysisData = {
        documentId: doc._id,
        titleNumber: 1,
        sectionIdentifier: 'section-1.1',
        summary: 'Test summary',
        antiquatedScore: 50,
        antiquatedExplanation: 'Test explanation',
        businessUnfriendlyScore: 50,
        businessUnfriendlyExplanation: 'Test explanation',
        analysisVersion: '1.0'
      };

      await SectionAnalysis.create(analysisData);
      
      // Try to create duplicate
      await expect(SectionAnalysis.create(analysisData))
        .rejects.toThrow(/duplicate key/);
    });

    it('should allow same document with different analysis version', async () => {
      const doc = await Document.create(TestDataBuilder.createDocument());
      
      const baseData = {
        documentId: doc._id,
        titleNumber: 1,
        sectionIdentifier: 'section-1.1',
        summary: 'Test summary',
        antiquatedScore: 50,
        antiquatedExplanation: 'Test explanation',
        businessUnfriendlyScore: 50,
        businessUnfriendlyExplanation: 'Test explanation'
      };

      await SectionAnalysis.create({ ...baseData, analysisVersion: '1.0' });
      const v2 = await SectionAnalysis.create({ ...baseData, analysisVersion: '2.0' });
      
      expect(v2._id).toBeDefined();
      expect(v2.analysisVersion).toBe('2.0');
    });
  });

  describe('getMostAntiquatedSections', () => {
    beforeEach(async () => {
      // Create test documents
      const docs = await Document.insertMany([
        TestDataBuilder.createDocument({ identifier: 'section-1.1', title: 'Old Section' }),
        TestDataBuilder.createDocument({ identifier: 'section-1.2', title: 'Ancient Section' }),
        TestDataBuilder.createDocument({ identifier: 'section-1.3', title: 'Modern Section' }),
        TestDataBuilder.createDocument({ identifier: 'section-1.4', title: 'Obsolete Section' })
      ]);

      // Create analyses with different scores
      await SectionAnalysis.insertMany([
        {
          documentId: docs[0]._id,
          titleNumber: 1,
          sectionIdentifier: 'section-1.1',
          summary: 'Old regulations from decades ago',
          antiquatedScore: 65,
          antiquatedExplanation: 'Uses outdated terminology',
          businessUnfriendlyScore: 45,
          businessUnfriendlyExplanation: 'Moderate compliance burden',
          analysisVersion: '1.0'
        },
        {
          documentId: docs[1]._id,
          titleNumber: 1,
          sectionIdentifier: 'section-1.2',
          summary: 'Very old regulations with obsolete requirements',
          antiquatedScore: 85,
          antiquatedExplanation: 'References obsolete technologies and practices',
          businessUnfriendlyScore: 70,
          businessUnfriendlyExplanation: 'High compliance costs',
          analysisVersion: '1.0'
        },
        {
          documentId: docs[2]._id,
          titleNumber: 1,
          sectionIdentifier: 'section-1.3',
          summary: 'Recent regulations with modern approach',
          antiquatedScore: 25,
          antiquatedExplanation: 'Modern and up-to-date',
          businessUnfriendlyScore: 20,
          businessUnfriendlyExplanation: 'Minimal burden',
          analysisVersion: '1.0'
        },
        {
          documentId: docs[3]._id,
          titleNumber: 1,
          sectionIdentifier: 'section-1.4',
          summary: 'Obsolete regulations needing complete overhaul',
          antiquatedScore: 95,
          antiquatedExplanation: 'Completely outdated and irrelevant',
          businessUnfriendlyScore: 90,
          businessUnfriendlyExplanation: 'Extreme burden on businesses',
          analysisVersion: '1.0'
        }
      ]);
    });

    it('should return sections sorted by antiquated score descending', async () => {
      const results = await SectionAnalysis.getMostAntiquatedSections(1, 10, 1);
      
      expect(results).toHaveLength(4);
      expect(results[0].antiquatedScore).toBe(95);
      expect(results[1].antiquatedScore).toBe(85);
      expect(results[2].antiquatedScore).toBe(65);
      expect(results[3].antiquatedScore).toBe(25);
    });

    it('should respect limit parameter', async () => {
      const results = await SectionAnalysis.getMostAntiquatedSections(1, 2, 1);
      
      expect(results).toHaveLength(2);
      expect(results[0].antiquatedScore).toBe(95);
      expect(results[1].antiquatedScore).toBe(85);
    });

    it('should filter by minimum score', async () => {
      const results = await SectionAnalysis.getMostAntiquatedSections(1, 10, 70);
      
      expect(results).toHaveLength(2);
      expect(results[0].antiquatedScore).toBe(95);
      expect(results[1].antiquatedScore).toBe(85);
    });

    it('should populate document data', async () => {
      const results = await SectionAnalysis.getMostAntiquatedSections(1, 1, 1);
      
      expect(results[0].documentId).toBeDefined();
      expect(results[0].documentId.identifier).toBe('section-1.4');
    });

    it('should return empty array for non-existent title', async () => {
      const results = await SectionAnalysis.getMostAntiquatedSections(999, 10);
      expect(results).toEqual([]);
    });
  });

  describe('getMostBusinessUnfriendlySections', () => {
    beforeEach(async () => {
      const docs = await Document.insertMany([
        TestDataBuilder.createDocument({ identifier: 'section-2.1' }),
        TestDataBuilder.createDocument({ identifier: 'section-2.2' })
      ]);

      await SectionAnalysis.insertMany([
        {
          documentId: docs[0]._id,
          titleNumber: 2,
          sectionIdentifier: 'section-2.1',
          summary: 'Complex requirements with heavy paperwork',
          antiquatedScore: 60,
          antiquatedExplanation: 'Somewhat outdated',
          businessUnfriendlyScore: 90,
          businessUnfriendlyExplanation: 'Extremely burdensome for small businesses',
          analysisVersion: '1.0'
        },
        {
          documentId: docs[1]._id,
          titleNumber: 2,
          sectionIdentifier: 'section-2.2',
          summary: 'Simple requirements that are easy to follow',
          antiquatedScore: 30,
          antiquatedExplanation: 'Relatively modern',
          businessUnfriendlyScore: 30,
          businessUnfriendlyExplanation: 'Minimal burden',
          analysisVersion: '1.0'
        }
      ]);
    });

    it('should return sections sorted by business unfriendly score', async () => {
      const results = await SectionAnalysis.getMostBusinessUnfriendlySections(2, 10, 1);
      
      expect(results).toHaveLength(2);
      expect(results[0].businessUnfriendlyScore).toBe(90);
      expect(results[1].businessUnfriendlyScore).toBe(30);
    });

    it('should filter by minimum score', async () => {
      const results = await SectionAnalysis.getMostBusinessUnfriendlySections(2, 10, 50);
      
      expect(results).toHaveLength(1);
      expect(results[0].businessUnfriendlyScore).toBe(90);
    });
  });

  describe('getAnalysisStats', () => {
    beforeEach(async () => {
      const docs = await Document.insertMany([
        TestDataBuilder.createDocument({ identifier: 'section-3.1' }),
        TestDataBuilder.createDocument({ identifier: 'section-3.2' }),
        TestDataBuilder.createDocument({ identifier: 'section-3.3' })
      ]);

      await SectionAnalysis.insertMany([
        {
          documentId: docs[0]._id,
          titleNumber: 3,
          sectionIdentifier: 'section-3.1',
          summary: 'High scoring section for both metrics',
          antiquatedScore: 80,
          antiquatedExplanation: 'Very outdated',
          businessUnfriendlyScore: 70,
          businessUnfriendlyExplanation: 'High burden',
          analysisVersion: '1.0'
        },
        {
          documentId: docs[1]._id,
          titleNumber: 3,
          sectionIdentifier: 'section-3.2',
          summary: 'Mixed scoring section',
          antiquatedScore: 60,
          antiquatedExplanation: 'Moderately outdated',
          businessUnfriendlyScore: 90,
          businessUnfriendlyExplanation: 'Extremely burdensome',
          analysisVersion: '1.0'
        },
        {
          documentId: docs[2]._id,
          titleNumber: 3,
          sectionIdentifier: 'section-3.3',
          summary: 'Low scoring section',
          antiquatedScore: 40,
          antiquatedExplanation: 'Relatively modern',
          businessUnfriendlyScore: 30,
          businessUnfriendlyExplanation: 'Low burden',
          analysisVersion: '1.0'
        }
      ]);
    });

    it('should calculate correct statistics', async () => {
      const stats = await SectionAnalysis.getAnalysisStats(3, 50);
      
      expect(stats.totalAnalyzed).toBe(3);
      expect(stats.avgAntiquatedScore).toBe(60); // (80+60+40)/3
      expect(stats.avgBusinessUnfriendlyScore).toBeCloseTo(63.33, 1);
      expect(stats.antiquatedCount).toBe(2); // Scores >= 50
      expect(stats.businessUnfriendlyCount).toBe(2); // Scores >= 50
    });

    it('should respect custom score threshold', async () => {
      const stats = await SectionAnalysis.getAnalysisStats(3, 80);
      
      expect(stats.antiquatedCount).toBe(1); // Only one section >= 80
      expect(stats.businessUnfriendlyCount).toBe(1); // Only one section >= 80
    });

    it('should handle empty results', async () => {
      const stats = await SectionAnalysis.getAnalysisStats(999);
      
      expect(stats.totalAnalyzed).toBe(0);
      expect(stats.avgAntiquatedScore).toBe(0);
      expect(stats.avgBusinessUnfriendlyScore).toBe(0);
      expect(stats.antiquatedCount).toBe(0);
      expect(stats.businessUnfriendlyCount).toBe(0);
    });

    it('should include all analysis versions in stats', async () => {
      // Add a v2 analysis for one section
      const doc = await Document.findOne({ identifier: 'section-3.1' });
      await SectionAnalysis.create({
        documentId: doc._id,
        titleNumber: 3,
        sectionIdentifier: 'section-3.1',
        summary: 'Updated analysis',
        antiquatedScore: 20,
        antiquatedExplanation: 'Much improved',
        businessUnfriendlyScore: 20,
        businessUnfriendlyExplanation: 'Simplified',
        analysisVersion: '2.0'
      });

      const stats = await SectionAnalysis.getAnalysisStats(3);
      
      // Stats include all analysis records
      expect(stats.totalAnalyzed).toBe(4);
      expect(stats.avgAntiquatedScore).toBe(50); // (80+60+40+20)/4
    });
  });
});