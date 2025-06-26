const VersionHistory = require('../../../../services/shared/models/VersionHistory');
const { setupTestDatabase, teardownTestDatabase } = require('../../../utils/testHelpers');

describe('VersionHistory Model', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await VersionHistory.deleteMany({});
  });

  describe('Validation', () => {
    it('should create a valid version history with minimal fields', async () => {
      const versionHistory = new VersionHistory({
        titleNumber: 5
      });

      const saved = await versionHistory.save();
      expect(saved.titleNumber).toBe(5);
      expect(saved.lastUpdated).toBeInstanceOf(Date);
      expect(saved.versions).toEqual([]);
    });

    it('should require titleNumber field', async () => {
      const versionHistory = new VersionHistory({
        lastUpdated: new Date()
      });

      await expect(versionHistory.save()).rejects.toThrow(/titleNumber.*required/i);
    });

    it('should enforce unique titleNumber constraint', async () => {
      const vh1 = new VersionHistory({ titleNumber: 10 });
      await vh1.save();

      const vh2 = new VersionHistory({ titleNumber: 10 });
      await expect(vh2.save()).rejects.toThrow(/duplicate key.*titleNumber/i);
    });

    it('should use provided lastUpdated date', async () => {
      const customDate = new Date('2024-01-15');
      const versionHistory = new VersionHistory({
        titleNumber: 15,
        lastUpdated: customDate
      });

      const saved = await versionHistory.save();
      expect(saved.lastUpdated).toEqual(customDate);
    });

    it('should default lastUpdated to now if not provided', async () => {
      const beforeSave = Date.now();
      const versionHistory = new VersionHistory({
        titleNumber: 20
      });

      const saved = await versionHistory.save();
      const afterSave = Date.now();
      
      expect(saved.lastUpdated.getTime()).toBeGreaterThanOrEqual(beforeSave);
      expect(saved.lastUpdated.getTime()).toBeLessThanOrEqual(afterSave);
    });
  });

  describe('Version Subdocuments', () => {
    it('should save version entries', async () => {
      const versions = [
        {
          date: new Date('2024-01-01'),
          identifier: 'E.R. 123',
          name: 'Executive Order 123',
          part: 'Part 100',
          type: 'FRDOC'
        },
        {
          date: new Date('2024-01-15'),
          identifier: 'FR 2024-456',
          name: 'Final Rule on XYZ',
          part: 'Part 200',
          type: 'RULE'
        }
      ];

      const versionHistory = new VersionHistory({
        titleNumber: 25,
        versions: versions
      });

      const saved = await versionHistory.save();
      expect(saved.versions).toHaveLength(2);
      expect(saved.versions[0].date).toEqual(versions[0].date);
      expect(saved.versions[0].identifier).toBe('E.R. 123');
      expect(saved.versions[0].name).toBe('Executive Order 123');
      expect(saved.versions[0].part).toBe('Part 100');
      expect(saved.versions[0].type).toBe('FRDOC');
    });

    it('should validate required fields in version subdocuments', async () => {
      const versionHistory = new VersionHistory({
        titleNumber: 30,
        versions: [{
          // Missing required fields
          date: new Date()
        }]
      });

      await expect(versionHistory.save()).rejects.toThrow(/required/i);
    });

    it('should not generate _id for version subdocuments', async () => {
      const versionHistory = new VersionHistory({
        titleNumber: 35,
        versions: [{
          date: new Date(),
          identifier: 'TEST-001',
          name: 'Test Version',
          part: 'Part 1',
          type: 'TEST'
        }]
      });

      const saved = await versionHistory.save();
      expect(saved.versions[0]._id).toBeUndefined();
    });

    it('should add versions to existing history', async () => {
      const versionHistory = new VersionHistory({
        titleNumber: 40,
        versions: [{
          date: new Date('2024-01-01'),
          identifier: 'V1',
          name: 'Version 1',
          part: 'Part 1',
          type: 'RULE'
        }]
      });

      const saved = await versionHistory.save();
      expect(saved.versions).toHaveLength(1);

      // Add another version
      saved.versions.push({
        date: new Date('2024-02-01'),
        identifier: 'V2',
        name: 'Version 2',
        part: 'Part 2',
        type: 'PRORULE'
      });

      const updated = await saved.save();
      expect(updated.versions).toHaveLength(2);
      expect(updated.versions[1].identifier).toBe('V2');
    });

    it('should handle empty versions array', async () => {
      const versionHistory = new VersionHistory({
        titleNumber: 45,
        versions: []
      });

      const saved = await versionHistory.save();
      expect(saved.versions).toEqual([]);
    });
  });

  describe('Timestamps', () => {
    it('should add createdAt and updatedAt timestamps', async () => {
      const versionHistory = new VersionHistory({
        titleNumber: 50
      });

      const saved = await versionHistory.save();
      expect(saved.createdAt).toBeInstanceOf(Date);
      expect(saved.updatedAt).toBeInstanceOf(Date);
      expect(saved.createdAt).toEqual(saved.updatedAt);
    });

    it('should update updatedAt on modification', async () => {
      const versionHistory = new VersionHistory({
        titleNumber: 55
      });

      const saved = await versionHistory.save();
      const originalUpdatedAt = saved.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      saved.lastUpdated = new Date();
      await saved.save();

      expect(saved.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Indexes', () => {
    it('should have index on titleNumber field', async () => {
      const indexes = await VersionHistory.collection.getIndexes();
      const titleNumberIndex = indexes.titleNumber_1;
      expect(titleNumberIndex).toBeDefined();
    });
  });

  describe('Querying', () => {
    beforeEach(async () => {
      // Create test data
      await VersionHistory.create([
        {
          titleNumber: 5,
          versions: [
            {
              date: new Date('2024-01-01'),
              identifier: 'FR-001',
              name: 'Rule 1',
              part: 'Part 100',
              type: 'RULE'
            }
          ]
        },
        {
          titleNumber: 10,
          versions: [
            {
              date: new Date('2024-01-15'),
              identifier: 'FR-002',
              name: 'Rule 2',
              part: 'Part 200',
              type: 'RULE'
            },
            {
              date: new Date('2024-02-01'),
              identifier: 'FR-003',
              name: 'Rule 3',
              part: 'Part 300',
              type: 'PRORULE'
            }
          ]
        }
      ]);
    });

    it('should find version history by titleNumber', async () => {
      const history = await VersionHistory.findOne({ titleNumber: 10 });
      expect(history).toBeDefined();
      expect(history.titleNumber).toBe(10);
      expect(history.versions).toHaveLength(2);
    });

    it('should find version histories with specific version types', async () => {
      const histories = await VersionHistory.find({
        'versions.type': 'PRORULE'
      });

      expect(histories).toHaveLength(1);
      expect(histories[0].titleNumber).toBe(10);
    });

    it('should find version histories updated after a certain date', async () => {
      const cutoffDate = new Date('2024-01-10');
      const histories = await VersionHistory.find({
        'versions.date': { $gte: cutoffDate }
      });

      expect(histories).toHaveLength(1);
      expect(histories[0].titleNumber).toBe(10);
    });
  });
});