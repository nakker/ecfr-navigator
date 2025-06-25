// MongoDB Schema Initialization Script - Simplified version
// This script runs when MongoDB container is first created

// Switch to the ecfr database
db = db.getSiblingDB(process.env.MONGO_INITDB_DATABASE || 'ecfr_db');

// Create collections WITHOUT strict validation
db.createCollection('titles');
db.createCollection('documents');
db.createCollection('metrics');
db.createCollection('versionHistory');

// Create indexes for better query performance
db.titles.createIndex({ number: 1 }, { unique: true });
db.titles.createIndex({ lastDownloaded: 1 });
db.titles.createIndex({ upToDateAsOf: 1 });

db.documents.createIndex({ titleNumber: 1, type: 1 });
db.documents.createIndex({ titleNumber: 1, identifier: 1 }, { unique: true });
db.documents.createIndex({ '$**': 'text' }); // Full-text search index

db.metrics.createIndex({ titleNumber: 1, analysisDate: -1 });
db.versionHistory.createIndex({ titleNumber: 1 }, { unique: true });

// Create a user for the application with limited privileges
db.createUser({
  user: 'ecfr_app',
  pwd: 'ecfr_app_password_2024',
  roles: [
    {
      role: 'readWrite',
      db: process.env.MONGO_INITDB_DATABASE || 'ecfr_db'
    }
  ]
});

print('MongoDB schema initialization completed successfully (without validation)');