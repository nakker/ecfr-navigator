const logger = require('../shared/utils/logger');
const Document = require('../shared/models/Document');
const SectionAnalysis = require('../shared/models/SectionAnalysis');
const grokService = require('./grok');

class SectionAnalyzer {
  constructor() {
    this.model = process.env.ANALYSIS_MODEL || 'grok-3-mini';
    this.batchSize = parseInt(process.env.ANALYSIS_BATCH_SIZE || '5');
    this.progressId = null; // Will be set by AnalysisService
    logger.info('SectionAnalyzer initialized:', {
      model: this.model,
      batchSize: this.batchSize,
      apiKeyConfigured: !!process.env.GROK_API_KEY
    });
  }

  async analyzeSections(titleNumber = null, forceReanalysis = false) {
    try {
      // Check if Grok API key is configured
      if (!process.env.GROK_API_KEY) {
        logger.warn('Skipping section analysis - GROK_API_KEY not configured');
        logger.warn('To enable section analysis, set GROK_API_KEY in your .env file');
        return;
      }
      
      logger.info(`Starting section analysis${titleNumber ? ` for title ${titleNumber}` : ''}${forceReanalysis ? ' (forced re-analysis)' : ''}`);
      
      // Get sections to analyze
      const sectionsToAnalyze = await this.getSectionsToAnalyze(titleNumber, forceReanalysis);
      logger.info(`Found ${sectionsToAnalyze.length} sections to analyze`);
      
      // Process in batches to avoid overwhelming the model
      for (let i = 0; i < sectionsToAnalyze.length; i += this.batchSize) {
        // Check for cancellation if progressId is set
        if (this.progressId) {
          const AnalysisProgress = require('../shared/models/AnalysisProgress');
          const progress = await AnalysisProgress.findById(this.progressId);
          if (progress && progress.status === 'cancelled') {
            logger.info('Section analysis cancelled by user, stopping execution');
            throw new Error('Analysis cancelled by user');
          }
        }
        
        const batch = sectionsToAnalyze.slice(i, i + this.batchSize);
        await this.analyzeBatch(batch, forceReanalysis);
        
        // Add delay between batches
        if (i + this.batchSize < sectionsToAnalyze.length) {
          await this.delay(2000);
        }
      }
      
      logger.info('Section analysis completed');
    } catch (error) {
      logger.error('Section analysis failed:', error);
      throw error;
    }
  }

  async getSectionsToAnalyze(titleNumber = null, forceReanalysis = false) {
    // Build query for sections
    const query = { 
      type: 'section',
      content: { $exists: true, $ne: '' }
    };
    
    // Filter by title if specified
    if (titleNumber) {
      query.titleNumber = titleNumber;
    }
    
    // Get all matching section documents
    const sections = await Document.find(query)
      .select('_id titleNumber identifier heading content')
      .lean();
    
    // If forcing re-analysis, return all sections
    if (forceReanalysis) {
      logger.info(`Force re-analysis enabled, will analyze all ${sections.length} sections`);
      return sections;
    }
    
    // Otherwise, filter out already analyzed sections
    const analyzedDocs = await SectionAnalysis.find(
      titleNumber ? { titleNumber } : {}
    ).select('documentId').lean();
    const analyzedIds = new Set(analyzedDocs.map(doc => doc.documentId.toString()));
    
    // Filter out already analyzed sections
    const unanalyzedSections = sections.filter(section => !analyzedIds.has(section._id.toString()));
    logger.info(`Skipping ${sections.length - unanalyzedSections.length} already analyzed sections`);
    
    return unanalyzedSections;
  }
  
  async getUnanalyzedSections() {
    // Kept for backward compatibility
    return this.getSectionsToAnalyze(null, false);
  }

  async analyzeBatch(sections, forceReanalysis = false) {
    for (const section of sections) {
      try {
        logger.info(`Analyzing section ${section.identifier}`);
        
        // If re-analyzing, delete existing analysis first
        if (forceReanalysis) {
          await SectionAnalysis.deleteOne({ documentId: section._id });
        }
        
        // Prepare content for analysis (limit to first 2000 characters to avoid token limits)
        const content = section.content.substring(0, 2000);
        const heading = section.heading || section.identifier;
        
        
        // Get all three analyses with individual error handling
        let summary, antiquatedScore, businessUnfriendlyScore;
        
        try {
          [summary, antiquatedScore, businessUnfriendlyScore] = await Promise.all([
            this.getSummary(content, heading),
            this.getAntiquatedScore(content, heading),
            this.getBusinessUnfriendlyScore(content, heading)
          ]);
          
          // Results obtained successfully
        } catch (analysisError) {
          // If any analysis fails, skip this section
          logger.error(`Analysis failed for section ${section.identifier}, skipping:`, {
            error: analysisError.message,
            section: section.identifier
          });
          continue;
        }
        
        // Validate that all required fields are present
        if (!summary || antiquatedScore === undefined || businessUnfriendlyScore === undefined) {
          logger.error(`Invalid analysis results for section ${section.identifier}:`, {
            summary: summary || 'missing',
            antiquatedScore: antiquatedScore !== undefined ? antiquatedScore : 'missing',
            businessUnfriendlyScore: businessUnfriendlyScore !== undefined ? businessUnfriendlyScore : 'missing',
            summaryType: typeof summary,
            antiquatedType: typeof antiquatedScore,
            businessType: typeof businessUnfriendlyScore
          });
          continue;
        }
        
        // Save analysis results
        await SectionAnalysis.create({
          documentId: section._id,
          titleNumber: section.titleNumber,
          sectionIdentifier: section.identifier,
          summary,
          antiquatedScore,
          antiquatedExplanation: `Score: ${antiquatedScore}/100 - ${antiquatedScore <= 20 ? 'Modern language and concepts' : antiquatedScore <= 40 ? 'Mostly current with minor outdated elements' : antiquatedScore <= 60 ? 'Moderately outdated' : antiquatedScore <= 80 ? 'Significantly outdated' : 'Extremely antiquated'}`,
          businessUnfriendlyScore,
          businessUnfriendlyExplanation: `Score: ${businessUnfriendlyScore}/100 - ${businessUnfriendlyScore <= 20 ? 'Business-friendly, minimal burden' : businessUnfriendlyScore <= 40 ? 'Light burden, manageable compliance' : businessUnfriendlyScore <= 60 ? 'Moderate regulatory burden' : businessUnfriendlyScore <= 80 ? 'Significant burden' : 'Extremely burdensome'}`,
          metadata: {
            model: this.model,
            temperature: 0.3
          }
        });
        
        logger.info(`Analysis saved for section ${section.identifier}`);
        
      } catch (error) {
        logger.error(`Failed to analyze section ${section.identifier}:`, {
          message: error.message,
          stack: error.stack,
          response: error.response?.data,
          section: section.identifier,
          titleNumber: section.titleNumber
        });
        // Continue with next section
      }
    }
  }

