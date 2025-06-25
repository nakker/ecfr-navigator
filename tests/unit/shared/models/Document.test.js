const mongoose = require('mongoose');
const Document = require('../../../../services/shared/models/Document');
const { DatabaseHelper, TestDataBuilder } = require('../../../utils/testHelpers');

describe('Document Model', () => {
  beforeAll(async () => {
    await DatabaseHelper.connectMongo(process.env.MONGODB_URI);
  });

  afterEach(async () => {
    await DatabaseHelper.clearDatabase();
  });

  describe('Schema Validation', () => {
    it('should create a valid document', async () => {
      const doc = new Document(TestDataBuilder.createDocument());
      const saved = await doc.save();
      
      expect(saved._id).toBeDefined();
      expect(saved.titleNumber).toBe(1);
      expect(saved.identifier).toBe('test-doc-1');
      expect(saved.type).toBe('part');
      expect(saved.contentLength).toBe(saved.content.length);
    });

    it('should validate document type enum', async () => {
      const doc = new Document({
        ...TestDataBuilder.createDocument(),
        type: 'invalid-type'
      });

      await expect(doc.save()).rejects.toThrow(/type.*enum/);
    });

    it('should accept all valid document types', async () => {
      const validTypes = [
        'title', 'subtitle', 'chapter', 'subchapter', 
        'part', 'subpart', 'section', 'appendix'
      ];

      for (const type of validTypes) {
        const doc = await Document.create({
          ...TestDataBuilder.createDocument(),
          identifier: `${type}-test`,
          type
        });
        expect(doc.type).toBe(type);
      }
    });

    it('should enforce unique constraint on titleNumber + identifier', async () => {
      const docData = TestDataBuilder.createDocument();
      await Document.create(docData);

      // Try to create duplicate
      await expect(Document.create(docData))
        .rejects.toThrow(/duplicate key/);
    });

    it('should allow same identifier for different titles', async () => {
      await Document.create({
        ...TestDataBuilder.createDocument(),
        titleNumber: 1,
        identifier: 'section-1'
      });

      const doc2 = await Document.create({
        ...TestDataBuilder.createDocument(),
        titleNumber: 2,
        identifier: 'section-1'
      });

      expect(doc2._id).toBeDefined();
    });

    it('should require all mandatory fields', async () => {
      const requiredFields = [
        'titleNumber', 'identifier', 'type', 'label', 
        'title', 'content', 'hierarchy'
      ];

      for (const field of requiredFields) {
        const docData = { ...TestDataBuilder.createDocument() };
        delete docData[field];
        
        const doc = new Document(docData);
        await expect(doc.save()).rejects.toThrow(new RegExp(field));
      }
    });
  });

  describe('Content Management', () => {
    it('should automatically calculate contentLength', async () => {
      const content = 'This is a test content with some length.';
      const doc = await Document.create({
        ...TestDataBuilder.createDocument(),
        content
      });

      expect(doc.contentLength).toBe(content.length);
    });

    it('should update contentLength when content changes', async () => {
      const doc = await Document.create(TestDataBuilder.createDocument());
      const originalLength = doc.contentLength;

      doc.content = 'Much longer content than before with many more words.';
      await doc.save();

      expect(doc.contentLength).toBe(doc.content.length);
      expect(doc.contentLength).not.toBe(originalLength);
    });

    it('should handle empty content', async () => {
      const doc = await Document.create({
        ...TestDataBuilder.createDocument(),
        content: ''
      });

      expect(doc.contentLength).toBe(0);
    });

    it('should handle very large content', async () => {
      const largeContent = 'x'.repeat(100000); // 100KB
      const doc = await Document.create({
        ...TestDataBuilder.createDocument(),
        content: largeContent
      });

      expect(doc.contentLength).toBe(100000);
    });
  });

  describe('Hierarchy Validation', () => {
    it('should accept valid hierarchy structure', async () => {
      const hierarchy = {
        title: 1,
        subtitle: 'A',
        chapter: 'I',
        subchapter: 'B',
        part: '200',
        subpart: 'C',
        section: '200.1'
      };

      const doc = await Document.create({
        ...TestDataBuilder.createDocument(),
        hierarchy
      });

      expect(doc.hierarchy).toEqual(hierarchy);
    });

    it('should allow partial hierarchy', async () => {
      const hierarchy = {
        title: 2,
        part: '100'
      };

      const doc = await Document.create({
        ...TestDataBuilder.createDocument(),
        identifier: 'part-100',
        hierarchy
      });

      expect(doc.hierarchy.title).toBe(2);
      expect(doc.hierarchy.part).toBe('100');
      expect(doc.hierarchy.section).toBeUndefined();
    });

    it('should require at least title in hierarchy', async () => {
      const doc = new Document({
        ...TestDataBuilder.createDocument(),
        hierarchy: {}
      });

      await expect(doc.save()).rejects.toThrow(/hierarchy/);
    });
  });

  describe('GridFS Reference', () => {
    it('should store gridfsId when provided', async () => {
      const gridfsId = new mongoose.Types.ObjectId();
      const doc = await Document.create({
        ...TestDataBuilder.createDocument(),
        gridfsId
      });

      expect(doc.gridfsId).toEqual(gridfsId);
    });

    it('should work without gridfsId', async () => {
      const doc = await Document.create(TestDataBuilder.createDocument());
      expect(doc.gridfsId).toBeUndefined();
    });
  });

  describe('Date Fields', () => {
    it('should handle effectiveDate', async () => {
      const effectiveDate = new Date('2024-01-01');
      const doc = await Document.create({
        ...TestDataBuilder.createDocument(),
        effectiveDate
      });

      expect(doc.effectiveDate).toEqual(effectiveDate);
    });

    it('should auto-populate timestamps', async () => {
      const doc = await Document.create(TestDataBuilder.createDocument());
      
      expect(doc.createdAt).toBeDefined();
      expect(doc.updatedAt).toBeDefined();
      expect(doc.lastModified).toBeDefined();
    });

    it('should update timestamps on save', async () => {
      const doc = await Document.create(TestDataBuilder.createDocument());
      const originalUpdated = doc.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 10));
      
      doc.content = 'Updated content';
      await doc.save();

      expect(doc.updatedAt.getTime()).toBeGreaterThan(originalUpdated.getTime());
    });
  });

  describe('Indexing', () => {
    it('should create compound index on titleNumber and identifier', async () => {
      const indexes = await Document.collection.getIndexes();
      
      const compoundIndex = Object.values(indexes).find(index => 
        index.key && 
        index.key.titleNumber === 1 && 
        index.key.identifier === 1
      );

      expect(compoundIndex).toBeDefined();
      expect(compoundIndex.unique).toBe(true);
    });

    it('should create index on type field', async () => {
      const indexes = await Document.collection.getIndexes();
      
      const typeIndex = Object.values(indexes).find(index => 
        index.key && index.key.type === 1
      );

      expect(typeIndex).toBeDefined();
    });

    it('should create index on effectiveDate', async () => {
      const indexes = await Document.collection.getIndexes();
      
      const dateIndex = Object.values(indexes).find(index => 
        index.key && index.key.effectiveDate === -1
      );

      expect(dateIndex).toBeDefined();
    });
  });

  describe('Query Performance', () => {
    beforeEach(async () => {
      // Create multiple documents for query testing
      const docs = [];
      for (let i = 1; i <= 10; i++) {
        docs.push({
          ...TestDataBuilder.createDocument(),
          titleNumber: Math.ceil(i / 3),
          identifier: `section-${i}`,
          type: i % 2 === 0 ? 'section' : 'part',
          effectiveDate: new Date(2024, 0, i)
        });
      }
      await Document.insertMany(docs);
    });

    it('should efficiently query by titleNumber and identifier', async () => {
      const doc = await Document.findOne({
        titleNumber: 2,
        identifier: 'section-4'
      });

      expect(doc).toBeDefined();
      expect(doc.identifier).toBe('section-4');
    });

    it('should efficiently query by type', async () => {
      const sections = await Document.find({ type: 'section' });
      expect(sections).toHaveLength(5);
      expect(sections.every(d => d.type === 'section')).toBe(true);
    });

    it('should efficiently query by date range', async () => {
      const docs = await Document.find({
        effectiveDate: {
          $gte: new Date(2024, 0, 5),
          $lte: new Date(2024, 0, 8)
        }
      }).sort({ effectiveDate: 1 });

      expect(docs).toHaveLength(4);
      expect(docs[0].identifier).toBe('section-5');
      expect(docs[3].identifier).toBe('section-8');
    });
  });
});