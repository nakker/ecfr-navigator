const { parentPort, workerData } = require('worker_threads');
const mongoose = require('mongoose');
const { connectToMongoDB } = require('./mongoConnection');
const Title = require('../../shared/models/Title');
const Document = require('../../shared/models/Document');
const SectionAnalysis = require('../../shared/models/SectionAnalysis');
const AnalysisThread = require('../../shared/models/AnalysisThread');
const grokService = require('../grok');

let isRunning = true;
let currentSectionIndex = 0;

// Handle stop command
parentPort.on('message', (message) => {
  if (message.command === 'stop') {
    isRunning = false;
  }
});

async function analyzeSectionWithGrok(section) {
  // Ensure we have content
  if (!section.content || section.content.trim().length === 0) {
    throw new Error('Section has no content to analyze');
  }
  
  // Limit content to avoid token limits
  const truncatedContent = section.content.substring(0, 2000);
  const heading = section.heading || section.identifier || 'Unknown Section';
  
  // Build prompts using environment variables with proper placeholder replacement
  const buildPrompt = (template, heading, content) => {
    // Handle escaped newlines in environment variables
    const processedTemplate = template.replace(/\\n/g, '\n');
    // Replace placeholders
    return processedTemplate
      .replace('{heading}', heading)
      .replace('{content}', content);
  };

  const prompts = {
    summary: buildPrompt(
      process.env.ANALYSIS_PROMPT_SUMMARY || 
      `Read the following regulatory section and provide a one-sentence summary that captures its main requirement or purpose. Be concise and specific.\n\nSection Title: {heading}\n\nSection Content:\n{content}\n\nProvide only the one-sentence summary, nothing else.`,
      heading,
      truncatedContent
    ),
    
    antiquatedScore: buildPrompt(
      process.env.ANALYSIS_PROMPT_ANTIQUATED ||
      `Analyze the following regulatory section and rate how antiquated or out-of-date the language and subject matter is on a scale of 1 to 100.\n\n1-20 = Very modern, current language and concepts\n21-40 = Mostly current with minor outdated elements\n41-60 = Moderately outdated\n61-80 = Significantly outdated\n81-100 = Extremely antiquated, uses obsolete terminology or addresses outdated practices\n\nConsider factors like:\n- References to outdated technology or practices\n- Use of archaic legal language\n- Relevance to modern business practices\n- Whether the concepts addressed are still applicable today\n\nSection Title: {heading}\n\nSection Content:\n{content}\n\nYour response must be exactly one number between 1 and 100. Do not include any explanation or other text.`,
      heading,
      truncatedContent
    ),
    
    businessUnfriendlyScore: buildPrompt(
      process.env.ANALYSIS_PROMPT_BUSINESS_UNFRIENDLY ||
      `Analyze the following regulatory section and rate how unfriendly or burdensome it is to businesses on a scale of 1 to 100.\n\n1-20 = Very business-friendly, minimal burden\n21-40 = Light burden, manageable compliance\n41-60 = Moderate regulatory burden, reasonable requirements\n61-80 = Significant burden\n81-100 = Extremely burdensome, costly or complex compliance requirements\n\nConsider factors like:\n- Compliance costs and complexity\n- Reporting or documentation requirements\n- Restrictions on business operations\n- Penalties or enforcement provisions\n- Administrative burden\n\nSection Title: {heading}\n\nSection Content:\n{content}\n\nYour response must be exactly one number between 1 and 100. Do not include any explanation or other text.`,
      heading,
      truncatedContent
    )
  };

  const results = {};
  
  for (const [key, prompt] of Object.entries(prompts)) {
    try {
      const response = await grokService.generateContent(prompt, {
        temperature: 0.3,
        maxOutputTokens: parseInt(process.env.ANALYSIS_MAX_TOKENS) || 800
      });
      
      if (key === 'summary') {
        results.summary = response.trim();
      } else {
        // Extract score from first line
        const lines = response.split('\n');
        const scoreStr = lines[0].trim();
        const score = parseInt(scoreStr);
        
        if (!isNaN(score) && score >= 1 && score <= 100) {
          results[key] = score;
          results[`${key.replace('Score', '')}Explanation`] = lines.slice(1).join('\n').trim() || 'No explanation provided';
        } else {
          // Fallback: try to extract any number from the response
          const numberMatch = response.match(/\b([1-9][0-9]?|100)\b/);
          if (numberMatch) {
            results[key] = parseInt(numberMatch[1]);
            results[`${key.replace('Score', '')}Explanation`] = response;
          } else {
            // Default to middle score if parsing fails
            results[key] = 50;
            results[`${key.replace('Score', '')}Explanation`] = `Could not parse score. Original response: ${response}`;
          }
        }
      }
    } catch (error) {
      console.error(`Failed to analyze ${key} for section:`, error);
      if (key === 'summary') {
        results.summary = 'Analysis failed';
      } else {
        results[key] = 50; // Default middle score on error
        results[`${key.replace('Score', '')}Explanation`] = `Analysis failed: ${error.message}`;
      }
    }
  }
  
  return results;
}

