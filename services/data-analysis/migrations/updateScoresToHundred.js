require('dotenv').config();
const mongoose = require('mongoose');
const SectionAnalysis = require('../shared/models/SectionAnalysis');
const logger = require('../shared/utils/logger');

async function migrateScores() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    logger.info('Connected to MongoDB for migration');

    // First, check if we have any documents with scores in 1-10 range
    const documentsToMigrate = await SectionAnalysis.countDocuments({
      $or: [
        { antiquatedScore: { $lte: 10 } },
        { businessUnfriendlyScore: { $lte: 10 } }
      ]
    });

    if (documentsToMigrate === 0) {
      logger.info('No documents found with scores in 1-10 range. Migration not needed.');
      await mongoose.disconnect();
      return;
    }

    logger.info(`Found ${documentsToMigrate} documents to migrate from 1-10 to 1-100 scale`);

    // Update antiquatedScore (multiply by 10)
    const antiquatedResult = await SectionAnalysis.updateMany(
      { antiquatedScore: { $lte: 10 } },
      [
        {
          $set: {
            antiquatedScore: { $multiply: ['$antiquatedScore', 10] }
          }
        }
      ]
    );

    logger.info(`Updated ${antiquatedResult.modifiedCount} documents with antiquatedScore`);

    // Update businessUnfriendlyScore (multiply by 10)
    const businessResult = await SectionAnalysis.updateMany(
      { businessUnfriendlyScore: { $lte: 10 } },
      [
        {
          $set: {
            businessUnfriendlyScore: { $multiply: ['$businessUnfriendlyScore', 10] }
          }
        }
      ]
    );

    logger.info(`Updated ${businessResult.modifiedCount} documents with businessUnfriendlyScore`);

    // Verify the migration
    const verifyCount = await SectionAnalysis.countDocuments({
      $or: [
        { antiquatedScore: { $lte: 10 } },
        { businessUnfriendlyScore: { $lte: 10 } }
      ]
    });

    if (verifyCount === 0) {
      logger.info('Migration completed successfully! All scores have been updated to 1-100 scale.');
    } else {
      logger.warn(`Migration may be incomplete. Still found ${verifyCount} documents with scores <= 10`);
    }

    // Show some sample data
    const samples = await SectionAnalysis.find({})
      .limit(5)
      .select('sectionIdentifier antiquatedScore businessUnfriendlyScore');
    
    logger.info('Sample migrated data:');
    samples.forEach(sample => {
      logger.info(`Section ${sample.sectionIdentifier}: Antiquated=${sample.antiquatedScore}, BusinessUnfriendly=${sample.businessUnfriendlyScore}`);
    });

  } catch (error) {
    logger.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run the migration
migrateScores();