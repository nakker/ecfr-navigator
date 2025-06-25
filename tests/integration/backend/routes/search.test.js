const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const searchRouter = require('../../../../services/backend/routes/search');
const Document = require('../../../../services/shared/models/Document');
const { DatabaseHelper, ElasticsearchHelper, TestDataBuilder } = require('../../../utils/testHelpers');
const { sampleDocuments } = require('../../../fixtures/sampleData');

describe('Search API Integration Tests', () => {
  let app;
  let esHelper;
  const indexName = 'test_ecfr_documents';

  beforeAll(async () => {
    // Connect to MongoDB
    await DatabaseHelper.connectMongo(process.env.MONGODB_URI);
    
    // Connect to Elasticsearch
    esHelper = new ElasticsearchHelper();
    await esHelper.connect();
    
    // Create test index
    await esHelper.createIndex(indexName, {
      properties: {
        titleNumber: { type: 'integer' },
        identifier: { type: 'keyword' },
        type: { type: 'keyword' },
        label: { type: 'text' },
        title: { type: 'text' },
        content: { type: 'text' },
        effectiveDate: { type: 'date' },
        hierarchy: { type: 'object' }
      }
    });

    // Set up Express app
    app = express();
    app.use(express.json());
    
    // Mock Elasticsearch client in request
    app.use((req, res, next) => {
      req.elasticsearchClient = esHelper.client;
      next();
    });
    
    app.use('/api/search', searchRouter);
    
    // Add error handler
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ 
        error: err.message || 'Internal server error' 
      });
    });
  });

  afterAll(async () => {
    await esHelper.deleteIndex(indexName);
    await esHelper.client.close();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await DatabaseHelper.clearDatabase();
    await esHelper.deleteIndex(indexName);
    await esHelper.createIndex(indexName, {
      properties: {
        titleNumber: { type: 'integer' },
        identifier: { type: 'keyword' },
        type: { type: 'keyword' },
        label: { type: 'text' },
        title: { type: 'text' },
        content: { type: 'text' },
        effectiveDate: { type: 'date' },
        hierarchy: { type: 'object' }
      }
    });
  });

  describe('POST /api/search', () => {
    beforeEach(async () => {
      // Insert test documents in MongoDB
      await Document.insertMany(sampleDocuments);
      
      // Index documents in Elasticsearch
      for (const doc of sampleDocuments) {
        await esHelper.indexDocument(indexName, doc);
      }
    });

    it('should search documents with basic query', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({
          query: 'organization',
          filters: {}
        });

      expect(response.status).toBe(200);
      expect(response.body.results).toBeDefined();
      expect(response.body.total).toBeGreaterThan(0);
      expect(response.body.results[0].title).toContain('Organization');
    });

    it('should filter by title numbers', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({
          query: '*',
          filters: {
            titleNumbers: [2]
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.results.every(r => r.titleNumber === 2)).toBe(true);
    });

    it('should filter by document types', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({
          query: '*',
          filters: {
            documentTypes: ['section']
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.results.every(r => r.type === 'section')).toBe(true);
    });

    it('should filter by date range', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({
          query: '*',
          filters: {
            dateRange: {
              start: '2023-05-01',
              end: '2023-12-31'
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.results.length).toBeGreaterThan(0);
      
      response.body.results.forEach(result => {
        const date = new Date(result.effectiveDate);
        expect(date >= new Date('2023-05-01')).toBe(true);
        expect(date <= new Date('2023-12-31')).toBe(true);
      });
    });

    it('should handle pagination', async () => {
      // Add more documents for pagination test
      const moreDocuments = [];
      for (let i = 0; i < 25; i++) {
        const doc = TestDataBuilder.createDocument({
          identifier: `section-${i}`,
          title: `Test Section ${i}`,
          content: 'Common content for search'
        });
        moreDocuments.push(doc);
      }
      await Document.insertMany(moreDocuments);
      for (const doc of moreDocuments) {
        await esHelper.indexDocument(indexName, doc);
      }

      // First page
      const page1 = await request(app)
        .post('/api/search')
        .send({
          query: 'content',
          filters: {},
          from: 0,
          size: 10
        });

      expect(page1.status).toBe(200);
      expect(page1.body.results.length).toBe(10);
      
      // Second page
      const page2 = await request(app)
        .post('/api/search')
        .send({
          query: 'content',
          filters: {},
          from: 10,
          size: 10
        });

      expect(page2.status).toBe(200);
      expect(page2.body.results.length).toBe(10);
      
      // Ensure different results
      const page1Ids = page1.body.results.map(r => r.identifier);
      const page2Ids = page2.body.results.map(r => r.identifier);
      expect(page1Ids).not.toEqual(page2Ids);
    });

    it('should handle empty results', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({
          query: 'nonexistentterm12345',
          filters: {}
        });

      expect(response.status).toBe(200);
      expect(response.body.results).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('should highlight search terms', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({
          query: 'organization',
          filters: {},
          highlight: true
        });

      expect(response.status).toBe(200);
      expect(response.body.results[0].highlight).toBeDefined();
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({
          // Missing required 'query' field
          filters: {}
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should handle invalid date format', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({
          query: '*',
          filters: {
            dateRange: {
              start: 'invalid-date',
              end: '2023-12-31'
            }
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('date');
    });

    it('should handle Elasticsearch errors gracefully', async () => {
      // Temporarily break the ES client
      const originalSearch = esHelper.client.search;
      esHelper.client.search = jest.fn().mockRejectedValue(new Error('ES Error'));

      const response = await request(app)
        .post('/api/search')
        .send({
          query: 'test',
          filters: {}
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();

      esHelper.client.search = originalSearch;
    });

    it('should support wildcard searches', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({
          query: 'organ*',
          filters: {}
        });

      expect(response.status).toBe(200);
      expect(response.body.results.length).toBeGreaterThan(0);
    });

    it('should support phrase searches', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({
          query: '"uniform administrative"',
          filters: {}
        });

      expect(response.status).toBe(200);
      expect(response.body.results.length).toBeGreaterThan(0);
      expect(response.body.results[0].content).toContain('uniform administrative');
    });
  });

  describe('GET /api/search/suggest', () => {
    beforeEach(async () => {
      await Document.insertMany(sampleDocuments);
      for (const doc of sampleDocuments) {
        await esHelper.indexDocument(indexName, doc);
      }
    });

    it('should provide search suggestions', async () => {
      const response = await request(app)
        .get('/api/search/suggest')
        .query({ q: 'org' });

      expect(response.status).toBe(200);
      expect(response.body.suggestions).toBeDefined();
      expect(Array.isArray(response.body.suggestions)).toBe(true);
    });

    it('should require query parameter', async () => {
      const response = await request(app)
        .get('/api/search/suggest');

      expect(response.status).toBe(400);
    });
  });
});