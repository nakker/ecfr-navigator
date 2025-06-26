const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const stream = require('stream');
const logger = require('./logger');

let bucket = null;

// Initialize GridFS bucket
function initGridFS() {
  if (!bucket && mongoose.connection.db) {
    bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'documents'
    });
    logger.info('GridFS bucket initialized');
  }
  return bucket;
}

// Store large content in GridFS
async function storeInGridFS(content, filename, metadata = {}) {
  try {
    const gridFSBucket = initGridFS();
    if (!gridFSBucket) {
      throw new Error('GridFS bucket not initialized');
    }

    // Convert string to buffer
    const buffer = Buffer.from(content, 'utf8');
    
    // Create a readable stream from the buffer
    const readableStream = new stream.Readable();
    readableStream.push(buffer);
    readableStream.push(null);

    return new Promise((resolve, reject) => {
      const uploadStream = gridFSBucket.openUploadStream(filename, {
        metadata: metadata
      });

      uploadStream.on('error', reject);
      uploadStream.on('finish', () => {
        logger.debug(`Stored ${filename} in GridFS with id: ${uploadStream.id}`);
        resolve(uploadStream.id);
      });

      readableStream.pipe(uploadStream);
    });
  } catch (error) {
    logger.error('Error storing in GridFS:', error);
    throw error;
  }
}

// Retrieve content from GridFS
async function retrieveFromGridFS(fileId) {
  try {
    const gridFSBucket = initGridFS();
    if (!gridFSBucket) {
      throw new Error('GridFS bucket not initialized');
    }

    const chunks = [];
    const downloadStream = gridFSBucket.openDownloadStream(fileId);

    return new Promise((resolve, reject) => {
      downloadStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      downloadStream.on('error', reject);
      
      downloadStream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer.toString('utf8'));
      });
    });
  } catch (error) {
    logger.error('Error retrieving from GridFS:', error);
    throw error;
  }
}

// Delete file from GridFS
async function deleteFromGridFS(fileId) {
  try {
    const gridFSBucket = initGridFS();
    if (!gridFSBucket) {
      throw new Error('GridFS bucket not initialized');
    }

    await gridFSBucket.delete(fileId);
    logger.debug(`Deleted file ${fileId} from GridFS`);
  } catch (error) {
    logger.error('Error deleting from GridFS:', error);
    throw error;
  }
}

// Check if content should be stored in GridFS (> 15MB to leave some margin)
function shouldUseGridFS(content) {
  const sizeInBytes = Buffer.byteLength(content, 'utf8');
  return sizeInBytes > 15 * 1024 * 1024; // 15MB threshold
}

module.exports = {
  initGridFS,
  storeInGridFS,
  retrieveFromGridFS,
  deleteFromGridFS,
  shouldUseGridFS
};