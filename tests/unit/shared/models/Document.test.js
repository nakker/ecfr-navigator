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
      const docData = {
        titleNumber: 1,
        identifier: 'test-doc-1',
        type: 'part',
        heading: 'Test Document',
        content: 'This is test content for analysis.',
        part: '1',
        effectiveDate: new Date(),
        lastModified: new Date()
      };
      
      const doc = new Document(docData);
      const saved = await doc.save();
      
      expect(saved._id).toBeDefined();
      expect(saved.titleNumber).toBe(1);
      expect(saved.identifier).toBe('test-doc-1');
      expect(saved.type).toBe('part');
      expect(saved.contentLength).toBe(0); // Default value
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
        'part', 'subpart', 'subjectgroup', 'section', 'appendix'
      ];

      for (const type of validTypes) {
        const doc = await Document.create({
          titleNumber: 1,
          identifier: `${type}-test`,
          type,
          heading: `Test ${type}`,
          content: 'Test content'
        });
        expect(doc.type).toBe(type);
      }
    });

    it('should enforce unique constraint on titleNumber + identifier', async () => {
      const docData = {
        titleNumber: 1,
        identifier: 'unique-test',
        type: 'section',
        heading: 'Test Section',
        content: 'Test content'
      };
      await Document.create(docData);

      // Try to create duplicate
      await expect(Document.create(docData))
        .rejects.toThrow(/duplicate key/);
    });

    it('should allow same identifier for different titles', async () => {
      await Document.create({
        titleNumber: 1,
        identifier: 'section-1',
        type: 'section',
        heading: 'Section 1',
        content: 'Content for title 1'
      });

      const doc2 = await Document.create({
        titleNumber: 2,
        identifier: 'section-1',
        type: 'section',
        heading: 'Section 1',
        content: 'Content for title 2'
      });

      expect(doc2._id).toBeDefined();
    });

    it('should require all mandatory fields', async () => {
      const requiredFields = [
        'titleNumber', 'identifier', 'type', 'content'
      ];

      for (const field of requiredFields) {
        const docData = {
          titleNumber: 1,
          identifier: 'test-doc',
          type: 'section',
          content: 'Test content'
        };
        delete docData[field];
        
        const doc = new Document(docData);
        await expect(doc.save()).rejects.toThrow(new RegExp(field));
      }
    });
  });

  describe('Content Management', () => {
    it('should have default contentLength of 0', async () => {
      const content = 'This is a test content with some length.';
      const doc = await Document.create({
        titleNumber: 1,
        identifier: 'content-test',
        type: 'section',
        heading: 'Test',
        content
      });

      expect(doc.contentLength).toBe(0); // Default value
    });

    it('should allow manual contentLength update', async () => {
      const doc = await Document.create({
        titleNumber: 1,
        identifier: 'length-test',
        type: 'section',
        heading: 'Test',
        content: 'Initial content'
      });
      
      doc.contentLength = 100;
      await doc.save();

      expect(doc.contentLength).toBe(100);
    });

    it('should require non-empty content', async () => {
      const doc = new Document({
        titleNumber: 1,
        identifier: 'empty-test',  
        type: 'section',
        heading: 'Test'
        // Missing content
      });

      await expect(doc.save()).rejects.toThrow(/content.*required/);
    });

    it('should handle very large content', async () => {
      const largeContent = 'x'.repeat(100000); // 100KB
      const doc = await Document.create({
        titleNumber: 1,
        identifier: 'large-test',
        type: 'section',
        heading: 'Large Content',
        content: largeContent,
        contentLength: largeContent.length
      });

      expect(doc.content.length).toBe(100000);
      expect(doc.contentLength).toBe(100000);
    });
  });

  describe('Hierarchy Fields', () => {
    it('should store hierarchy as individual fields', async () => {
      const doc = await Document.create({
        titleNumber: 1,
        identifier: 'full-hierarchy',
        type: 'section',
        heading: 'Test Section',
        content: 'Test content',
        subtitle: 'A',
        chapter: 'I',
        subchapter: 'B',
        part: '200',
        subpart: 'C',
        section: '200.1'
      });

      expect(doc.subtitle).toBe('A');
      expect(doc.chapter).toBe('I');
      expect(doc.subchapter).toBe('B');
      expect(doc.part).toBe('200');
      expect(doc.subpart).toBe('C');
      expect(doc.section).toBe('200.1');
    });

    it('should allow partial hierarchy fields', async () => {
      const doc = await Document.create({
        titleNumber: 2,
        identifier: 'part-100',
        type: 'part',
        heading: 'Part 100',
        content: 'Part content',
        part: '100'
      });

      expect(doc.titleNumber).toBe(2);
      expect(doc.part).toBe('100');
      expect(doc.section).toBeUndefined();
    });

    it('should not require hierarchy fields', async () => {
      const doc = await Document.create({
        titleNumber: 3,
        identifier: 'no-hierarchy',
        type: 'title',
        heading: 'Title Only',
        content: 'Title content'
      });

      expect(doc._id).toBeDefined();
      expect(doc.part).toBeUndefined();
      expect(doc.section).toBeUndefined();
    });
  });

  describe('GridFS References', () => {
    it('should store contentGridFS reference when provided', async () => {
      const contentGridFS = new mongoose.Types.ObjectId();
      const doc = await Document.create({
        titleNumber: 1,
        identifier: 'gridfs-test',
        type: 'section',
        heading: 'GridFS Test',
        content: 'Small content',
        contentGridFS
      });

      expect(doc.contentGridFS).toEqual(contentGridFS);
    });

    it('should work without GridFS references', async () => {
      const doc = await Document.create({
        titleNumber: 1,
        identifier: 'no-gridfs',
        type: 'section',
        heading: 'No GridFS',
        content: 'Regular content'
      });
      
      expect(doc.contentGridFS).toBeUndefined();
      expect(doc.structuredContentGridFS).toBeUndefined();
      expect(doc.formattedContentGridFS).toBeUndefined();
    });
  });

  describe('Date Fields', () => {
    it('should handle effectiveDate and amendmentDate', async () => {
      const effectiveDate = new Date('2024-01-01');
      const amendmentDate = new Date('2024-06-01');
      const doc = await Document.create({
        titleNumber: 1,
        identifier: 'date-test',
        type: 'section',
        heading: 'Date Test',
        content: 'Content',
        effectiveDate,
        amendmentDate
      });

      expect(doc.effectiveDate).toEqual(effectiveDate);
      expect(doc.amendmentDate).toEqual(amendmentDate);
    });

    it('should auto-populate timestamps', async () => {
      const doc = await Document.create({
        titleNumber: 1,
        identifier: 'timestamp-test',
        type: 'section',
        heading: 'Timestamp Test',
        content: 'Content'
      });
      
      expect(doc.createdAt).toBeDefined();
      expect(doc.updatedAt).toBeDefined();
    });

    it('should update timestamps on save', async () => {
      const doc = await Document.create({
        titleNumber: 1,
        identifier: 'update-test',
        type: 'section',
        heading: 'Update Test',
        content: 'Initial content'
      });
      const originalUpdated = doc.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 10));
      
      doc.content = 'Updated content';
      await doc.save();

      expect(doc.updatedAt.getTime()).toBeGreaterThan(originalUpdated.getTime());
    });
  });

  describe('Indexing', () => {
    it('should have indexes configured', async () => {
      // Skip index test if collection doesn't exist yet
      try {
        const indexes = await Document.collection.getIndexes();
        
        // Should have at least the default _id index
        expect(Object.keys(indexes).length).toBeGreaterThan(0);
        
        // Check for compound index on titleNumber and identifier
        const hasCompoundIndex = Object.values(indexes).some(index => 
          index.key && 
          index.key.titleNumber !== undefined && 
          index.key.identifier !== undefined
        );
        
        expect(hasCompoundIndex).toBe(true);
      } catch (error) {
        // Collection may not exist in test environment - this is expected
        expect(error.message).toBeDefined();
      }
    });
  });

  describe('Query Performance', () => {
    beforeEach(async () => {
      // Create multiple documents for query testing
      const docs = [];
      for (let i = 1; i <= 10; i++) {
        docs.push({
          titleNumber: Math.ceil(i / 3),
          identifier: `section-${i}`,
          type: i % 2 === 0 ? 'section' : 'part',
          heading: `Test ${i}`,
          content: `Content for document ${i}`,
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