  async getSummary(content, heading) {
    const promptTemplate = process.env.ANALYSIS_PROMPT_SUMMARY || `Read the following regulatory section and provide a one-sentence summary that captures its main requirement or purpose. Be concise and specific.

Section Title: {heading}

Section Content:
{content}

Provide only the one-sentence summary, nothing else.`;

    // Handle escaped newlines in environment variables
    const processedTemplate = promptTemplate.replace(/\\n/g, '\n');
    
    const prompt = processedTemplate
      .replace('{heading}', heading)
      .replace('{content}', content);


    try {
      const response = await this.callModel(prompt);
      const trimmedResponse = response ? response.trim() : '';
      // Summary response received
      if (!trimmedResponse) {
        logger.error('Empty summary received from API');
        throw new Error('Empty summary received from API');
      }
      
      return trimmedResponse;
    } catch (error) {
      logger.error('Failed to get summary:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      throw error; // Re-throw all errors
    }
  }

  async getAntiquatedScore(content, heading) {
    const promptTemplate = process.env.ANALYSIS_PROMPT_ANTIQUATED || `Analyze the following regulatory section and rate how antiquated or out-of-date the language and subject matter is on a scale of 1 to 100.

1-20 = Very modern, current language and concepts
21-40 = Mostly current with minor outdated elements
41-60 = Moderately outdated
61-80 = Significantly outdated
81-100 = Extremely antiquated, uses obsolete terminology or addresses outdated practices

Consider factors like:
- References to outdated technology or practices
- Use of archaic legal language
- Relevance to modern business practices
- Whether the concepts addressed are still applicable today

Section Title: {heading}

Section Content:
{content}

Your response must be exactly one number between 1 and 100. Do not include any explanation or other text.`;

    // Handle escaped newlines in environment variables
    const processedTemplate = promptTemplate.replace(/\\n/g, '\n');
    
    const prompt = processedTemplate
      .replace('{heading}', heading)
      .replace('{content}', content);

    try {
      const response = await this.callModel(prompt);
      const trimmedResponse = response.trim();
      const score = parseInt(trimmedResponse);
      
      // Antiquated score received
      
      if (isNaN(score) || score < 1 || score > 100) {
        logger.error('Invalid antiquated score received:', trimmedResponse);
        throw new Error(`Invalid antiquated score: ${trimmedResponse}`);
      }
      
      return score;
    } catch (error) {
      logger.error('Failed to get antiquated score:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      throw error; // Re-throw all errors
    }
  }

  async getBusinessUnfriendlyScore(content, heading) {
    const promptTemplate = process.env.ANALYSIS_PROMPT_BUSINESS_UNFRIENDLY || `Analyze the following regulatory section and rate how unfriendly or burdensome it is to businesses on a scale of 1 to 100.

1-20 = Very business-friendly, minimal burden
21-40 = Light burden, manageable compliance
41-60 = Moderate regulatory burden, reasonable requirements
61-80 = Significant burden
81-100 = Extremely burdensome, costly or complex compliance requirements

Consider factors like:
- Compliance costs and complexity
- Reporting or documentation requirements
- Restrictions on business operations
- Penalties or enforcement provisions
- Administrative burden

Section Title: {heading}

Section Content:
{content}

Your response must be exactly one number between 1 and 100. Do not include any explanation or other text.`;

    // Handle escaped newlines in environment variables
    const processedTemplate = promptTemplate.replace(/\\n/g, '\n');
    
    const prompt = processedTemplate
      .replace('{heading}', heading)
      .replace('{content}', content);

    try {
      const response = await this.callModel(prompt);
      const trimmedResponse = response.trim();
      const score = parseInt(trimmedResponse);
      
      // Business unfriendly score received
      
      if (isNaN(score) || score < 1 || score > 100) {
        logger.error('Invalid business unfriendly score received:', trimmedResponse);
        throw new Error(`Invalid business unfriendly score: ${trimmedResponse}`);
      }
      
      return score;
    } catch (error) {
      logger.error('Failed to get business unfriendly score:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      throw error; // Re-throw all errors
    }
  }

  async callModel(prompt) {
    try {
      const response = await grokService.generateContent(prompt, {
        temperature: 0.3, // Lower temperature for more consistent scoring
        maxOutputTokens: parseInt(process.env.ANALYSIS_MAX_TOKENS || '800') // Configurable via environment variable
      });
      
      
      return response;
    } catch (error) {
      logger.error('Grok API call failed:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
        promptLength: prompt.length
      });
      throw error;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SectionAnalyzer;