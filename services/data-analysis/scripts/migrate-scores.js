const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || `mongodb://${process.env.MONGO_ROOT_USERNAME}:${process.env.MONGO_ROOT_PASSWORD}@mongo:27017/${process.env.MONGO_DATABASE}?authSource=admin`;

async function migrateScores() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Get the SectionAnalysis model
    const SectionAnalysis = require('../shared/models/SectionAnalysis');

    // Count documents that need updating
    const countToUpdate = await SectionAnalysis.countDocuments({
      $or: [
        { antiquatedScore: { $lte: 9 } },
        { businessUnfriendlyScore: { $lte: 9 } }
      ]
    });

    console.log(`Found ${countToUpdate} documents that need score migration`);

    if (countToUpdate === 0) {
      console.log('No documents need updating. Migration may have already been completed.');
      return;
    }

    // Update antiquatedScore for all documents where it's <= 9
    const antiquatedResult = await SectionAnalysis.updateMany(
      { antiquatedScore: { $lte: 9 } },
      [
        {
          $set: {
            antiquatedScore: { $multiply: ['$antiquatedScore', 10] }
          }
        }
      ]
    );

    console.log(`Updated ${antiquatedResult.modifiedCount} documents with antiquatedScore <= 9`);

    // Update businessUnfriendlyScore for all documents where it's <= 9
    const businessResult = await SectionAnalysis.updateMany(
      { businessUnfriendlyScore: { $lte: 9 } },
      [
        {
          $set: {
            businessUnfriendlyScore: { $multiply: ['$businessUnfriendlyScore', 10] }
          }
        }
      ]
    );

    console.log(`Updated ${businessResult.modifiedCount} documents with businessUnfriendlyScore <= 9`);

    // Verify the migration
    const verifyCount = await SectionAnalysis.countDocuments({
      $or: [
        { antiquatedScore: { $lte: 9 } },
        { businessUnfriendlyScore: { $lte: 9 } }
      ]
    });

    if (verifyCount === 0) {
      console.log('Migration completed successfully! All scores have been updated.');
    } else {
      console.log(`Warning: ${verifyCount} documents still have scores <= 9`);
    }

    // Show some statistics
    const stats = await SectionAnalysis.aggregate([
      {
        $group: {
          _id: null,
          minAntiquated: { $min: '$antiquatedScore' },
          maxAntiquated: { $max: '$antiquatedScore' },
          avgAntiquated: { $avg: '$antiquatedScore' },
          minBusiness: { $min: '$businessUnfriendlyScore' },
          maxBusiness: { $max: '$businessUnfriendlyScore' },
          avgBusiness: { $avg: '$businessUnfriendlyScore' },
          totalDocs: { $sum: 1 }
        }
      }
    ]);

    if (stats.length > 0) {
      console.log('\nPost-migration statistics:');
      console.log(`Total documents: ${stats[0].totalDocs}`);
      console.log(`Antiquated scores - Min: ${stats[0].minAntiquated}, Max: ${stats[0].maxAntiquated}, Avg: ${stats[0].avgAntiquated.toFixed(1)}`);
      console.log(`Business unfriendly scores - Min: ${stats[0].minBusiness}, Max: ${stats[0].maxBusiness}, Avg: ${stats[0].avgBusiness.toFixed(1)}`);
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the migration
migrateScores();