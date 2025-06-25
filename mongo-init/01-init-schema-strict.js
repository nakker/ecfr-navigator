// MongoDB Schema Initialization Script
// This script runs when MongoDB container is first created

// Switch to the ecfr database
db = db.getSiblingDB(process.env.MONGO_INITDB_DATABASE || 'ecfr_db');

// Create collections with validation schemas
db.createCollection('titles', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['number', 'name', 'checksum', 'lastDownloaded'],
      properties: {
        number: {
          bsonType: ['int', 'number'],
          minimum: 1,
          maximum: 50,
          description: 'Title number (1-50)'
        },
        name: {
          bsonType: 'string',
          description: 'Title name'
        },
        latestAmendedOn: {
          bsonType: 'date',
          description: 'Date of latest amendment'
        },
        latestIssueDate: {
          bsonType: 'date',
          description: 'Latest issue date'
        },
        upToDateAsOf: {
          bsonType: 'date',
          description: 'Data current as of this date'
        },
        reserved: {
          bsonType: 'bool',
          description: 'Whether title is reserved'
        },
        checksum: {
          bsonType: 'string',
          description: 'SHA256 checksum of downloaded XML'
        },
        lastDownloaded: {
          bsonType: 'date',
          description: 'When the XML was last downloaded'
        },
        lastAnalyzed: {
          bsonType: 'date',
          description: 'When the title was last analyzed'
        },
        xmlContent: {
          bsonType: 'string',
          description: 'Compressed XML content'
        }
      }
    }
  }
});

db.createCollection('documents', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['titleNumber', 'type', 'identifier', 'content'],
      properties: {
        titleNumber: {
          bsonType: ['int', 'number'],
          minimum: 1,
          maximum: 50,
          description: 'Parent title number'
        },
        type: {
          enum: ['title', 'subtitle', 'chapter', 'subchapter', 'part', 'subpart', 'subjectgroup', 'section', 'appendix'],
          description: 'Document type'
        },
        identifier: {
          bsonType: 'string',
          description: 'Unique identifier (e.g., part number, section number)'
        },
        node: {
          bsonType: ['string', 'null'],
          description: 'NODE attribute from XML'
        },
        subtitle: {
          bsonType: ['string', 'null'],
          description: 'Subtitle identifier'
        },
        chapter: {
          bsonType: ['string', 'null'],
          description: 'Chapter identifier'
        },
        subchapter: {
          bsonType: ['string', 'null'],
          description: 'Subchapter identifier'
        },
        part: {
          bsonType: ['string', 'null'],
          description: 'Part identifier'
        },
        subpart: {
          bsonType: ['string', 'null'],
          description: 'Subpart identifier'
        },
        subjectGroup: {
          bsonType: ['string', 'null'],
          description: 'Subject group identifier'
        },
        section: {
          bsonType: ['string', 'null'],
          description: 'Section identifier'
        },
        heading: {
          bsonType: ['string', 'null'],
          description: 'Document heading/title'
        },
        authority: {
          bsonType: ['string', 'null'],
          description: 'Authority statement'
        },
        source: {
          bsonType: ['string', 'null'],
          description: 'Source statement'
        },
        structuredContent: {
          bsonType: ['object', 'null'],
          description: 'Structured content preserving XML elements'
        },
        content: {
          bsonType: 'string',
          description: 'Document text content'
        },
        citations: {
          bsonType: ['array', 'null'],
          items: {
            bsonType: 'object',
            properties: {
              text: { bsonType: 'string' },
              type: { bsonType: 'string' }
            }
          }
        },
        editorialNotes: {
          bsonType: ['array', 'null'],
          items: {
            bsonType: 'object',
            properties: {
              heading: { bsonType: 'string' },
              content: { bsonType: 'string' }
            }
          }
        },
        images: {
          bsonType: ['array', 'null'],
          items: {
            bsonType: 'object',
            properties: {
              src: { bsonType: 'string' },
              alt: { bsonType: ['string', 'null'] },
              pdfLink: { bsonType: ['string', 'null'] }
            }
          }
        },
        effectiveDate: {
          bsonType: ['date', 'null'],
          description: 'When this regulation became effective'
        },
        amendmentDate: {
          bsonType: ['date', 'null'],
          description: 'Amendment date from AMDDATE'
        },
        lastModified: {
          bsonType: 'date',
          description: 'Last modification date'
        },
        createdAt: {
          bsonType: ['date', 'null'],
          description: 'Mongoose created timestamp'
        },
        updatedAt: {
          bsonType: ['date', 'null'],
          description: 'Mongoose updated timestamp'
        }
      }
    }
  }
});

db.createCollection('metrics', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['titleNumber', 'analysisDate', 'metrics'],
      properties: {
        titleNumber: {
          bsonType: ['int', 'number'],
          minimum: 1,
          maximum: 50,
          description: 'Title number this metric belongs to'
        },
        analysisDate: {
          bsonType: 'date',
          description: 'When this analysis was performed'
        },
        metrics: {
          bsonType: 'object',
          properties: {
            wordCount: {
              bsonType: ['int', 'number'],
              description: 'Total word count'
            },
            regulationAgeDistribution: {
              bsonType: 'object',
              description: 'Age distribution of regulations'
            },
            keywordFrequency: {
              bsonType: 'object',
              description: 'Frequency of regulatory keywords'
            },
            complexityScore: {
              bsonType: 'double',
              description: 'Custom complexity metric'
            },
            averageSentenceLength: {
              bsonType: 'double',
              description: 'Average sentence length'
            },
            readabilityScore: {
              bsonType: 'double',
              description: 'Flesch reading ease score'
            }
          }
        }
      }
    }
  }
});

db.createCollection('versionHistory', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['titleNumber', 'versions'],
      properties: {
        titleNumber: {
          bsonType: ['int', 'number'],
          minimum: 1,
          maximum: 50,
          description: 'Title number'
        },
        lastUpdated: {
          bsonType: 'date',
          description: 'When version history was last fetched'
        },
        versions: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            properties: {
              date: {
                bsonType: 'date',
                description: 'Version date'
              },
              federalRegisterCitation: {
                bsonType: 'string',
                description: 'Federal Register citation'
              },
              description: {
                bsonType: 'string',
                description: 'Description of changes'
              }
            }
          }
        }
      }
    }
  }
});

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

print('MongoDB schema initialization completed successfully');