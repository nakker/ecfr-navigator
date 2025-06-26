const AnalysisThread = require('../../../../services/shared/models/AnalysisThread');
const { setupTestDatabase, teardownTestDatabase } = require('../../../utils/testHelpers');

describe('AnalysisThread Model', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await AnalysisThread.deleteMany({});
  });

  describe('Validation', () => {
    it('should create a valid analysis thread', async () => {
      const thread = new AnalysisThread({
        threadType: 'text_metrics'
      });

      const saved = await thread.save();
      expect(saved.threadType).toBe('text_metrics');
      expect(saved.status).toBe('stopped');
      expect(saved.progress.current).toBe(0);
      expect(saved.progress.total).toBe(0);
      expect(saved.progress.percentage).toBe(0);
      expect(saved.totalRunTime).toBe(0);
      expect(saved.statistics.itemsProcessed).toBe(0);
      expect(saved.statistics.itemsFailed).toBe(0);
      expect(saved.statistics.averageTimePerItem).toBe(0);
    });

    it('should require threadType field', async () => {
      const thread = new AnalysisThread({
        status: 'running'
      });

      await expect(thread.save()).rejects.toThrow(/threadType.*required/i);
    });

    it('should accept all valid threadType values', async () => {
      const threadTypes = ['text_metrics', 'age_distribution', 'version_history', 'section_analysis'];
      
      for (const threadType of threadTypes) {
        await AnalysisThread.deleteMany({}); // Clear to avoid unique constraint
        const thread = new AnalysisThread({ threadType });
        const saved = await thread.save();
        expect(saved.threadType).toBe(threadType);
      }
    });

    it('should reject invalid threadType values', async () => {
      const thread = new AnalysisThread({
        threadType: 'invalid_thread_type'
      });

      await expect(thread.save()).rejects.toThrow(/is not a valid enum value/i);
    });

    it('should enforce unique threadType constraint', async () => {
      const thread1 = new AnalysisThread({
        threadType: 'text_metrics'
      });
      await thread1.save();

      const thread2 = new AnalysisThread({
        threadType: 'text_metrics'
      });

      await expect(thread2.save()).rejects.toThrow(/duplicate key.*threadType/i);
    });

    it('should accept all valid status values', async () => {
      const statuses = ['stopped', 'running', 'completed', 'failed'];
      
      for (const status of statuses) {
        const thread = new AnalysisThread({ 
          threadType: 'age_distribution',
          status 
        });
        const saved = await thread.save();
        expect(saved.status).toBe(status);
      }
    });

    it('should reject invalid status values', async () => {
      const thread = new AnalysisThread({
        threadType: 'version_history',
        status: 'paused'
      });

      await expect(thread.save()).rejects.toThrow(/is not a valid enum value/i);
    });
  });

  describe('Progress Tracking', () => {
    it('should save progress information', async () => {
      const thread = new AnalysisThread({
        threadType: 'section_analysis',
        status: 'running',
        progress: {
          current: 25,
          total: 50,
          percentage: 50
        }
      });

      const saved = await thread.save();
      expect(saved.progress.current).toBe(25);
      expect(saved.progress.total).toBe(50);
      expect(saved.progress.percentage).toBe(50);
    });

    it('should save current item being processed', async () => {
      const thread = new AnalysisThread({
        threadType: 'text_metrics',
        status: 'running',
        currentItem: {
          titleNumber: 15,
          titleName: 'Title 15 - Commerce and Foreign Trade',
          description: 'Analyzing text complexity metrics'
        }
      });

      const saved = await thread.save();
      expect(saved.currentItem.titleNumber).toBe(15);
      expect(saved.currentItem.titleName).toBe('Title 15 - Commerce and Foreign Trade');
      expect(saved.currentItem.description).toBe('Analyzing text complexity metrics');
    });

    it('should track timing information', async () => {
      const startTime = new Date('2024-01-15T10:00:00Z');
      const stopTime = new Date('2024-01-15T12:30:00Z');
      const completedTime = new Date('2024-01-15T12:30:00Z');

      const thread = new AnalysisThread({
        threadType: 'age_distribution',
        status: 'completed',
        lastStartTime: startTime,
        lastStopTime: stopTime,
        lastCompletedTime: completedTime,
        totalRunTime: 9000000 // 2.5 hours in ms
      });

      const saved = await thread.save();
      expect(saved.lastStartTime).toEqual(startTime);
      expect(saved.lastStopTime).toEqual(stopTime);
      expect(saved.lastCompletedTime).toEqual(completedTime);
      expect(saved.totalRunTime).toBe(9000000);
    });

    it('should save error information', async () => {
      const thread = new AnalysisThread({
        threadType: 'version_history',
        status: 'failed',
        error: 'API rate limit exceeded while fetching version history'
      });

      const saved = await thread.save();
      expect(saved.error).toBe('API rate limit exceeded while fetching version history');
    });
  });

  describe('Resume Data', () => {
    it('should save simple resume data', async () => {
      const thread = new AnalysisThread({
        threadType: 'text_metrics',
        resumeData: {
          lastProcessedTitleNumber: 25,
          lastProcessedPartId: 'part-100'
        }
      });

      const saved = await thread.save();
      expect(saved.resumeData.lastProcessedTitleNumber).toBe(25);
      expect(saved.resumeData.lastProcessedPartId).toBe('part-100');
    });

    it('should save complex resume data', async () => {
      const thread = new AnalysisThread({
        threadType: 'section_analysis',
        resumeData: {
          processedTitles: [1, 5, 10, 15],
          pendingTitles: [20, 25, 30],
          checkpoint: {
            titleNumber: 15,
            sectionIndex: 42,
            timestamp: new Date('2024-01-15T11:45:00Z')
          }
        }
      });

      const saved = await thread.save();
      expect(saved.resumeData.processedTitles).toEqual([1, 5, 10, 15]);
      expect(saved.resumeData.pendingTitles).toEqual([20, 25, 30]);
      expect(saved.resumeData.checkpoint.sectionIndex).toBe(42);
    });
  });

  describe('Statistics', () => {
    it('should track processing statistics', async () => {
      const thread = new AnalysisThread({
        threadType: 'age_distribution',
        statistics: {
          itemsProcessed: 150,
          itemsFailed: 5,
          averageTimePerItem: 2500 // 2.5 seconds
        }
      });

      const saved = await thread.save();
      expect(saved.statistics.itemsProcessed).toBe(150);
      expect(saved.statistics.itemsFailed).toBe(5);
      expect(saved.statistics.averageTimePerItem).toBe(2500);
    });

    it('should update statistics incrementally', async () => {
      const thread = new AnalysisThread({
        threadType: 'version_history',
        statistics: {
          itemsProcessed: 100,
          itemsFailed: 2
        }
      });

      const saved = await thread.save();
      
      // Simulate processing more items
      saved.statistics.itemsProcessed += 50;
      saved.statistics.itemsFailed += 1;
      saved.statistics.averageTimePerItem = 3000;

      const updated = await saved.save();
      expect(updated.statistics.itemsProcessed).toBe(150);
      expect(updated.statistics.itemsFailed).toBe(3);
      expect(updated.statistics.averageTimePerItem).toBe(3000);
    });
  });

  describe('Timestamps', () => {
    it('should add createdAt and updatedAt timestamps', async () => {
      const thread = new AnalysisThread({
        threadType: 'text_metrics'
      });

      const saved = await thread.save();
      expect(saved.createdAt).toBeInstanceOf(Date);
      expect(saved.updatedAt).toBeInstanceOf(Date);
      expect(saved.createdAt).toEqual(saved.updatedAt);
    });

    it('should update updatedAt on modification', async () => {
      const thread = new AnalysisThread({
        threadType: 'section_analysis'
      });

      const saved = await thread.save();
      const originalUpdatedAt = saved.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      saved.status = 'running';
      saved.lastStartTime = new Date();
      await saved.save();

      expect(saved.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Indexes', () => {
    it('should have compound index on threadType and status', async () => {
      const indexes = await AnalysisThread.collection.getIndexes();
      const compoundIndex = indexes.threadType_1_status_1;
      expect(compoundIndex).toBeDefined();
    });
  });

  describe('Querying', () => {
    beforeEach(async () => {
      // Create test data
      await AnalysisThread.create([
        {
          threadType: 'text_metrics',
          status: 'running',
          progress: { current: 25, total: 50, percentage: 50 }
        },
        {
          threadType: 'age_distribution',
          status: 'completed',
          statistics: { itemsProcessed: 100, itemsFailed: 0 }
        },
        {
          threadType: 'version_history',
          status: 'failed',
          error: 'Network timeout'
        },
        {
          threadType: 'section_analysis',
          status: 'stopped'
        }
      ]);
    });

    it('should find threads by status', async () => {
      const runningThreads = await AnalysisThread.find({ status: 'running' });
      expect(runningThreads).toHaveLength(1);
      expect(runningThreads[0].threadType).toBe('text_metrics');

      const failedThreads = await AnalysisThread.find({ status: 'failed' });
      expect(failedThreads).toHaveLength(1);
      expect(failedThreads[0].error).toBe('Network timeout');
    });

    it('should find thread by threadType', async () => {
      const thread = await AnalysisThread.findOne({ threadType: 'age_distribution' });
      expect(thread).toBeDefined();
      expect(thread.status).toBe('completed');
      expect(thread.statistics.itemsProcessed).toBe(100);
    });

    it('should find all active threads', async () => {
      const activeThreads = await AnalysisThread.find({ 
        status: { $in: ['running', 'completed'] }
      });
      
      expect(activeThreads).toHaveLength(2);
      const threadTypes = activeThreads.map(t => t.threadType).sort();
      expect(threadTypes).toEqual(['age_distribution', 'text_metrics']);
    });

    it('should check if any thread is running', async () => {
      const hasRunningThreads = await AnalysisThread.exists({ status: 'running' });
      expect(hasRunningThreads).toBeTruthy();
    });

    it('should get thread progress summary', async () => {
      const threads = await AnalysisThread.find({}, 'threadType status progress');
      
      const summary = threads.reduce((acc, thread) => {
        acc[thread.threadType] = {
          status: thread.status,
          progress: thread.progress.percentage || 0
        };
        return acc;
      }, {});

      expect(summary.text_metrics.status).toBe('running');
      expect(summary.text_metrics.progress).toBe(50);
      expect(summary.section_analysis.status).toBe('stopped');
    });
  });
});