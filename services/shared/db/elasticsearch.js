const { Client } = require('@elastic/elasticsearch');
const logger = require('../utils/logger');

let client = null;

const connect = async (host) => {
  if (client) {
    return client;
  }

  try {
    client = new Client({
      node: host,
      auth: null // No authentication for development
    });

    // Test connection
    const health = await client.cluster.health();
    logger.info('Elasticsearch connected successfully', { status: health.status });

    // Create index if it doesn't exist
    const indexName = 'ecfr_documents';
    const indexExists = await client.indices.exists({ index: indexName });
    
    if (!indexExists) {
      const mapping = {
        mappings: {
          properties: {
            titleNumber: { type: 'integer' },
            titleName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            documentType: { type: 'keyword' },
            identifier: { type: 'keyword' },
            chapter: { type: 'keyword' },
            part: { type: 'keyword' },
            subpart: { type: 'keyword' },
            section: { type: 'keyword' },
            heading: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            content: { type: 'text' },
            effectiveDate: { type: 'date' },
            lastModified: { type: 'date' }
          }
        }
      };
      await client.indices.create({
        index: indexName,
        body: mapping
      });
      logger.info('Created Elasticsearch index:', indexName);
    }

    return client;
  } catch (error) {
    logger.error('Failed to connect to Elasticsearch:', error);
    throw error;
  }
};

const disconnect = async () => {
  if (client) {
    await client.close();
    client = null;
    logger.info('Elasticsearch disconnected');
  }
};

const getClient = () => {
  if (!client) {
    throw new Error('Elasticsearch not connected. Call connect() first.');
  }
  return client;
};

const indexDocument = async (document) => {
  const client = getClient();
  const indexName = 'ecfr_documents';
  
  try {
    const response = await client.index({
      index: indexName,
      document: document,
      id: `${document.titleNumber}_${document.identifier}`
    });
    
    return response;
  } catch (error) {
    logger.error('Failed to index document:', error);
    throw error;
  }
};

const bulkIndex = async (documents) => {
  const client = getClient();
  const indexName = 'ecfr_documents';
  
  const operations = documents.flatMap(doc => [
    { index: { _index: indexName, _id: `${doc.titleNumber}_${doc.identifier}` } },
    doc
  ]);

  try {
    const response = await client.bulk({
      refresh: true,
      operations
    });
    
    if (response.errors) {
      const erroredDocuments = response.items.filter(item => item.index && item.index.error);
      logger.error('Bulk indexing errors:', erroredDocuments);
    }
    
    return response;
  } catch (error) {
    logger.error('Failed to bulk index documents:', error);
    throw error;
  }
};

const search = async (query) => {
  const client = getClient();
  const indexName = 'ecfr_documents';
  
  try {
    const response = await client.search({
      index: indexName,
      ...query
    });
    
    return response;
  } catch (error) {
    logger.error('Search failed:', error);
    throw error;
  }
};

const createIndex = async () => {
  const client = getClient();
  const indexName = 'ecfr_documents';
  
  try {
    const mapping = {
      mappings: {
        properties: {
          titleNumber: { type: 'integer' },
          titleName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          documentType: { type: 'keyword' },
          identifier: { type: 'keyword' },
          chapter: { type: 'keyword' },
          part: { type: 'keyword' },
          subpart: { type: 'keyword' },
          section: { type: 'keyword' },
          heading: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          content: { type: 'text' },
          effectiveDate: { type: 'date' },
          lastModified: { type: 'date' },
          source: { type: 'text' },
          authority: { type: 'text' },
          hierarchy: { type: 'text' }
        }
      }
    };
    
    await client.indices.create({
      index: indexName,
      body: mapping
    });
    
    logger.info('Created Elasticsearch index:', indexName);
    return true;
  } catch (error) {
    logger.error('Failed to create index:', error);
    throw error;
  }
};

module.exports = {
  connect,
  disconnect,
  getClient,
  indexDocument,
  bulkIndex,
  search,
  createIndex
};