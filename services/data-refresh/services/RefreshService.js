const axios = require('axios');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');
const logger = require('../shared/utils/logger');
const Title = require('../shared/models/Title');
const Document = require('../shared/models/Document');
const RefreshProgress = require('../shared/models/RefreshProgress');
const { bulkIndex } = require('../shared/db/elasticsearch');
const XMLParser = require('./XMLParser');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class RefreshService {
  constructor() {
    this.xmlParser = new XMLParser();
    this.baseUrl = 'https://www.govinfo.gov/bulkdata/ECFR';
    this.titlesApiUrl = 'https://www.ecfr.gov/api/versioner/v1/titles.json';
  }

  async performInitialDownload() {
    try {
      logger.info('Starting initial download of all titles');
      
      // Get or create progress tracking
      const progress = await RefreshProgress.getCurrentProgress('initial');
      
      // Get list of all titles
      const titles = await this.fetchTitlesList();
      logger.info(`Found ${titles.length} titles to download`);
      
      // Initialize progress if starting fresh
      if (progress.status === 'pending') {
        progress.status = 'in_progress';
        progress.totalTitles = titles.filter(t => !t.reserved).length;
        progress.titlesOrder = titles.filter(t => !t.reserved).map(t => t.number);
        progress.startedAt = new Date();
        await progress.save();
      }
      
      // Check if resuming from a previous run
      if (progress.processedTitles > 0) {
        logger.info(`Resuming download from title ${progress.processedTitles + 1} of ${progress.totalTitles}`);
        logger.info(`Previously processed: ${progress.processedTitles} titles`);
        if (progress.failedTitles.length > 0) {
          logger.warn(`Failed titles: ${progress.failedTitles.map(t => t.number).join(', ')}`);
        }
      }

      // Process titles
      let nextTitle;
      while ((nextTitle = progress.getNextTitle(titles)) !== null) {
        try {
          // Update current title in progress
          progress.currentTitle = {
            number: nextTitle.number,
            name: nextTitle.name,
            startedAt: new Date()
          };
          await progress.save();
          
          logger.info(`Processing title ${nextTitle.number} (${progress.processedTitles + 1}/${progress.totalTitles})`);
          
          // Check if title exists and is unchanged
          const existingTitle = await Title.findOne({ number: nextTitle.number });
          let shouldDownload = true;
          
          if (existingTitle && progress.triggeredBy !== 'manual') {
            // For scheduled initial downloads, check if unchanged
            const isUnchanged = await this.checkIfTitleUnchanged(nextTitle, existingTitle);
            if (isUnchanged) {
              logger.info(`Skipping title ${nextTitle.number} - no changes detected since last download`);
              shouldDownload = false;
            }
          }
          
          if (shouldDownload) {
            await this.downloadTitle(nextTitle);
          }
          
          // Mark as processed
          await progress.markTitleProcessed(nextTitle.number, nextTitle.name);
          
          logger.info(`Successfully processed title ${nextTitle.number}`);
          
          // Add delay between downloads to avoid overwhelming the server
          await this.delay(2000);
          
        } catch (error) {
          logger.error(`Failed to process title ${nextTitle.number}:`, error);
          await progress.markTitleFailed(nextTitle.number, nextTitle.name, error);
          
          // Continue with next title instead of failing entire process
          logger.info('Continuing with next title...');
          await this.delay(5000); // Longer delay after failure
        }
      }
      
      // Check final status
      if (progress.status === 'completed') {
        logger.info('Initial download completed successfully');
        logger.info(`Total processed: ${progress.processedTitles} titles`);
      } else {
        logger.warn('Initial download completed with some failures');
        logger.warn(`Processed: ${progress.processedTitles}/${progress.totalTitles} titles`);
        logger.warn(`Failed: ${progress.failedTitles.length} titles`);
      }
      
    } catch (error) {
      logger.error('Initial download failed:', error);
      throw error;
    }
  }

  async performRefresh() {
    try {
      logger.info('Starting refresh check');
      
      // Get or create progress tracking for refresh
      const progress = await RefreshProgress.getCurrentProgress('refresh');
      
      // Get current titles list
      const titles = await this.fetchTitlesList();
      
      // Initialize progress if starting fresh
      if (progress.status === 'pending') {
        progress.status = 'in_progress';
        progress.totalTitles = titles.filter(t => !t.reserved).length;
        progress.startedAt = new Date();
        await progress.save();
      }
      
      // Check each title for updates
      let updatedCount = 0;
      let skippedCount = 0;
      for (const title of titles) {
        if (title.reserved) continue;
        
        try {
          progress.currentTitle = {
            number: title.number,
            name: title.name,
            startedAt: new Date()
          };
          await progress.save();
          
          const existingTitle = await Title.findOne({ number: title.number });
          
          if (!existingTitle) {
            // New title, download it
            logger.info(`New title found: ${title.number} - ${title.name}`);
            await this.downloadTitle(title);
            updatedCount++;
          } else {
            // Check if we should skip based on last-modified
            const shouldSkip = await this.checkIfTitleUnchanged(title, existingTitle);
            
            if (shouldSkip) {
              logger.info(`Skipping title ${title.number} - no changes detected since last download`);
              skippedCount++;
            } else {
              // Title has been updated
              logger.info(`Update found for title ${title.number}: ${existingTitle.upToDateAsOf} -> ${title.upToDateAsOf}`);
              await this.downloadTitle(title);
              updatedCount++;
            }
          }
          
          await progress.markTitleProcessed(title.number, title.name);
          
        } catch (error) {
          logger.error(`Failed to refresh title ${title.number}:`, error);
          await progress.markTitleFailed(title.number, title.name, error);
        }

        await this.delay(1000);
      }

      logger.info(`Refresh check completed. Updated ${updatedCount} titles, skipped ${skippedCount} unchanged titles`);
      
      if (progress.failedTitles.length > 0) {
        logger.warn(`Failed to refresh ${progress.failedTitles.length} titles:`);
        progress.failedTitles.forEach(t => {
          logger.warn(`  - Title ${t.number}: ${t.error}`);
        });
      }
      
    } catch (error) {
      logger.error('Refresh failed:', error);
      throw error;
    }
  }

  async fetchTitlesList() {
    try {
      const response = await axios.get(this.titlesApiUrl, {
        headers: { 'Accept': 'application/json' },
        timeout: 30000
      });

      return response.data.titles;
    } catch (error) {
      logger.error('Failed to fetch titles list:', error);
      throw error;
    }
  }

  async downloadTitle(titleInfo, forceDownload = false) {
    const { number, name } = titleInfo;
    const url = `${this.baseUrl}/title-${number}/ECFR-title${number}.xml`;
    
    logger.info(`Downloading title ${number}: ${name}${forceDownload ? ' (forced)' : ''}`);

    try {
      // Download XML with retry logic
      let xmlContent = null;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts && !xmlContent) {
        try {
          const response = await axios.get(url, {
            responseType: 'text',
            timeout: 600000, // 10 minutes timeout for large files
            maxContentLength: Infinity, // No limit on content length
            maxBodyLength: Infinity, // No limit on body length
            headers: {
              'Accept-Encoding': 'gzip, deflate',
              'User-Agent': 'eCFR-Analyzer/1.0'
            }
          });
          xmlContent = response.data;
        } catch (error) {
          attempts++;
          logger.warn(`Download attempt ${attempts} failed for title ${number}:`, error.message);
          if (attempts < maxAttempts) {
            await this.delay(5000 * attempts); // Exponential backoff
          } else {
            throw error;
          }
        }
      }

      // Calculate checksum
      const checksum = crypto.createHash('sha256').update(xmlContent).digest('hex');

      // Compress XML for storage
      let compressedXml;
      try {
        // For very large files, we need to handle compression more carefully
        const xmlSizeMB = Buffer.byteLength(xmlContent, 'utf8') / (1024 * 1024);
        
        if (xmlSizeMB > 500) {
          logger.warn(`Title ${number} is extremely large (${xmlSizeMB.toFixed(2)} MB), skipping compression`);
          // For extremely large files, store uncompressed with a flag
          compressedXml = Buffer.from(xmlContent);
        } else {
          compressedXml = await gzip(xmlContent);
        }
      } catch (compressionError) {
        logger.error(`Failed to compress title ${number}:`, compressionError.message);
        // If compression fails, store uncompressed
        logger.warn(`Storing title ${number} uncompressed due to compression error`);
        compressedXml = Buffer.from(xmlContent);
      }

      // Parse XML and extract documents
      let documents = [];
      try {
        // Check if this is a particularly large title that needs special handling
        const xmlSizeMB = Buffer.byteLength(xmlContent, 'utf8') / (1024 * 1024);
        logger.info(`Title ${number} XML size: ${xmlSizeMB.toFixed(2)} MB`);
        
        if (xmlSizeMB > 100) {
          logger.warn(`Title ${number} is very large (${xmlSizeMB.toFixed(2)} MB), using chunked parsing`);
          // For very large files, we might need to implement streaming parsing in the future
          // For now, just increase Node.js memory if needed
        }
        
        documents = await this.xmlParser.parseTitle(xmlContent, number);
        logger.info(`Parsed ${documents.length} documents from title ${number}`);
      } catch (parseError) {
        logger.error(`Failed to parse title ${number}:`, parseError);
        // If parsing fails, still save the title with XML content but no documents
        logger.warn(`Saving title ${number} without parsed documents due to parsing error`);
        documents = [];
      }

      // Save or update title in MongoDB
      // Check if the document size exceeds MongoDB limits
      const xmlContentBase64 = compressedXml.toString('base64');
      const docSizeMB = Buffer.byteLength(JSON.stringify({xmlContent: xmlContentBase64}), 'utf8') / (1024 * 1024);
      
      if (docSizeMB > 16) {
        logger.warn(`Title ${number} exceeds MongoDB 16MB limit (${docSizeMB.toFixed(2)} MB), saving without XML content`);
        // Save metadata only for extremely large titles
        const titleDataNoXml = {
          number: parseInt(number),
          name,
          latestAmendedOn: titleInfo.latest_amended_on ? new Date(titleInfo.latest_amended_on) : null,
          latestIssueDate: titleInfo.latest_issue_date ? new Date(titleInfo.latest_issue_date) : null,
          upToDateAsOf: titleInfo.up_to_date_as_of ? new Date(titleInfo.up_to_date_as_of) : null,
          reserved: titleInfo.reserved || false,
          checksum,
          lastDownloaded: new Date(),
          xmlContent: null, // Store null for oversized content
          isOversized: true // Flag to indicate content was too large
        };
        
        await Title.findOneAndUpdate(
          { number: parseInt(number) },
          titleDataNoXml,
          { upsert: true, new: true }
        );
        
        logger.warn(`Title ${number} saved without XML content due to size constraints`);
      } else {
        const titleData = {
          number: parseInt(number),
          name,
          latestAmendedOn: titleInfo.latest_amended_on ? new Date(titleInfo.latest_amended_on) : null,
          latestIssueDate: titleInfo.latest_issue_date ? new Date(titleInfo.latest_issue_date) : null,
          upToDateAsOf: titleInfo.up_to_date_as_of ? new Date(titleInfo.up_to_date_as_of) : null,
          reserved: titleInfo.reserved || false,
          checksum,
          lastDownloaded: new Date(),
          xmlContent: xmlContentBase64,
          isOversized: false
        };
        
        logger.info(`Saving title data:`, { 
          number: titleData.number, 
          name: titleData.name,
          hasChecksum: !!titleData.checksum,
          hasXmlContent: !!titleData.xmlContent,
          sizeMB: docSizeMB.toFixed(2)
        });
        
        await Title.findOneAndUpdate(
          { number: parseInt(number) },
          titleData,
          { upsert: true, new: true }
        );
      }

      // Delete existing documents for this title
      logger.info(`Deleting existing documents for title ${number}`);
      const deleteResult = await Document.deleteMany({ titleNumber: parseInt(number) });
      logger.info(`Deleted ${deleteResult.deletedCount} existing documents`);

      // Insert new documents in batches
      const batchSize = 50; // Reduced batch size for large documents
      logger.info(`Inserting ${documents.length} documents for title ${number}`);
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        try {
          // Check batch size and split if too large
          const batchSizeBytes = Buffer.byteLength(JSON.stringify(batch), 'utf8');
          const maxBatchSize = 15 * 1024 * 1024; // 15MB max batch size (MongoDB limit is 16MB)
          
          if (batchSizeBytes > maxBatchSize) {
            // Insert documents one by one if batch is too large
            logger.warn(`Batch too large (${batchSizeBytes} bytes), inserting documents individually`);
            for (const doc of batch) {
              try {
                const docSize = Buffer.byteLength(JSON.stringify(doc), 'utf8');
                logger.info(`Inserting large document individually - type: ${doc.type}, size: ${docSize} bytes`);
                await Document.create(doc);
              } catch (singleInsertError) {
                logger.error(`Failed to insert single document - type: ${doc.type}, identifier: ${doc.identifier}:`, singleInsertError.message);
                // Skip this document and continue with others
                continue;
              }
            }
          } else {
            // Normal batch insert
            const insertResult = await Document.insertMany(batch, { 
              ordered: false, // Continue on error
              rawResult: true 
            });
            logger.info(`Inserted batch of ${insertResult.insertedCount} documents for title ${number}`);
          }
        } catch (insertError) {
          logger.error(`Failed to insert batch for title ${number}:`, insertError.message);
          
          // Try to insert documents individually from failed batch
          logger.info(`Attempting to insert documents from failed batch individually`);
          let successCount = 0;
          for (const doc of batch) {
            try {
              await Document.create(doc);
              successCount++;
            } catch (singleError) {
              const docSize = Buffer.byteLength(JSON.stringify(doc), 'utf8');
              logger.error(`Failed to insert document - type: ${doc.type}, identifier: ${doc.identifier}, size: ${docSize} bytes:`, singleError.message);
            }
          }
          logger.info(`Successfully inserted ${successCount} out of ${batch.length} documents individually`);
        }

        // Index documents in Elasticsearch
        const searchDocs = batch.map(doc => ({
          titleNumber: doc.titleNumber,
          titleName: name,
          type: doc.type,
          identifier: doc.identifier,
          node: doc.node,
          subtitle: doc.subtitle,
          chapter: doc.chapter,
          subchapter: doc.subchapter,
          part: doc.part,
          subpart: doc.subpart,
          subjectGroup: doc.subjectGroup,
          section: doc.section,
          heading: doc.heading,
          authority: doc.authority,
          source: doc.source,
          content: doc.content,
          effectiveDate: doc.effectiveDate,
          amendmentDate: doc.amendmentDate,
          lastModified: doc.lastModified,
          citationsCount: doc.citations ? doc.citations.length : 0,
          editorialNotesCount: doc.editorialNotes ? doc.editorialNotes.length : 0,
          imagesCount: doc.images ? doc.images.length : 0
        }));

        await bulkIndex(searchDocs);
      }

      logger.info(`Successfully processed title ${number}: ${name}`);
    } catch (error) {
      logger.error(`Failed to download title ${number}:`, error);
      throw error;
    }
  }

  async refreshSingleTitle(titleNumber) {
    try {
      logger.info(`Starting refresh for single title: ${titleNumber}`);
      
      // Validate title number
      const parsedNumber = parseInt(titleNumber);
      if (isNaN(parsedNumber) || parsedNumber < 1 || parsedNumber > 50) {
        throw new Error('Invalid title number. Must be between 1 and 50.');
      }
      
      // Get title info from API
      const titles = await this.fetchTitlesList();
      const titleInfo = titles.find(t => parseInt(t.number) === parsedNumber);
      
      if (!titleInfo) {
        throw new Error(`Title ${titleNumber} not found in eCFR system`);
      }
      
      if (titleInfo.reserved) {
        throw new Error(`Title ${titleNumber} is marked as reserved and cannot be refreshed`);
      }
      
      // Create a progress record for single title refresh
      const progress = new RefreshProgress({
        type: 'single_title',
        status: 'in_progress',
        totalTitles: 1,
        processedTitles: 0,
        failedTitles: [],
        titlesOrder: [parsedNumber],
        currentTitle: {
          number: parsedNumber,
          name: titleInfo.name,
          startedAt: new Date()
        },
        startedAt: new Date(),
        triggeredBy: 'manual_single'
      });
      
      await progress.save();
      
      try {
        // Perform the download and update - always download for manual single title refresh
        logger.info(`Manual refresh requested - downloading title ${titleNumber} regardless of last-modified date`);
        await this.downloadTitle(titleInfo, true); // Pass force flag
        
        // Mark as successful
        await progress.markTitleProcessed(parsedNumber, titleInfo.name);
        
        logger.info(`Successfully refreshed title ${titleNumber}`);
        
        return {
          success: true,
          title: {
            number: parsedNumber,
            name: titleInfo.name,
            upToDateAsOf: titleInfo.upToDateAsOf
          }
        };
        
      } catch (error) {
        // Mark as failed
        await progress.markTitleFailed(parsedNumber, titleInfo.name, error);
        
        logger.error(`Failed to refresh title ${titleNumber}:`, error);
        throw error;
      }
      
    } catch (error) {
      logger.error(`Single title refresh failed for title ${titleNumber}:`, error);
      throw error;
    }
  }

  async checkIfTitleUnchanged(titleInfo, existingTitle) {
    try {
      // Check if we have the latest issue date from the API
      if (!titleInfo.latest_issue_date) {
        logger.warn(`No latest_issue_date for title ${titleInfo.number}, will download to be safe`);
        return false; // If we don't have issue date, download to be safe
      }
      
      // Check when we last downloaded this title
      if (!existingTitle.lastDownloaded) {
        logger.info(`No lastDownloaded date for title ${titleInfo.number}, downloading`);
        return false; // Never downloaded, so download it
      }
      
      // Parse dates for comparison
      const latestIssueDate = new Date(titleInfo.latest_issue_date);
      const lastDownloadDate = new Date(existingTitle.lastDownloaded);
      
      // If the latest issue date is older than or equal to our last download, skip
      if (latestIssueDate <= lastDownloadDate) {
        logger.info(`Title ${titleInfo.number} unchanged - latest issue: ${titleInfo.latest_issue_date}, last download: ${existingTitle.lastDownloaded.toISOString()}`);
        return true; // Skip download
      }
      
      logger.info(`Title ${titleInfo.number} has updates - latest issue: ${titleInfo.latest_issue_date}, last download: ${existingTitle.lastDownloaded.toISOString()}`);
      return false; // Download newer version
      
    } catch (error) {
      logger.warn(`Error comparing dates for title ${titleInfo.number}, will download to be safe:`, error);
      return false; // If there's any error, download to be safe
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = RefreshService;