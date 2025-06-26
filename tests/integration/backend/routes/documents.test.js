const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const documentsRouter = require('../../../../services/backend/routes/documents');
const Document = require('../../../../services/shared/models/Document');
const { DatabaseHelper, TestDataBuilder } = require('../../../utils/testHelpers');

describe('Documents API Integration Tests', () => {
  let app;
  let gridFSBucket;

  beforeAll(async () => {
    const mongoUri = `mongodb://${process.env.MONGO_ROOT_USERNAME}:${process.env.MONGO_ROOT_PASSWORD}@localhost:27017/${process.env.MONGO_DATABASE}?authSource=admin`;
    await DatabaseHelper.connectMongo(mongoUri);
    
    // Set up GridFS
    gridFSBucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'documents'
    });

    // Set up Express app
    app = express();
    app.use(express.json());
    
    // Mock GridFS in request
    app.use((req, res, next) => {
      req.gridFSBucket = gridFSBucket;
      next();
    });
    
    app.use('/api/documents', documentsRouter);
    
    // Error handler
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ 
        error: err.message || 'Internal server error' 
      });
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await DatabaseHelper.clearDatabase();
    // Clear GridFS files
    await gridFSBucket.drop().catch(() => {}); // Ignore error if bucket doesn't exist
  });

  describe('GET /api/documents/:titleNumber', () => {
    beforeEach(async () => {
      // Create test documents
      await Document.insertMany([
        TestDataBuilder.createDocument({
          titleNumber: 1,
          identifier: 'part-1',
          type: 'part',
          label: 'Part 1',
          title: 'General Provisions'
        }),
        TestDataBuilder.createDocument({
          titleNumber: 1,
          identifier: 'section-1.1',
          type: 'section',
          label: 'Section 1.1',
          title: 'Purpose',
          hierarchy: { title: 1, part: '1', section: '1.1' }
        }),
        TestDataBuilder.createDocument({
          titleNumber: 1,
          identifier: 'section-1.2',
          type: 'section',
          label: 'Section 1.2',
          title: 'Definitions',
          hierarchy: { title: 1, part: '1', section: '1.2' }
        }),
        TestDataBuilder.createDocument({
          titleNumber: 2,
          identifier: 'part-200',
          type: 'part',
          label: 'Part 200',
          title: 'Uniform Requirements'
        })
      ]);
    });

    it('should list all documents for a title', async () => {
      const response = await request(app)
        .get('/api/documents/1');

      expect(response.status).toBe(200);
      expect(response.body.documents).toBeDefined();
      expect(response.body.documents).toHaveLength(3);
      expect(response.body.titleNumber).toBe(1);
    });

    it('should filter by document type', async () => {
      const response = await request(app)
        .get('/api/documents/1')
        .query({ type: 'section' });

      expect(response.status).toBe(200);
      expect(response.body.documents).toHaveLength(2);
      expect(response.body.documents.every(d => d.type === 'section')).toBe(true);
    });

    it('should sort documents by identifier', async () => {
      const response = await request(app)
        .get('/api/documents/1');

      expect(response.status).toBe(200);
      const identifiers = response.body.documents.map(d => d.identifier);
      expect(identifiers).toEqual(['part-1', 'section-1.1', 'section-1.2']);
    });

    it('should return empty array for non-existent title', async () => {
      const response = await request(app)
        .get('/api/documents/999');

      expect(response.status).toBe(200);
      expect(response.body.documents).toEqual([]);
    });

    it('should validate title number', async () => {
      const response = await request(app)
        .get('/api/documents/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid title number');
    });

    it('should handle database errors gracefully', async () => {
      const originalFind = Document.find;
      Document.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          select: jest.fn().mockRejectedValue(new Error('DB Error'))
        })
      });

      const response = await request(app)
        .get('/api/documents/1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();

      Document.find = originalFind;
    });
  });

  describe('GET /api/documents/:titleNumber/:identifier', () => {
    let testDoc;

    beforeEach(async () => {
      testDoc = await Document.create(
        TestDataBuilder.createDocument({
          titleNumber: 1,
          identifier: 'section-1.1',
          title: 'Purpose',
          content: 'This section describes the purpose of the regulation.'
        })
      );
    });

    it('should retrieve a specific document', async () => {
      const response = await request(app)
        .get('/api/documents/1/section-1.1');

      expect(response.status).toBe(200);
      expect(response.body.titleNumber).toBe(1);
      expect(response.body.identifier).toBe('section-1.1');
      expect(response.body.title).toBe('Purpose');
      expect(response.body.content).toBeDefined();
    });

    it('should exclude content with exclude parameter', async () => {
      const response = await request(app)
        .get('/api/documents/1/section-1.1')
        .query({ exclude: 'content' });

      expect(response.status).toBe(200);
      expect(response.body.content).toBeUndefined();
      expect(response.body.title).toBeDefined();
    });

    it('should return 404 for non-existent document', async () => {
      const response = await request(app)
        .get('/api/documents/1/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Document not found');
    });

    it('should handle documents with GridFS content', async () => {
      // Create a document with GridFS reference
      const largeContent = 'x'.repeat(100000);
      const uploadStream = gridFSBucket.openUploadStream('large-doc.txt');
      const gridfsId = uploadStream.id;
      
      await new Promise((resolve, reject) => {
        uploadStream.on('finish', resolve);
        uploadStream.on('error', reject);
        uploadStream.end(Buffer.from(largeContent));
      });

      await Document.create(
        TestDataBuilder.createDocument({
          titleNumber: 2,
          identifier: 'large-section',
          content: null,
          gridfsId
        })
      );

      const response = await request(app)
        .get('/api/documents/2/large-section');

      expect(response.status).toBe(200);
      expect(response.body.content).toBe(largeContent);
    });

    it('should handle missing GridFS file gracefully', async () => {
      const fakeGridfsId = new mongoose.Types.ObjectId();
      await Document.create(
        TestDataBuilder.createDocument({
          titleNumber: 3,
          identifier: 'broken-section',
          content: null,
          gridfsId: fakeGridfsId
        })
      );

      const response = await request(app)
        .get('/api/documents/3/broken-section');

      expect(response.status).toBe(200);
      expect(response.body.content).toBe('');
    });
  });

  describe('GET /api/documents/:titleNumber/:identifier/download', () => {
    beforeEach(async () => {
      await Document.create(
        TestDataBuilder.createDocument({
          titleNumber: 1,
          identifier: 'section-1.1',
          title: 'Purpose',
          content: 'Download test content'
        })
      );
    });

    it('should download document as text file', async () => {
      const response = await request(app)
        .get('/api/documents/1/section-1.1/download');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/plain');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('title-1-section-1.1.txt');
      expect(response.text).toContain('Title 1 - Section 1.1');
      expect(response.text).toContain('Purpose');
      expect(response.text).toContain('Download test content');
    });

    it('should handle special characters in filename', async () => {
      await Document.create(
        TestDataBuilder.createDocument({
          titleNumber: 2,
          identifier: 'section/2.1',
          title: 'Special: Characters & Symbols'
        })
      );

      const response = await request(app)
        .get('/api/documents/2/section%2F2.1/download');

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain('title-2-section-2.1.txt');
    });

    it('should return 404 for non-existent document download', async () => {
      const response = await request(app)
        .get('/api/documents/1/non-existent/download');

      expect(response.status).toBe(404);
    });

    it('should handle large documents from GridFS', async () => {
      const largeContent = 'Large content '.repeat(10000);
      const uploadStream = gridFSBucket.openUploadStream('large-download.txt');
      const gridfsId = uploadStream.id;
      
      await new Promise((resolve, reject) => {
        uploadStream.on('finish', resolve);
        uploadStream.on('error', reject);
        uploadStream.end(Buffer.from(largeContent));
      });

      await Document.create(
        TestDataBuilder.createDocument({
          titleNumber: 3,
          identifier: 'large-download',
          title: 'Large Document',
          content: null,
          gridfsId
        })
      );

      const response = await request(app)
        .get('/api/documents/3/large-download/download');

      expect(response.status).toBe(200);
      expect(response.text).toContain(largeContent);
    });
  });

  describe('GET /api/documents/hierarchy/:titleNumber', () => {
    beforeEach(async () => {
      // Create hierarchical documents
      await Document.insertMany([
        TestDataBuilder.createDocument({
          titleNumber: 1,
          identifier: 'title-1',
          type: 'title',
          label: 'Title 1',
          hierarchy: { title: 1 }
        }),
        TestDataBuilder.createDocument({
          titleNumber: 1,
          identifier: 'part-1',
          type: 'part',
          label: 'Part 1',
          hierarchy: { title: 1, part: '1' }
        }),
        TestDataBuilder.createDocument({
          titleNumber: 1,
          identifier: 'section-1.1',
          type: 'section',
          label: 'Section 1.1',
          hierarchy: { title: 1, part: '1', section: '1.1' }
        }),
        TestDataBuilder.createDocument({
          titleNumber: 1,
          identifier: 'section-1.2',
          type: 'section',
          label: 'Section 1.2',
          hierarchy: { title: 1, part: '1', section: '1.2' }
        }),
        TestDataBuilder.createDocument({
          titleNumber: 1,
          identifier: 'part-2',
          type: 'part',
          label: 'Part 2',
          hierarchy: { title: 1, part: '2' }
        }),
        TestDataBuilder.createDocument({
          titleNumber: 1,
          identifier: 'section-2.1',
          type: 'section',
          label: 'Section 2.1',
          hierarchy: { title: 1, part: '2', section: '2.1' }
        })
      ]);
    });

    it('should return hierarchical structure', async () => {
      const response = await request(app)
        .get('/api/documents/hierarchy/1');

      expect(response.status).toBe(200);
      expect(response.body.titleNumber).toBe(1);
      expect(response.body.hierarchy).toBeDefined();
      expect(response.body.hierarchy.type).toBe('title');
      expect(response.body.hierarchy.children).toHaveLength(2); // 2 parts
      
      const part1 = response.body.hierarchy.children.find(c => c.identifier === 'part-1');
      expect(part1.children).toHaveLength(2); // 2 sections
    });

    it('should build hierarchy without title document', async () => {
      // Remove title document
      await Document.deleteOne({ identifier: 'title-1' });

      const response = await request(app)
        .get('/api/documents/hierarchy/1');

      expect(response.status).toBe(200);
      expect(response.body.hierarchy.children).toHaveLength(2);
    });

    it('should handle empty hierarchy', async () => {
      const response = await request(app)
        .get('/api/documents/hierarchy/999');

      expect(response.status).toBe(200);
      expect(response.body.hierarchy).toEqual({
        type: 'title',
        identifier: 'title-999',
        label: 'Title 999',
        children: []
      });
    });
  });
});