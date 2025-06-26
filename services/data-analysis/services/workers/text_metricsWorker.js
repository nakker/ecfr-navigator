const { parentPort, workerData } = require('worker_threads');
const mongoose = require('mongoose');
const { connectToMongoDB } = require('./mongoConnection');
const Title = require('../../shared/models/Title');
const Document = require('../../shared/models/Document');
const Metric = require('../../shared/models/Metric');
const AnalysisThread = require('../../shared/models/AnalysisThread');
const TextAnalyzer = require('../TextAnalyzer');
const { initGridFS, retrieveFromGridFS } = require('../../shared/utils/gridfs');

let isRunning = true;
let currentTitleIndex = 0;

// Handle stop command
parentPort.on('message', (message) => {
  if (message.command === 'stop') {
    isRunning = false;
  }
});

async function run() {
  try {
    // Connect to MongoDB with better error handling
    await connectToMongoDB(workerData.mongoUri, 'text_metrics');
    
    // Wait a bit to ensure connection is stable
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Initialize GridFS
    initGridFS();
    
    const textAnalyzer = new TextAnalyzer();
    
    // Retry logic for database queries
    let thread;
    let retries = 3;
    while (retries > 0) {
      try {
        thread = await AnalysisThread.findOne({ threadType: workerData.threadType });
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        console.log(`Retrying AnalysisThread query, ${retries} attempts left...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Get resume position if not restarting
    if (!workerData.restart && thread && thread.resumeData) {
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
              description: 'Calculating text metrics'
            },
            resumeData: { lastTitleIndex: i }
          }
        });

        // Get only the title document which contains the full XML content
        const titleDocument = await Document.findOne({ 
          titleNumber: title.number,
          type: 'title'
        }).select('content contentGridFS');
        
        if (titleDocument) {
          let fullText = '';
          
          // Check if content is in GridFS
          if (titleDocument.contentGridFS) {
            try {
              fullText = await retrieveFromGridFS(titleDocument.contentGridFS);
            } catch (error) {
              console.error(`Failed to retrieve GridFS content for title ${title.number}:`, error);
              failedCount++;
              continue;
            }
          } else if (titleDocument.content) {
            fullText = titleDocument.content;
          } else {
            console.log(`No content found for title ${title.number}`);
            continue;
          }
          
          // Perform text analysis
          const wordCount = textAnalyzer.countWords(fullText);
          const keywordFrequency = await textAnalyzer.analyzeKeywords(fullText);
          const complexityScore = await textAnalyzer.calculateComplexity(fullText);
          const readabilityScore = await textAnalyzer.calculateReadability(fullText);
          const avgSentenceLength = textAnalyzer.getAverageSentenceLength(fullText);
          
          // Debug logging
          if (title.number === 1) {
            console.log('Title 1 keyword frequency analysis result:', keywordFrequency);
          }
          
          // Log word count for debugging
          console.log(`Title ${title.number}: ${wordCount} words from title document`);
          
          // Find the most recent metric for this title
          const existingMetric = await Metric.findOne({
            titleNumber: title.number
          }).sort({ analysisDate: -1 });

          const newMetrics = {
            wordCount,
            keywordFrequency,
            complexityScore,
            averageSentenceLength: avgSentenceLength,
            readabilityScore
          };

          if (!existingMetric) {
            // Create new metrics
            await Metric.create({
              titleNumber: title.number,
              analysisDate: new Date(),
              metrics: newMetrics
            });
          } else {
            // Always create a new metric entry for historical tracking
            await Metric.create({
              titleNumber: title.number,
              analysisDate: new Date(),
              metrics: newMetrics
            });
          }
        }

        processedCount++;
        
      } catch (error) {
        console.error(`Failed to analyze title ${title.number}:`, error);
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
      
      // Log progress every 10%
      if (percentage % 10 === 0 || i === totalTitles - 1) {
        console.log(`Text metrics progress: ${percentage}% (${i + 1}/${totalTitles})`);
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