const { parentPort, workerData } = require('worker_threads');
const mongoose = require('mongoose');
const { connectToMongoDB } = require('./mongoConnection');
const Title = require('../../shared/models/Title');
const Document = require('../../shared/models/Document');
const Metric = require('../../shared/models/Metric');
const AnalysisThread = require('../../shared/models/AnalysisThread');
const VersionHistory = require('../../shared/models/VersionHistory');

let isRunning = true;
let currentTitleIndex = 0;

// Handle stop command
parentPort.on('message', (message) => {
  if (message.command === 'stop') {
    isRunning = false;
  }
});

async function analyzeRegulationAges(versionHistory) {
  const now = new Date();
  const distribution = {
    lessThan1Year: 0,
    oneToFiveYears: 0,
    fiveToTenYears: 0,
    tenToTwentyYears: 0,
    moreThanTwentyYears: 0
  };

  if (!versionHistory || !versionHistory.versions) {
    return distribution;
  }

  // Use the versions array which contains unique sections with their latest amendment dates
  versionHistory.versions.forEach(version => {
    if (version.date) {
      const ageInYears = (now - new Date(version.date)) / (365 * 24 * 60 * 60 * 1000);
      
      if (ageInYears < 1) {
        distribution.lessThan1Year++;
      } else if (ageInYears < 5) {
        distribution.oneToFiveYears++;
      } else if (ageInYears < 10) {
        distribution.fiveToTenYears++;
      } else if (ageInYears < 20) {
        distribution.tenToTwentyYears++;
      } else {
        distribution.moreThanTwentyYears++;
      }
    }
  });

  return distribution;
}

async function run() {
  try {
    // Connect to MongoDB
    await connectToMongoDB(workerData.mongoUri, 'age_distribution');
    
    // Add a 1 second delay after connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const thread = await AnalysisThread.findOne({ threadType: workerData.threadType });
    
    // Get resume position if not restarting
    if (!workerData.restart && thread.resumeData) {
      currentTitleIndex = thread.resumeData.lastTitleIndex || 0;
    }

    // Get all titles
    const titles = await Title.find({}).select('number name').sort({ number: 1 });
    const totalTitles = titles.length;

    parentPort.postMessage({
      type: 'progress',
      data: {
        progress: { current: currentTitleIndex, total: totalTitles, percentage: 0 }
      }
    });

    let processedCount = 0;
    let failedCount = 0;
    const startTime = Date.now();

    for (let i = currentTitleIndex; i < titles.length && isRunning; i++) {
      const title = titles[i];
      
      try {
        // Update current item
        parentPort.postMessage({
          type: 'progress',
          data: {
            currentItem: {
              titleNumber: title.number,
              titleName: title.name,
              description: 'Analyzing regulation ages'
            },
            resumeData: { lastTitleIndex: i }
          }
        });

        // Get version history for this title
        const versionHistory = await VersionHistory.findOne({ titleNumber: title.number });
        
        if (versionHistory && versionHistory.versions && versionHistory.versions.length > 0) {
          // Analyze regulation ages
          const ageDistribution = await analyzeRegulationAges(versionHistory);
          
          // Find today's metric or create new one
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const existingMetric = await Metric.findOne({
            titleNumber: title.number,
            analysisDate: { $gte: today }
          });

          if (existingMetric) {
            // Update existing metric with age distribution
            await Metric.findOneAndUpdate(
              { _id: existingMetric._id },
              { 
                $set: { 
                  'metrics.regulationAgeDistribution': ageDistribution,
                  'analysisDate': new Date()
                }
              }
            );
            console.log(`Updated age distribution for title ${title.number}`);
          } else {
            // Create new metric with age distribution
            await Metric.create({
              titleNumber: title.number,
              analysisDate: new Date(),
              metrics: {
                regulationAgeDistribution: ageDistribution
              }
            });
            console.log(`Created new metric with age distribution for title ${title.number}`);
          }
        }

        processedCount++;
        
      } catch (error) {
        console.error(`Failed to analyze age distribution for title ${title.number}:`, error);
        failedCount++;
      }

      // Update progress
      const percentage = Math.round(((i + 1) / totalTitles) * 100);
      const avgTime = (Date.now() - startTime) / (i - currentTitleIndex + 1);
      
      parentPort.postMessage({
        type: 'progress',
        data: {
          progress: { current: i + 1, total: totalTitles, percentage },
          statistics: {
            itemsProcessed: processedCount,
            averageTimePerItem: avgTime
          }
        }
      });
    }

    // Send completion message
    if (isRunning) {
      parentPort.postMessage({
        type: 'completed',
        data: {
          total: processedCount,
          failedCount
        }
      });
    }

  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      error: error.message
    });
  } finally {
    await mongoose.disconnect();
  }
}

run();