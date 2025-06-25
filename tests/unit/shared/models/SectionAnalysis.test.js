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
        analysis: {
          summary: 'Test summary',
          keyRequirements: ['Requirement 1'],
          complianceSteps: ['Step 1'],
          potentialIssues: ['Issue 1'],
          relatedSections: ['section-1.2']
        },
        scores: {
          antiquatedScore: 75,
          businessUnfriendlyScore: 60
        },
        modelUsed: 'gemini-2.0',
        analysisVersion: 'v1'
      });

      const saved = await analysis.save();
      expect(saved._id).toBeDefined();
      expect(saved.scores.antiquatedScore).toBe(75);
      expect(saved.scores.businessUnfriendlyScore).toBe(60);
    });

    it('should validate score ranges (1-100)', async () => {
      const doc = await Document.create(TestDataBuilder.createDocument());
      
      const analysis = new SectionAnalysis({
        documentId: doc._id,
        titleNumber: 1,
        sectionIdentifier: 'section-1.1',
        analysis: {
          summary: 'Test'
        },
        scores: {
          antiquatedScore: 101, // Invalid
          businessUnfriendlyScore: 0 // Invalid
        },
        modelUsed: 'test-model'
      });

      await expect(analysis.save()).rejects.toThrow(/validation/);
    });

    it('should enforce unique constraint on documentId + analysisVersion', async () => {
      const doc = await Document.create(TestDataBuilder.createDocument());
      
      const analysisData = {
        documentId: doc._id,
        titleNumber: 1,
        sectionIdentifier: 'section-1.1',
        analysis: { summary: 'Test' },
        modelUsed: 'test-model',
        analysisVersion: 'v1'
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
        analysis: { summary: 'Test' },
        modelUsed: 'test-model'
      };

      await SectionAnalysis.create({ ...baseData, analysisVersion: 'v1' });
      const v2 = await SectionAnalysis.create({ ...baseData, analysisVersion: 'v2' });
      
      expect(v2._id).toBeDefined();
      expect(v2.analysisVersion).toBe('v2');
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
          analysis: { summary: 'Old regulations' },
          scores: { antiquatedScore: 65 },
          modelUsed: 'test',
          analysisVersion: 'v1'
        },
        {
          documentId: docs[1]._id,
          titleNumber: 1,
          sectionIdentifier: 'section-1.2',
          analysis: { summary: 'Very old regulations' },
          scores: { antiquatedScore: 85 },
          modelUsed: 'test',
          analysisVersion: 'v1'
        },
        {
          documentId: docs[2]._id,
          titleNumber: 1,
          sectionIdentifier: 'section-1.3',
          analysis: { summary: 'Recent regulations' },
          scores: { antiquatedScore: 25 },
          modelUsed: 'test',
          analysisVersion: 'v1'
        },
        {
          documentId: docs[3]._id,
          titleNumber: 1,
          sectionIdentifier: 'section-1.4',
          analysis: { summary: 'Obsolete regulations' },
          scores: { antiquatedScore: 95 },
          modelUsed: 'test',
          analysisVersion: 'v1'
        }
      ]);
    });

    it('should return sections sorted by antiquated score descending', async () => {
      const results = await SectionAnalysis.getMostAntiquatedSections(1, 10);
      
      expect(results).toHaveLength(4);
      expect(results[0].scores.antiquatedScore).toBe(95);
      expect(results[1].scores.antiquatedScore).toBe(85);
      expect(results[2].scores.antiquatedScore).toBe(65);
      expect(results[3].scores.antiquatedScore).toBe(25);
    });

    it('should respect limit parameter', async () => {
      const results = await SectionAnalysis.getMostAntiquatedSections(1, 2);
      
      expect(results).toHaveLength(2);
      expect(results[0].scores.antiquatedScore).toBe(95);
      expect(results[1].scores.antiquatedScore).toBe(85);
    });

    it('should filter by minimum score', async () => {
      const results = await SectionAnalysis.getMostAntiquatedSections(1, 10, 70);
      
      expect(results).toHaveLength(2);
      expect(results[0].scores.antiquatedScore).toBe(95);
      expect(results[1].scores.antiquatedScore).toBe(85);
    });

    it('should populate document data', async () => {
      const results = await SectionAnalysis.getMostAntiquatedSections(1, 1);
      
      expect(results[0].documentId).toBeDefined();
      expect(results[0].documentId.title).toBe('Obsolete Section');
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
          analysis: { summary: 'Complex requirements' },
          scores: { businessUnfriendlyScore: 90 },
          modelUsed: 'test',
          analysisVersion: 'v1'
        },
        {
          documentId: docs[1]._id,
          titleNumber: 2,
          sectionIdentifier: 'section-2.2',
          analysis: { summary: 'Simple requirements' },
          scores: { businessUnfriendlyScore: 30 },
          modelUsed: 'test',
          analysisVersion: 'v1'
        }
      ]);
    });

    it('should return sections sorted by business unfriendly score', async () => {
      const results = await SectionAnalysis.getMostBusinessUnfriendlySections(2, 10);
      
      expect(results).toHaveLength(2);
      expect(results[0].scores.businessUnfriendlyScore).toBe(90);
      expect(results[1].scores.businessUnfriendlyScore).toBe(30);
    });

    it('should filter by minimum score', async () => {
      const results = await SectionAnalysis.getMostBusinessUnfriendlySections(2, 10, 50);
      
      expect(results).toHaveLength(1);
      expect(results[0].scores.businessUnfriendlyScore).toBe(90);
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
          analysis: { summary: 'Test' },
          scores: { 
            antiquatedScore: 80,
            businessUnfriendlyScore: 70
          },
          modelUsed: 'test',
          analysisVersion: 'v1'
        },
        {
          documentId: docs[1]._id,
          titleNumber: 3,
          sectionIdentifier: 'section-3.2',
          analysis: { summary: 'Test' },
          scores: { 
            antiquatedScore: 60,
            businessUnfriendlyScore: 90
          },
          modelUsed: 'test',
          analysisVersion: 'v1'
        },
        {
          documentId: docs[2]._id,
          titleNumber: 3,
          sectionIdentifier: 'section-3.3',
          analysis: { summary: 'Test' },
          scores: { 
            antiquatedScore: 40,
            businessUnfriendlyScore: 30
          },
          modelUsed: 'test',
          analysisVersion: 'v1'
        }
      ]);
    });

    it('should calculate correct statistics', async () => {
      const stats = await SectionAnalysis.getAnalysisStats(3);
      
      expect(stats.totalAnalyzed).toBe(3);
      expect(stats.averageAntiquatedScore).toBe(60); // (80+60+40)/3
      expect(stats.averageBusinessUnfriendlyScore).toBe(63.33);
      expect(stats.highPriorityCount).toBe(2); // Default threshold 70
    });

    it('should respect custom score threshold', async () => {
      const stats = await SectionAnalysis.getAnalysisStats(3, 80);
      
      expect(stats.highPriorityCount).toBe(1); // Only one section >= 80
    });

    it('should handle empty results', async () => {
      const stats = await SectionAnalysis.getAnalysisStats(999);
      
      expect(stats.totalAnalyzed).toBe(0);
      expect(stats.averageAntiquatedScore).toBe(0);
      expect(stats.averageBusinessUnfriendlyScore).toBe(0);
      expect(stats.highPriorityCount).toBe(0);
    });

    it('should only include latest analysis version', async () => {
      // Add a v2 analysis for one section
      const doc = await Document.findOne({ identifier: 'section-3.1' });
      await SectionAnalysis.create({
        documentId: doc._id,
        titleNumber: 3,
        sectionIdentifier: 'section-3.1',
        analysis: { summary: 'Updated' },
        scores: { 
          antiquatedScore: 20,
          businessUnfriendlyScore: 20
        },
        modelUsed: 'test',
        analysisVersion: 'v2'
      });

      const stats = await SectionAnalysis.getAnalysisStats(3);
      
      // Should still be 3 sections (not 4)
      expect(stats.totalAnalyzed).toBe(3);
      // Average should include the new v2 score for section 3.1
      expect(stats.averageAntiquatedScore).toBe(40); // (20+60+40)/3
    });
  });
});