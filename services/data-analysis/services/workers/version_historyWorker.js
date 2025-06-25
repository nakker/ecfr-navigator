const { parentPort, workerData } = require('worker_threads');
const mongoose = require('mongoose');
const axios = require('axios');
const Title = require('../../shared/models/Title');
const VersionHistory = require('../../shared/models/VersionHistory');
const AnalysisThread = require('../../shared/models/AnalysisThread');

let isRunning = true;
let currentTitleIndex = 0;
const versionApiUrl = 'https://www.ecfr.gov/api/versioner/v1/versions';

// Handle stop command
parentPort.on('message', (message) => {
  if (message.command === 'stop') {
    isRunning = false;
  }
});

async function fetchVersionHistory(titleNumber) {
  try {
    const url = `${versionApiUrl}/title-${titleNumber}.json`;
    const response = await axios.get(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 30000
    });

    const contentVersions = response.data.content_versions || [];
    
    // Store ALL versions, not just the latest per section
    // This gives us the complete history of amendments
    const versions = contentVersions
      .filter(v => !v.removed && v.amendment_date)
      .map(v => ({
        date: new Date(v.amendment_date),
        identifier: v.identifier || '',
        name: v.name || '',
        part: v.part || '',
        type: v.type || ''
      }));
    
    // Ensure versions is a proper array
    if (!Array.isArray(versions)) {
      throw new Error('Versions must be an array');
    }

    // Debug log to check data structure
    if (titleNumber === 1 && versions.length > 0) {
      console.log(`Title ${titleNumber} - First version sample:`, JSON.stringify(versions[0], null, 2));
      console.log(`Title ${titleNumber} - Total versions:`, versions.length);
    }

    // Save to database
    const result = await VersionHistory.findOneAndUpdate(
      { titleNumber },
      {
        $set: {
          titleNumber,
          lastUpdated: new Date(),
          versions: versions
        }
      },
      { upsert: true, new: true }
    );

    return contentVersions.length;
  } catch (error) {
    console.error(`Error details for title ${titleNumber}:`, error);
    if (error.response) {
      console.error('API Response status:', error.response.status);
      console.error('API Response data:', error.response.data);
    }
    throw new Error(`Failed to fetch version history: ${error.message}`);
  }
}

async function run() {
  try {
    // Connect to MongoDB
    await mongoose.connect(workerData.mongoUri);
    
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
              description: 'Fetching version history from eCFR API'
            },
            resumeData: { lastTitleIndex: i }
          }
        });

        // Fetch version history
        const versionCount = await fetchVersionHistory(title.number);
        console.log(`Fetched ${versionCount} versions for title ${title.number}`);
        
        processedCount++;
        
      } catch (error) {
        console.error(`Failed to fetch version history for title ${title.number}:`, error);
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

      // Add delay to avoid rate limiting
      if (isRunning) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
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