async function run() {
  try {
    // Connect to MongoDB
    await connectToMongoDB(workerData.mongoUri, 'section_analysis');
    
    // Add a 1 second delay after connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const thread = await AnalysisThread.findOne({ threadType: workerData.threadType });
    
    // Get sections to analyze
    let sectionsQuery = { type: 'section' };
    
    // Get resume position if not restarting
    if (!workerData.restart && thread.resumeData) {
      currentSectionIndex = thread.resumeData.lastSectionIndex || 0;
      if (thread.resumeData.lastSectionId) {
        // Ensure lastSectionId is a proper ObjectId
        const ObjectId = mongoose.Types.ObjectId;
        try {
          let lastIdStr;
          
          // Handle various formats of stored lastSectionId
          if (typeof thread.resumeData.lastSectionId === 'string') {
            lastIdStr = thread.resumeData.lastSectionId;
          } else if (thread.resumeData.lastSectionId._id) {
            // Handle case where entire document was stored
            lastIdStr = thread.resumeData.lastSectionId._id.toString();
          } else if (thread.resumeData.lastSectionId.buffer) {
            // Handle corrupted Binary object - reset
            console.error('Corrupted lastSectionId (Binary object), resetting to start');
            currentSectionIndex = 0;
            // Clear corrupted resume data
            await AnalysisThread.findByIdAndUpdate(thread._id, {
              'resumeData.lastSectionId': null,
              'resumeData.lastSectionIndex': 0
            });
          } else {
            lastIdStr = thread.resumeData.lastSectionId.toString();
          }
          
          if (lastIdStr) {
            const lastId = new ObjectId(lastIdStr);
            sectionsQuery._id = { $gte: lastId };
          }
        } catch (err) {
          console.error('Invalid lastSectionId, starting from beginning:', err);
          currentSectionIndex = 0;
          // Clear corrupted resume data
          await AnalysisThread.findByIdAndUpdate(thread._id, {
            'resumeData.lastSectionId': null,
            'resumeData.lastSectionIndex': 0
          });
        }
      }
    }

    // Get total count for progress
    const totalSections = await Document.countDocuments({ type: 'section' });
    
    // Create cursor for streaming
    const cursor = Document.find(sectionsQuery)
      .select('_id titleNumber identifier heading content')
      .sort({ _id: 1 })
      .cursor();

    parentPort.postMessage({
      type: 'progress',
      data: {
        progress: { current: currentSectionIndex, total: totalSections, percentage: 0 }
      }
    });

    let processedCount = 0;
    let failedCount = 0;
    let skipCount = currentSectionIndex;
    const startTime = Date.now();
    const batchSize = parseInt(process.env.ANALYSIS_BATCH_SIZE) || 5;
    const rateLimit = parseInt(process.env.ANALYSIS_RATE_LIMIT) || 15; // requests per minute
    const delayBetweenBatches = (60 * 1000) / rateLimit;
    
    let batch = [];

    for await (const section of cursor) {
      if (!isRunning) break;
      
      // Skip already processed sections when resuming
      if (skipCount > 0) {
        skipCount--;
        continue;
      }

      batch.push(section);
      
      if (batch.length >= batchSize || !cursor.next) {
        // Process batch
        const batchPromises = batch.map(async (sec) => {
          try {
            // Check if already analyzed
            const existing = await SectionAnalysis.findOne({
              documentId: sec._id,
              analysisVersion: '1.0'
            });
            
            if (existing && !workerData.restart) {
              return { success: true, skipped: true };
            }

            // Update current item
            parentPort.postMessage({
              type: 'progress',
              data: {
                currentItem: {
                  titleNumber: sec.titleNumber,
                  description: `Analyzing section ${sec.identifier}`,
                },
                resumeData: { 
                  lastSectionIndex: currentSectionIndex + processedCount,
                  lastSectionId: sec._id.toString() // Convert to string for proper serialization
                }
              }
            });

            // Analyze with Grok
            const analysis = await analyzeSectionWithGrok(sec);
            
            // Save analysis
            await SectionAnalysis.findOneAndUpdate(
              { documentId: sec._id },
              {
                documentId: sec._id,
                titleNumber: sec.titleNumber,
                sectionIdentifier: sec.identifier,
                analysisDate: new Date(),
                analysisVersion: '1.0',
                summary: analysis.summary,
                antiquatedScore: analysis.antiquatedScore,
                antiquatedExplanation: analysis.antiquatedExplanation,
                businessUnfriendlyScore: analysis.businessUnfriendlyScore,
                businessUnfriendlyExplanation: analysis.businessUnfriendlyExplanation,
                metadata: {
                  model: process.env.ANALYSIS_MODEL || 'grok-3-mini',
                  temperature: 0.3
                }
              },
              { upsert: true }
            );
            
            return { success: true };
            
          } catch (error) {
            console.error(`Failed to analyze section ${sec.identifier}:`, error);
            return { success: false, error };
          }
        });

        const results = await Promise.all(batchPromises);
        
        results.forEach(result => {
          if (result.success && !result.skipped) {
            processedCount++;
          } else if (!result.success) {
            failedCount++;
          }
        });

        // Update progress
        const currentProgress = currentSectionIndex + processedCount + failedCount;
        const percentage = Math.round((currentProgress / totalSections) * 100);
        const avgTime = (Date.now() - startTime) / (processedCount || 1);
        
        parentPort.postMessage({
          type: 'progress',
          data: {
            progress: { current: currentProgress, total: totalSections, percentage },
            statistics: {
              itemsProcessed: processedCount,
              averageTimePerItem: avgTime
            }
          }
        });

        // Clear batch
        batch = [];
        
        // Rate limit delay
        if (isRunning && cursor.next) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
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