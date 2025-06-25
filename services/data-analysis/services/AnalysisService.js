const axios = require('axios');
const logger = require('../shared/utils/logger');
const Title = require('../shared/models/Title');
const Document = require('../shared/models/Document');
const Metric = require('../shared/models/Metric');
const VersionHistory = require('../shared/models/VersionHistory');
const TextAnalyzer = require('./TextAnalyzer');
const SectionAnalyzer = require('./SectionAnalyzer');

class AnalysisService {
  constructor() {
    this.textAnalyzer = new TextAnalyzer();
    this.sectionAnalyzer = new SectionAnalyzer();
    this.versionApiUrl = 'https://www.ecfr.gov/api/versioner/v1/versions';
    this.progressId = null; // Will be set by the caller for cancellation checking
  }

  async performAnalysis(titleNumber = null, forceReanalysis = false) {
    try {
      logger.info(`Starting ${titleNumber ? 'single title' : 'comprehensive'} analysis${forceReanalysis ? ' (forced re-analysis)' : ''}`);
      
      if (titleNumber) {
        // Single title analysis
        logger.info(`Analyzing title ${titleNumber}`);
        await this.analyzeTitle(titleNumber);
        
        // Update last analyzed date
        await Title.findOneAndUpdate(
          { number: titleNumber }, 
          { lastAnalyzed: new Date() }
        );
        
        // Perform section-level analysis for this title
        try {
          logger.info(`Starting section-level AI analysis for title ${titleNumber}`);
          // Pass the progressId to the section analyzer
          this.sectionAnalyzer.progressId = this.progressId;
          await this.sectionAnalyzer.analyzeSections(titleNumber, forceReanalysis);
        } catch (error) {
          logger.error('Section-level analysis failed:', error);
          // Re-throw if it's a cancellation
          if (error.message === 'Analysis cancelled by user') {
            throw error;
          }
          // Don't throw for other errors - continue running
        }
      } else {
        // Full analysis
        const titles = await Title.find({}).select('number name lastAnalyzed upToDateAsOf');
        
        for (const title of titles) {
          try {
            // Check if analysis is needed
            if (!title.lastAnalyzed || 
                new Date(title.upToDateAsOf) > new Date(title.lastAnalyzed)) {
              
              logger.info(`Analyzing title ${title.number}: ${title.name}`);
              await this.analyzeTitle(title.number);
              
              // Update last analyzed date
              await Title.findByIdAndUpdate(title._id, { 
                lastAnalyzed: new Date() 
              });
            }
          } catch (error) {
            logger.error(`Failed to analyze title ${title.number}:`, error);
            // Continue with next title instead of failing entire analysis
          }
        }

        // Perform section-level analysis using the model (only unanalyzed sections on startup)
        try {
          logger.info('Starting section-level AI analysis for unanalyzed sections');
          // Pass the progressId to the section analyzer
          this.sectionAnalyzer.progressId = this.progressId;
          await this.sectionAnalyzer.analyzeSections(null, false);
        } catch (error) {
          logger.error('Section-level analysis failed:', error);
          // Re-throw if it's a cancellation
          if (error.message === 'Analysis cancelled by user') {
            throw error;
          }
          // Don't throw for other errors - continue running
        }
      }

      logger.info('Analysis completed');
    } catch (error) {
      logger.error('Analysis failed:', error);
      throw error;
    }
  }

  async analyzeTitle(titleNumber) {
    try {
      // Get all documents for this title
      const documents = await Document.find({ titleNumber });
      
      if (documents.length === 0) {
        logger.warn(`No documents found for title ${titleNumber}`);
        return;
      }

      // Combine all text content
      const fullText = documents.map(doc => doc.content).join(' ');
      
      // Perform text analysis
      const wordCount = this.textAnalyzer.countWords(fullText);
      const keywordFrequency = this.textAnalyzer.analyzeKeywords(fullText);
      const complexityScore = await this.textAnalyzer.calculateComplexity(fullText);
      const readabilityScore = await this.textAnalyzer.calculateReadability(fullText);
      const avgSentenceLength = this.textAnalyzer.getAverageSentenceLength(fullText);
      
      // Analyze regulation ages
      const ageDistribution = await this.analyzeRegulationAges(documents);
      
      // Create metrics object
      const metrics = {
        wordCount,
        regulationAgeDistribution: ageDistribution,
        keywordFrequency,
        complexityScore,
        averageSentenceLength: avgSentenceLength,
        readabilityScore
      };

      // Save metrics
      await Metric.create({
        titleNumber,
        analysisDate: new Date(),
        metrics
      });

      // Fetch and save version history
      await this.fetchVersionHistory(titleNumber);

      logger.info(`Analysis completed for title ${titleNumber}:`, {
        wordCount,
        complexityScore,
        readabilityScore
      });

    } catch (error) {
      logger.error(`Failed to analyze title ${titleNumber}:`, error);
      // Don't throw - let the analysis continue with other titles
    }
  }

  async analyzeRegulationAges(documents) {
    const now = new Date();
    const distribution = {
      lessThan1Year: 0,
      oneToFiveYears: 0,
      fiveToTenYears: 0,
      tenToTwentyYears: 0,
      moreThanTwentyYears: 0
    };

    documents.forEach(doc => {
      // Use amendmentDate since effectiveDate is not populated in the XML parsing
      if (doc.amendmentDate) {
        const ageInYears = (now - doc.amendmentDate) / (365 * 24 * 60 * 60 * 1000);
        
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

  async fetchVersionHistory(titleNumber) {
    try {
      const url = `${this.versionApiUrl}/title-${titleNumber}.json`;
      const response = await axios.get(url, {
        headers: { 'Accept': 'application/json' },
        timeout: 30000
      });

      const versions = response.data.versions || [];
      
      await VersionHistory.findOneAndUpdate(
        { titleNumber },
        {
          titleNumber,
          lastUpdated: new Date(),
          versions: versions.map(v => ({
            date: new Date(v.date),
            federalRegisterCitation: v.fr_citation,
            description: v.description || ''
          }))
        },
        { upsert: true }
      );

      logger.info(`Updated version history for title ${titleNumber}: ${versions.length} versions`);
    } catch (error) {
      logger.error(`Failed to fetch version history for title ${titleNumber}:`, error.message);
    }
  }
}

module.exports = AnalysisService;