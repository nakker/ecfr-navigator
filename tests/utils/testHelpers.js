const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const { Client } = require('@elastic/elasticsearch');

// Test data builders
class TestDataBuilder {
  static createTitle(overrides = {}) {
    return {
      titleNumber: 1,
      name: 'Test Title',
      xmlUrl: 'https://example.com/test.xml',
      xmlContent: '<test>content</test>',
      checksum: 'abc123',
      lastDownloaded: new Date(),
      downloadStatus: 'completed',
      ...overrides
    };
  }

  static createDocument(overrides = {}) {
    return {
      titleNumber: 1,
      identifier: 'test-doc-1',
      type: 'part',
      heading: 'Test Document',
      content: 'This is test content for analysis.',
      part: '1',
      effectiveDate: new Date(),
      lastModified: new Date(),
      ...overrides
    };
  }

  static createMetric(overrides = {}) {
    return {
      titleNumber: 1,
      type: 'title',
      identifier: null,
      metrics: {
        totalSections: 10,
        totalWords: 1000,
        averageWordsPerSection: 100,
        complexityScore: 0.5,
        readabilityScore: 60,
        lastUpdated: new Date()
      },
      calculatedAt: new Date(),
      ...overrides
    };
  }

  static createSectionAnalysis(overrides = {}) {
    return {
      titleNumber: 1,
      sectionIdentifier: 'section-1',
      analysis: {
        summary: 'Test summary',
        keyRequirements: ['Requirement 1', 'Requirement 2'],
        complianceSteps: ['Step 1', 'Step 2'],
        potentialIssues: ['Issue 1'],
        relatedSections: ['section-2']
      },
      modelUsed: 'test-model',
      analyzedAt: new Date(),
      ...overrides
    };
  }
}

// Database helpers
class DatabaseHelper {
  static async connectMongo(uri) {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    return mongoose.connection;
  }

  static async clearDatabase() {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }

  static async seedDatabase(model, data) {
    return await model.insertMany(data);
  }
}

// Elasticsearch helpers
class ElasticsearchHelper {
  constructor() {
    this.client = null;
  }

  async connect(host = 'localhost', port = 9200) {
    this.client = new Client({
      node: `http://${host}:${port}`,
      maxRetries: 5,
      requestTimeout: 60000
    });
    
    // Wait for ES to be ready
    await this.waitForElasticsearch();
    return this.client;
  }

  async waitForElasticsearch(maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await this.client.ping();
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw new Error('Elasticsearch failed to start');
  }

  async createIndex(indexName, mappings = {}) {
    const exists = await this.client.indices.exists({ index: indexName });
    if (!exists) {
      await this.client.indices.create({
        index: indexName,
        body: { mappings }
      });
    }
  }

  async deleteIndex(indexName) {
    const exists = await this.client.indices.exists({ index: indexName });
    if (exists) {
      await this.client.indices.delete({ index: indexName });
    }
  }

  async indexDocument(indexName, document) {
    return await this.client.index({
      index: indexName,
      body: document,
      refresh: true
    });
  }

  async search(indexName, query) {
    return await this.client.search({
      index: indexName,
      body: query
    });
  }
}

// API test helpers
class ApiTestHelper {
  static createMockRequest(overrides = {}) {
    return {
      body: {},
      query: {},
      params: {},
      headers: {},
      ...overrides
    };
  }

  static createMockResponse() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.set = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    return res;
  }

  static createMockNext() {
    return jest.fn();
  }
}

// Test database setup/teardown helpers
async function setupTestDatabase() {
  const mongoUri = `mongodb://${process.env.MONGO_ROOT_USERNAME}:${process.env.MONGO_ROOT_PASSWORD}@localhost:27017/${process.env.MONGO_DATABASE}?authSource=admin`;
  
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  }
}

async function teardownTestDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

// Wait helper
function waitFor(condition, timeout = 5000, interval = 100) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkCondition = async () => {
      try {
        const result = await condition();
        if (result) {
          resolve(result);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for condition'));
        } else {
          setTimeout(checkCondition, interval);
        }
      } catch (error) {
        if (Date.now() - startTime > timeout) {
          reject(error);
        } else {
          setTimeout(checkCondition, interval);
        }
      }
    };
    
    checkCondition();
  });
}

module.exports = {
  TestDataBuilder,
  DatabaseHelper,
  ElasticsearchHelper,
  ApiTestHelper,
  waitFor,
  setupTestDatabase,
  teardownTestDatabase
};