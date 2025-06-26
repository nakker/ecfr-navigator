const IndexRebuildProgress = require('../../../../services/shared/models/IndexRebuildProgress');
const { setupTestDatabase, teardownTestDatabase } = require('../../../utils/testHelpers');

describe('IndexRebuildProgress Model', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await IndexRebuildProgress.deleteMany({});
  });

  describe('Validation', () => {
    it('should create a valid index rebuild progress with defaults', async () => {
      const progress = new IndexRebuildProgress({});

      const saved = await progress.save();
      expect(saved.status).toBe('pending');
      expect(saved.totalDocuments).toBe(0);
      expect(saved.processedDocuments).toBe(0);
      expect(saved.indexedDocuments).toBe(0);
      expect(saved.failedDocuments).toBe(0);
      expect(saved.triggeredBy).toBe('manual');
    });

    it('should accept all valid status values', async () => {
      const statuses = ['pending', 'in_progress', 'completed', 'failed', 'cancelled'];
      
      for (const status of statuses) {
        const progress = new IndexRebuildProgress({ status });
        const saved = await progress.save();
        expect(saved.status).toBe(status);
      }
    });

    it('should reject invalid status values', async () => {
      const progress = new IndexRebuildProgress({
        status: 'paused'
      });

      await expect(progress.save()).rejects.toThrow(/is not a valid enum value/i);
    });

    it('should save custom triggeredBy value', async () => {
      const progress = new IndexRebuildProgress({
        triggeredBy: 'scheduled_maintenance'
      });

      const saved = await progress.save();
      expect(saved.triggeredBy).toBe('scheduled_maintenance');
    });
  });

  describe('Progress Tracking', () => {
    it('should save timing information', async () => {
      const startTime = new Date('2024-01-15T10:00:00Z');
      const endTime = new Date('2024-01-15T11:30:00Z');

      const progress = new IndexRebuildProgress({
        status: 'completed',
        startTime,
        endTime
      });

      const saved = await progress.save();
      expect(saved.startTime).toEqual(startTime);
      expect(saved.endTime).toEqual(endTime);
    });

    it('should track document processing counts', async () => {
      const progress = new IndexRebuildProgress({
        status: 'in_progress',
        totalDocuments: 10000,
        processedDocuments: 7500,
        indexedDocuments: 7400,
        failedDocuments: 100
      });

      const saved = await progress.save();
      expect(saved.totalDocuments).toBe(10000);
      expect(saved.processedDocuments).toBe(7500);
      expect(saved.indexedDocuments).toBe(7400);
      expect(saved.failedDocuments).toBe(100);
    });

    it('should save current title being processed', async () => {
      const progress = new IndexRebuildProgress({
        status: 'in_progress',
        currentTitle: {
          number: 26,
          name: 'Title 26 - Internal Revenue'
        }
      });

      const saved = await progress.save();
      expect(saved.currentTitle.number).toBe(26);
      expect(saved.currentTitle.name).toBe('Title 26 - Internal Revenue');
    });

    it('should save error information', async () => {
      const progress = new IndexRebuildProgress({
        status: 'failed',
        error: 'Elasticsearch cluster is unavailable'
      });

      const saved = await progress.save();
      expect(saved.error).toBe('Elasticsearch cluster is unavailable');
    });
  });

  describe('Operations Tracking', () => {
    it('should track individual operation statuses', async () => {
      const progress = new IndexRebuildProgress({
        status: 'in_progress',
        operations: {
          deleteIndex: { completed: true },
          createIndex: { completed: true },
          indexDocuments: { completed: false }
        }
      });

      const saved = await progress.save();
      expect(saved.operations.deleteIndex.completed).toBe(true);
      expect(saved.operations.createIndex.completed).toBe(true);
      expect(saved.operations.indexDocuments.completed).toBe(false);
    });

    it('should track operation errors', async () => {
      const progress = new IndexRebuildProgress({
        status: 'failed',
        operations: {
          deleteIndex: { completed: true },
          createIndex: { 
            completed: false, 
            error: 'Index already exists with incompatible settings' 
          },
          indexDocuments: { completed: false }
        }
      });

      const saved = await progress.save();
      expect(saved.operations.createIndex.completed).toBe(false);
      expect(saved.operations.createIndex.error).toBe('Index already exists with incompatible settings');
    });

    it('should handle partial operations data', async () => {
      const progress = new IndexRebuildProgress({
        operations: {
          deleteIndex: { completed: true }
          // Other operations not specified
        }
      });

      const saved = await progress.save();
      expect(saved.operations.deleteIndex.completed).toBe(true);
      expect(saved.operations.createIndex).toBeUndefined();
      expect(saved.operations.indexDocuments).toBeUndefined();
    });

    it('should save all operations as successful', async () => {
      const progress = new IndexRebuildProgress({
        status: 'completed',
        operations: {
          deleteIndex: { completed: true },
          createIndex: { completed: true },
          indexDocuments: { completed: true }
        }
      });

      const saved = await progress.save();
      expect(saved.operations.deleteIndex.completed).toBe(true);
      expect(saved.operations.createIndex.completed).toBe(true);
      expect(saved.operations.indexDocuments.completed).toBe(true);
    });
  });

  describe('Timestamps', () => {
    it('should add createdAt and updatedAt timestamps', async () => {
      const progress = new IndexRebuildProgress({});

      const saved = await progress.save();
      expect(saved.createdAt).toBeInstanceOf(Date);
      expect(saved.updatedAt).toBeInstanceOf(Date);
      expect(saved.createdAt).toEqual(saved.updatedAt);
    });

    it('should update updatedAt on modification', async () => {
      const progress = new IndexRebuildProgress({
        status: 'pending'
      });

      const saved = await progress.save();
      const originalUpdatedAt = saved.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      saved.status = 'in_progress';
      saved.startTime = new Date();
      await saved.save();

      expect(saved.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Progress Calculations', () => {
    it('should calculate progress percentage', async () => {
      const progress = new IndexRebuildProgress({
        totalDocuments: 1000,
        processedDocuments: 750
      });

      const saved = await progress.save();
      const percentage = (saved.processedDocuments / saved.totalDocuments) * 100;
      expect(percentage).toBe(75);
    });

    it('should handle zero total documents', async () => {
      const progress = new IndexRebuildProgress({
        totalDocuments: 0,
        processedDocuments: 0
      });

      const saved = await progress.save();
      // Should not throw when calculating percentage
      const percentage = saved.totalDocuments > 0 
        ? (saved.processedDocuments / saved.totalDocuments) * 100 
        : 0;
      expect(percentage).toBe(0);
    });

    it('should track success rate', async () => {
      const progress = new IndexRebuildProgress({
        processedDocuments: 1000,
        indexedDocuments: 950,
        failedDocuments: 50
      });

      const saved = await progress.save();
      const successRate = (saved.indexedDocuments / saved.processedDocuments) * 100;
      expect(successRate).toBe(95);
    });
  });

  describe('Querying', () => {
    beforeEach(async () => {
      // Create test data
      const baseDate = new Date('2024-01-15');
      await IndexRebuildProgress.create([
        {
          status: 'completed',
          startTime: new Date(baseDate.getTime() - 7200000), // 2 hours ago
          endTime: new Date(baseDate.getTime() - 3600000), // 1 hour ago
          totalDocuments: 5000,
          indexedDocuments: 5000,
          triggeredBy: 'scheduled'
        },
        {
          status: 'in_progress',
          startTime: baseDate,
          totalDocuments: 10000,
          processedDocuments: 3000,
          triggeredBy: 'manual'
        },
        {
          status: 'failed',
          startTime: new Date(baseDate.getTime() - 86400000), // 1 day ago
          error: 'Network failure',
          triggeredBy: 'manual'
        },
        {
          status: 'cancelled',
          startTime: new Date(baseDate.getTime() - 172800000), // 2 days ago
          triggeredBy: 'manual'
        }
      ]);
    });

    it('should find rebuild by status', async () => {
      const inProgress = await IndexRebuildProgress.find({ status: 'in_progress' });
      expect(inProgress).toHaveLength(1);
      expect(inProgress[0].processedDocuments).toBe(3000);

      const failed = await IndexRebuildProgress.find({ status: 'failed' });
      expect(failed).toHaveLength(1);
      expect(failed[0].error).toBe('Network failure');
    });

    it('should find most recent rebuild', async () => {
      const latest = await IndexRebuildProgress.findOne({})
        .sort({ createdAt: -1 });
      
      expect(latest.status).toBe('in_progress');
    });

    it('should find successful rebuilds', async () => {
      const successful = await IndexRebuildProgress.find({ 
        status: 'completed',
        failedDocuments: { $lte: 0 }
      });

      expect(successful).toHaveLength(1);
      expect(successful[0].indexedDocuments).toBe(5000);
    });

    it('should find rebuilds by trigger type', async () => {
      const scheduled = await IndexRebuildProgress.find({ 
        triggeredBy: 'scheduled' 
      });
      
      expect(scheduled).toHaveLength(1);
      expect(scheduled[0].status).toBe('completed');

      const manual = await IndexRebuildProgress.find({ 
        triggeredBy: 'manual' 
      });
      
      expect(manual).toHaveLength(3);
    });

    it('should calculate average rebuild duration', async () => {
      const completed = await IndexRebuildProgress.find({
        status: 'completed',
        startTime: { $exists: true },
        endTime: { $exists: true }
      });

      const durations = completed.map(p => 
        p.endTime.getTime() - p.startTime.getTime()
      );
      
      expect(durations).toHaveLength(1);
      expect(durations[0]).toBe(3600000); // 1 hour in milliseconds
    });

    it('should find active or recent rebuilds', async () => {
      const cutoffDate = new Date(Date.now() - 86400000); // 24 hours ago
      
      const recent = await IndexRebuildProgress.find({
        $or: [
          { status: 'in_progress' },
          { createdAt: { $gte: cutoffDate } }
        ]
      }).sort({ createdAt: -1 });

      expect(recent.length).toBeGreaterThanOrEqual(2);
      expect(recent[0].status).toBe('in_progress');
    });
  });
});