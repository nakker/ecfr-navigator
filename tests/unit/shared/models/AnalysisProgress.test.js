const AnalysisProgress = require('../../../../services/shared/models/AnalysisProgress');
const { setupTestDatabase, teardownTestDatabase } = require('../../../utils/testHelpers');

describe('AnalysisProgress Model', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await AnalysisProgress.deleteMany({});
  });

  describe('Validation', () => {
    it('should create a valid analysis progress with defaults', async () => {
      const progress = new AnalysisProgress({});

      const saved = await progress.save();
      expect(saved.type).toBe('comprehensive');
      expect(saved.status).toBe('pending');
      expect(saved.triggeredBy).toBe('manual');
      expect(saved.failedTitles).toEqual([]);
    });

    it('should accept all valid type values', async () => {
      const types = ['comprehensive', 'single_title'];
      
      for (const type of types) {
        const progress = new AnalysisProgress({ type });
        const saved = await progress.save();
        expect(saved.type).toBe(type);
      }
    });

    it('should reject invalid type values', async () => {
      const progress = new AnalysisProgress({
        type: 'invalid_type'
      });

      await expect(progress.save()).rejects.toThrow(/is not a valid enum value/i);
    });

    it('should accept all valid status values', async () => {
      const statuses = ['pending', 'in_progress', 'completed', 'failed'];
      
      for (const status of statuses) {
        const progress = new AnalysisProgress({ status });
        const saved = await progress.save();
        expect(saved.status).toBe(status);
      }
    });

    it('should reject invalid status values', async () => {
      const progress = new AnalysisProgress({
        status: 'invalid_status'
      });

      await expect(progress.save()).rejects.toThrow(/is not a valid enum value/i);
    });

    it('should accept all valid triggeredBy values', async () => {
      const triggers = ['startup', 'manual'];
      
      for (const triggeredBy of triggers) {
        const progress = new AnalysisProgress({ triggeredBy });
        const saved = await progress.save();
        expect(saved.triggeredBy).toBe(triggeredBy);
      }
    });

    it('should reject invalid triggeredBy values', async () => {
      const progress = new AnalysisProgress({
        triggeredBy: 'automatic'
      });

      await expect(progress.save()).rejects.toThrow(/is not a valid enum value/i);
    });
  });

  describe('Progress Tracking', () => {
    it('should save progress metrics', async () => {
      const progress = new AnalysisProgress({
        type: 'comprehensive',
        status: 'in_progress',
        startTime: new Date('2024-01-15T10:00:00Z'),
        totalTitles: 50,
        processedTitles: 25,
        currentTitle: {
          number: 26,
          name: 'Title 26 - Internal Revenue'
        }
      });

      const saved = await progress.save();
      expect(saved.startTime).toEqual(new Date('2024-01-15T10:00:00Z'));
      expect(saved.totalTitles).toBe(50);
      expect(saved.processedTitles).toBe(25);
      expect(saved.currentTitle.number).toBe(26);
      expect(saved.currentTitle.name).toBe('Title 26 - Internal Revenue');
    });

    it('should save completion data', async () => {
      const progress = new AnalysisProgress({
        status: 'completed',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T14:30:00Z'),
        totalTitles: 50,
        processedTitles: 50
      });

      const saved = await progress.save();
      expect(saved.endTime).toEqual(new Date('2024-01-15T14:30:00Z'));
      expect(saved.processedTitles).toBe(saved.totalTitles);
    });

    it('should track failed titles', async () => {
      const failedTitles = [
        {
          number: 5,
          name: 'Title 5 - Administrative Personnel',
          error: 'XML parsing failed: Invalid format'
        },
        {
          number: 10,
          name: 'Title 10 - Energy',
          error: 'Network timeout during download'
        }
      ];

      const progress = new AnalysisProgress({
        status: 'completed',
        totalTitles: 50,
        processedTitles: 48,
        failedTitles: failedTitles
      });

      const saved = await progress.save();
      expect(saved.failedTitles).toHaveLength(2);
      expect(saved.failedTitles[0].number).toBe(5);
      expect(saved.failedTitles[0].error).toContain('XML parsing failed');
      expect(saved.failedTitles[1].number).toBe(10);
      expect(saved.failedTitles[1].error).toContain('Network timeout');
    });

    it('should save global error message', async () => {
      const progress = new AnalysisProgress({
        status: 'failed',
        error: 'Database connection lost during analysis'
      });

      const saved = await progress.save();
      expect(saved.error).toBe('Database connection lost during analysis');
    });
  });

  describe('Metadata Field', () => {
    it('should save simple metadata', async () => {
      const progress = new AnalysisProgress({
        metadata: {
          version: '1.0.0',
          environment: 'production',
          host: 'worker-node-1'
        }
      });

      const saved = await progress.save();
      expect(saved.metadata.version).toBe('1.0.0');
      expect(saved.metadata.environment).toBe('production');
      expect(saved.metadata.host).toBe('worker-node-1');
    });

    it('should save complex nested metadata', async () => {
      const progress = new AnalysisProgress({
        metadata: {
          config: {
            batchSize: 10,
            timeout: 300000,
            features: ['text_analysis', 'complexity_scoring']
          },
          performance: {
            averageProcessingTime: 125.5,
            peakMemoryUsage: '2.5GB'
          }
        }
      });

      const saved = await progress.save();
      expect(saved.metadata.config.batchSize).toBe(10);
      expect(saved.metadata.config.features).toContain('text_analysis');
      expect(saved.metadata.performance.averageProcessingTime).toBe(125.5);
    });

    it('should save arrays in metadata', async () => {
      const progress = new AnalysisProgress({
        metadata: {
          processedTitleNumbers: [1, 5, 10, 15, 20],
          skippedReasons: ['too_large', 'recently_analyzed', 'reserved']
        }
      });

      const saved = await progress.save();
      expect(saved.metadata.processedTitleNumbers).toEqual([1, 5, 10, 15, 20]);
      expect(saved.metadata.skippedReasons).toContain('recently_analyzed');
    });
  });

  describe('Timestamps', () => {
    it('should add createdAt and updatedAt timestamps', async () => {
      const progress = new AnalysisProgress({});

      const saved = await progress.save();
      expect(saved.createdAt).toBeInstanceOf(Date);
      expect(saved.updatedAt).toBeInstanceOf(Date);
      expect(saved.createdAt).toEqual(saved.updatedAt);
    });

    it('should update updatedAt on modification', async () => {
      const progress = new AnalysisProgress({
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

  describe('Querying', () => {
    beforeEach(async () => {
      // Create test data
      await AnalysisProgress.create([
        {
          type: 'comprehensive',
          status: 'completed',
          triggeredBy: 'startup',
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T14:00:00Z'),
          totalTitles: 50,
          processedTitles: 50
        },
        {
          type: 'single_title',
          status: 'completed',
          triggeredBy: 'manual',
          startTime: new Date('2024-01-15T12:00:00Z'),
          endTime: new Date('2024-01-15T12:30:00Z'),
          totalTitles: 1,
          processedTitles: 1
        },
        {
          type: 'comprehensive',
          status: 'failed',
          triggeredBy: 'manual',
          startTime: new Date('2024-02-01T08:00:00Z'),
          error: 'Network failure'
        },
        {
          type: 'comprehensive',
          status: 'in_progress',
          triggeredBy: 'manual',
          startTime: new Date('2024-02-15T10:00:00Z'),
          totalTitles: 50,
          processedTitles: 15
        }
      ]);
    });

    it('should find progress by status', async () => {
      const completed = await AnalysisProgress.find({ status: 'completed' });
      expect(completed).toHaveLength(2);
      
      const inProgress = await AnalysisProgress.find({ status: 'in_progress' });
      expect(inProgress).toHaveLength(1);
    });

    it('should find progress by type', async () => {
      const comprehensive = await AnalysisProgress.find({ type: 'comprehensive' });
      expect(comprehensive).toHaveLength(3);
      
      const singleTitle = await AnalysisProgress.find({ type: 'single_title' });
      expect(singleTitle).toHaveLength(1);
    });

    it('should find most recent analysis', async () => {
      const latest = await AnalysisProgress.findOne({})
        .sort({ createdAt: -1 });
      
      expect(latest.status).toBe('in_progress');
      expect(latest.startTime).toEqual(new Date('2024-02-15T10:00:00Z'));
    });

    it('should find analyses triggered by startup', async () => {
      const startupAnalyses = await AnalysisProgress.find({ 
        triggeredBy: 'startup' 
      });
      
      expect(startupAnalyses).toHaveLength(1);
      expect(startupAnalyses[0].status).toBe('completed');
    });

    it('should calculate average duration for completed analyses', async () => {
      const completed = await AnalysisProgress.find({ 
        status: 'completed',
        startTime: { $exists: true },
        endTime: { $exists: true }
      });

      const durations = completed.map(p => 
        p.endTime.getTime() - p.startTime.getTime()
      );
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

      expect(avgDuration).toBeGreaterThan(0);
      expect(completed).toHaveLength(2);
    });
  });
});