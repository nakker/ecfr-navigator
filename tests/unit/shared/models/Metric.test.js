const Metric = require('../../../../services/shared/models/Metric');
const { setupTestDatabase, teardownTestDatabase } = require('../../../utils/testHelpers');

describe('Metric Model', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await Metric.deleteMany({});
  });

  describe('Validation', () => {
    it('should create a valid metric with minimal fields', async () => {
      const metric = new Metric({
        titleNumber: 5
      });

      const saved = await metric.save();
      expect(saved.titleNumber).toBe(5);
      expect(saved.analysisDate).toBeInstanceOf(Date);
      expect(saved.analysisDate.getTime()).toBeCloseTo(Date.now(), -2);
    });

    it('should require titleNumber field', async () => {
      const metric = new Metric({
        analysisDate: new Date()
      });

      await expect(metric.save()).rejects.toThrow(/titleNumber.*required/i);
    });

    it('should use provided analysisDate', async () => {
      const customDate = new Date('2024-01-15');
      const metric = new Metric({
        titleNumber: 10,
        analysisDate: customDate
      });

      const saved = await metric.save();
      expect(saved.analysisDate).toEqual(customDate);
    });

    it('should default analysisDate to now if not provided', async () => {
      const beforeSave = Date.now();
      const metric = new Metric({
        titleNumber: 15
      });

      const saved = await metric.save();
      const afterSave = Date.now();
      
      expect(saved.analysisDate.getTime()).toBeGreaterThanOrEqual(beforeSave);
      expect(saved.analysisDate.getTime()).toBeLessThanOrEqual(afterSave);
    });
  });

  describe('Metrics Object', () => {
    it('should save basic metrics', async () => {
      const metric = new Metric({
        titleNumber: 20,
        metrics: {
          wordCount: 50000,
          complexityScore: 85.5,
          averageSentenceLength: 22.3,
          readabilityScore: 45.8
        }
      });

      const saved = await metric.save();
      expect(saved.metrics.wordCount).toBe(50000);
      expect(saved.metrics.complexityScore).toBe(85.5);
      expect(saved.metrics.averageSentenceLength).toBe(22.3);
      expect(saved.metrics.readabilityScore).toBe(45.8);
    });

    it('should save age distribution metrics', async () => {
      const ageDistribution = {
        lessThan1Year: 10,
        oneToFiveYears: 25,
        fiveToTenYears: 30,
        tenToTwentyYears: 20,
        moreThanTwentyYears: 15
      };

      const metric = new Metric({
        titleNumber: 25,
        metrics: {
          regulationAgeDistribution: ageDistribution
        }
      });

      const saved = await metric.save();
      expect(saved.metrics.regulationAgeDistribution).toEqual(ageDistribution);
    });

    it('should save keyword frequency as Map', async () => {
      const keywords = new Map([
        ['regulation', 150],
        ['compliance', 75],
        ['requirement', 200],
        ['shall', 500],
        ['must', 300]
      ]);

      const metric = new Metric({
        titleNumber: 30,
        metrics: {
          keywordFrequency: keywords
        }
      });

      const saved = await metric.save();
      expect(saved.metrics.keywordFrequency).toBeInstanceOf(Map);
      expect(saved.metrics.keywordFrequency.get('regulation')).toBe(150);
      expect(saved.metrics.keywordFrequency.get('compliance')).toBe(75);
      expect(saved.metrics.keywordFrequency.get('requirement')).toBe(200);
      expect(saved.metrics.keywordFrequency.get('shall')).toBe(500);
      expect(saved.metrics.keywordFrequency.get('must')).toBe(300);
    });

    it('should save partial metrics', async () => {
      const metric = new Metric({
        titleNumber: 35,
        metrics: {
          wordCount: 25000,
          complexityScore: 70
          // Other metrics fields omitted
        }
      });

      const saved = await metric.save();
      expect(saved.metrics.wordCount).toBe(25000);
      expect(saved.metrics.complexityScore).toBe(70);
      expect(saved.metrics.averageSentenceLength).toBeUndefined();
      expect(saved.metrics.readabilityScore).toBeUndefined();
      expect(saved.metrics.regulationAgeDistribution).toBeUndefined();
    });

    it('should handle empty metrics object', async () => {
      const metric = new Metric({
        titleNumber: 40,
        metrics: {}
      });

      const saved = await metric.save();
      expect(saved.metrics).toBeDefined();
      expect(Object.keys(saved.metrics.toObject())).toHaveLength(0);
    });
  });

  describe('Timestamps', () => {
    it('should add createdAt and updatedAt timestamps', async () => {
      const metric = new Metric({
        titleNumber: 45
      });

      const saved = await metric.save();
      expect(saved.createdAt).toBeInstanceOf(Date);
      expect(saved.updatedAt).toBeInstanceOf(Date);
      expect(saved.createdAt).toEqual(saved.updatedAt);
    });

    it('should update updatedAt on modification', async () => {
      const metric = new Metric({
        titleNumber: 50,
        metrics: {
          wordCount: 10000
        }
      });

      const saved = await metric.save();
      const originalUpdatedAt = saved.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      saved.metrics.wordCount = 15000;
      await saved.save();

      expect(saved.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Indexes', () => {
    it('should have compound index on titleNumber and analysisDate', async () => {
      const indexes = await Metric.collection.getIndexes();
      const compoundIndex = indexes.titleNumber_1_analysisDate_-1;
      expect(compoundIndex).toBeDefined();
    });
  });

  describe('Querying', () => {
    beforeEach(async () => {
      // Create test data
      const dates = [
        new Date('2024-01-01'),
        new Date('2024-01-15'),
        new Date('2024-02-01')
      ];

      for (const date of dates) {
        await new Metric({
          titleNumber: 5,
          analysisDate: date,
          metrics: {
            wordCount: Math.floor(Math.random() * 10000) + 10000
          }
        }).save();
      }

      // Different title
      await new Metric({
        titleNumber: 10,
        analysisDate: dates[0],
        metrics: {
          wordCount: 5000
        }
      }).save();
    });

    it('should find metrics by titleNumber', async () => {
      const metrics = await Metric.find({ titleNumber: 5 });
      expect(metrics).toHaveLength(3);
      metrics.forEach(m => expect(m.titleNumber).toBe(5));
    });

    it('should find latest metric for a title', async () => {
      const latest = await Metric.findOne({ titleNumber: 5 })
        .sort({ analysisDate: -1 });
      
      expect(latest.analysisDate).toEqual(new Date('2024-02-01'));
    });

    it('should find metrics within date range', async () => {
      const metrics = await Metric.find({
        titleNumber: 5,
        analysisDate: {
          $gte: new Date('2024-01-10'),
          $lte: new Date('2024-01-20')
        }
      });

      expect(metrics).toHaveLength(1);
      expect(metrics[0].analysisDate).toEqual(new Date('2024-01-15'));
    });
  });
});