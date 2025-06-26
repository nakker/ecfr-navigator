const Title = require('../../../../services/shared/models/Title');
const { setupTestDatabase, teardownTestDatabase } = require('../../../utils/testHelpers');

describe('Title Model', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await Title.deleteMany({});
  });

  describe('Validation', () => {
    it('should create a valid title', async () => {
      const validTitle = new Title({
        number: 5,
        name: 'Title 5 - Administrative Personnel',
        checksum: 'abc123def456',
        lastDownloaded: new Date()
      });

      const saved = await validTitle.save();
      expect(saved.number).toBe(5);
      expect(saved.name).toBe('Title 5 - Administrative Personnel');
      expect(saved.checksum).toBe('abc123def456');
      expect(saved.lastDownloaded).toBeInstanceOf(Date);
      expect(saved.reserved).toBe(false);
      expect(saved.isOversized).toBe(false);
    });

    it('should require number field', async () => {
      const title = new Title({
        name: 'Test Title',
        checksum: 'abc123',
        lastDownloaded: new Date()
      });

      await expect(title.save()).rejects.toThrow(/number.*required/i);
    });

    it('should require name field', async () => {
      const title = new Title({
        number: 1,
        checksum: 'abc123',
        lastDownloaded: new Date()
      });

      await expect(title.save()).rejects.toThrow(/name.*required/i);
    });

    it('should require checksum field', async () => {
      const title = new Title({
        number: 1,
        name: 'Test Title',
        lastDownloaded: new Date()
      });

      await expect(title.save()).rejects.toThrow(/checksum.*required/i);
    });

    it('should require lastDownloaded field', async () => {
      const title = new Title({
        number: 1,
        name: 'Test Title',
        checksum: 'abc123'
      });

      await expect(title.save()).rejects.toThrow(/lastDownloaded.*required/i);
    });

    it('should enforce unique number constraint', async () => {
      const title1 = new Title({
        number: 10,
        name: 'Title 10',
        checksum: 'checksum1',
        lastDownloaded: new Date()
      });
      await title1.save();

      const title2 = new Title({
        number: 10,
        name: 'Title 10 Duplicate',
        checksum: 'checksum2',
        lastDownloaded: new Date()
      });

      await expect(title2.save()).rejects.toThrow(/duplicate key.*number/i);
    });

    it('should enforce minimum number value of 1', async () => {
      const title = new Title({
        number: 0,
        name: 'Invalid Title',
        checksum: 'abc123',
        lastDownloaded: new Date()
      });

      await expect(title.save()).rejects.toThrow(/less than minimum/i);
    });

    it('should enforce maximum number value of 50', async () => {
      const title = new Title({
        number: 51,
        name: 'Invalid Title',
        checksum: 'abc123',
        lastDownloaded: new Date()
      });

      await expect(title.save()).rejects.toThrow(/more than maximum/i);
    });
  });

  describe('Optional Fields', () => {
    it('should save all optional date fields', async () => {
      const dates = {
        latestAmendedOn: new Date('2024-01-15'),
        latestIssueDate: new Date('2024-01-20'),
        upToDateAsOf: new Date('2024-01-25'),
        lastAnalyzed: new Date('2024-01-30')
      };

      const title = new Title({
        number: 15,
        name: 'Title 15',
        checksum: 'checksum15',
        lastDownloaded: new Date(),
        ...dates
      });

      const saved = await title.save();
      expect(saved.latestAmendedOn).toEqual(dates.latestAmendedOn);
      expect(saved.latestIssueDate).toEqual(dates.latestIssueDate);
      expect(saved.upToDateAsOf).toEqual(dates.upToDateAsOf);
      expect(saved.lastAnalyzed).toEqual(dates.lastAnalyzed);
    });

    it('should save reserved status', async () => {
      const title = new Title({
        number: 20,
        name: 'Reserved Title',
        checksum: 'checksum20',
        lastDownloaded: new Date(),
        reserved: true
      });

      const saved = await title.save();
      expect(saved.reserved).toBe(true);
    });

    it('should save xmlContent', async () => {
      const xmlContent = '<title>Sample XML Content</title>';
      const title = new Title({
        number: 25,
        name: 'Title with XML',
        checksum: 'checksum25',
        lastDownloaded: new Date(),
        xmlContent
      });

      const saved = await title.save();
      expect(saved.xmlContent).toBe(xmlContent);
    });

    it('should save isOversized flag', async () => {
      const title = new Title({
        number: 30,
        name: 'Oversized Title',
        checksum: 'checksum30',
        lastDownloaded: new Date(),
        isOversized: true
      });

      const saved = await title.save();
      expect(saved.isOversized).toBe(true);
    });
  });

  describe('Timestamps', () => {
    it('should add createdAt and updatedAt timestamps', async () => {
      const title = new Title({
        number: 35,
        name: 'Title with Timestamps',
        checksum: 'checksum35',
        lastDownloaded: new Date()
      });

      const saved = await title.save();
      expect(saved.createdAt).toBeInstanceOf(Date);
      expect(saved.updatedAt).toBeInstanceOf(Date);
      expect(saved.createdAt).toEqual(saved.updatedAt);
    });

    it('should update updatedAt on modification', async () => {
      const title = new Title({
        number: 40,
        name: 'Original Name',
        checksum: 'checksum40',
        lastDownloaded: new Date()
      });

      const saved = await title.save();
      const originalUpdatedAt = saved.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      saved.name = 'Updated Name';
      await saved.save();

      expect(saved.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Indexes', () => {
    it('should have index on number field (unique)', async () => {
      const indexes = await Title.collection.getIndexes();
      const numberIndex = indexes.number_1;
      expect(numberIndex).toBeDefined();
    });

    it('should have index on lastDownloaded field', async () => {
      const indexes = await Title.collection.getIndexes();
      const lastDownloadedIndex = indexes.lastDownloaded_1;
      expect(lastDownloadedIndex).toBeDefined();
    });

    it('should have index on upToDateAsOf field', async () => {
      const indexes = await Title.collection.getIndexes();
      const upToDateAsOfIndex = indexes.upToDateAsOf_1;
      expect(upToDateAsOfIndex).toBeDefined();
    });
  });
});