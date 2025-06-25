const xml2js = require('xml2js');
const logger = require('../shared/utils/logger');
const { storeInGridFS, shouldUseGridFS } = require('../shared/utils/gridfs');

class XMLParser {
  constructor() {
    this.parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
      normalize: true,
      normalizeTags: true,
      preserveChildrenOrder: true,
      attrValueProcessors: [xml2js.processors.parseNumbers, xml2js.processors.parseBooleans],
      valueProcessors: [xml2js.processors.parseNumbers, xml2js.processors.parseBooleans],
      // Increase default limits for large XML files
      chunkSize: 10 * 1024 * 1024 // 10MB chunks
    });
  }

  async parseTitle(xmlContent, titleNumber) {
    try {
      const result = await this.parser.parseStringPromise(xmlContent);
      const documents = [];

      // Debug: Log the structure
      const rootKeys = Object.keys(result);
      logger.info(`XML root keys for title ${titleNumber}: ${rootKeys.join(', ')}`);
      
      // Navigate to the content according to eCFR XML structure
      let titleData = null;
      let amendmentDate = null;
      
      if (result && result.dlpstextclass) {
        // Navigate through DLPSTEXTCLASS > TEXT > BODY > ECFRBRWS > DIV1
        const text = result.dlpstextclass.text;
        if (text && text.body && text.body.ecfrbrws) {
          const ecfrbrws = text.body.ecfrbrws;
          
          // Debug: Check if ecfrbrws is an array (happens with reserved titles)
          if (Array.isArray(ecfrbrws)) {
            logger.info(`ECFRBRWS is an array with ${ecfrbrws.length} elements for title ${titleNumber}`);
            // Look for the one with div1
            for (const elem of ecfrbrws) {
              if (elem.div1) {
                titleData = elem.div1;
                if (elem.amddate) {
                  amendmentDate = this.parseDate(elem.amddate);
                  logger.info(`Amendment date for title ${titleNumber}: ${elem.amddate}`);
                }
                break;
              }
            }
          } else {
            // Extract amendment date
            if (ecfrbrws.amddate) {
              amendmentDate = this.parseDate(ecfrbrws.amddate);
              logger.info(`Amendment date for title ${titleNumber}: ${ecfrbrws.amddate}`);
            }
            
            if (ecfrbrws.div1) {
              titleData = ecfrbrws.div1;
            }
          }
        }
      }

      if (titleData) {
        // Process the title itself
        const titleDoc = await this.createDocument({
          node: titleData,
          type: 'title',
          titleNumber: parseInt(titleNumber),
          amendmentDate: amendmentDate
        });
        if (titleDoc) documents.push(titleDoc);

        // Process all child elements
        const childDocs = await this.processDivElement(titleData, {
          titleNumber: parseInt(titleNumber),
          amendmentDate: amendmentDate,
          hierarchy: {}
        });
        documents.push(...childDocs);
      } else {
        logger.warn(`No title data found in XML for title ${titleNumber}`);
      }

      logger.info(`Parsed ${documents.length} documents from title ${titleNumber}`);
      return documents;
    } catch (error) {
      logger.error(`Failed to parse XML for title ${titleNumber}:`, error);
      throw error;
    }
  }

  async processDivElement(element, context) {
    const documents = [];
    const hierarchy = { ...context.hierarchy };

    // Process DIV2 (Subtitle)
    if (element.div2) {
      const subtitles = Array.isArray(element.div2) ? element.div2 : [element.div2];
      for (const subtitle of subtitles) {
        const subtitleDoc = await this.createDocument({
          node: subtitle,
          type: 'subtitle',
          titleNumber: context.titleNumber,
          amendmentDate: context.amendmentDate,
          hierarchy: hierarchy
        });
        if (subtitleDoc) documents.push(subtitleDoc);

        // Process children with updated hierarchy
        const subtitleHierarchy = { ...hierarchy, subtitle: subtitle.n };
        const childDocs = await this.processDivElement(subtitle, { 
          ...context, 
          hierarchy: subtitleHierarchy 
        });
        documents.push(...childDocs);
      }
    }

    // Process DIV3 (Chapter)
    if (element.div3) {
      const chapters = Array.isArray(element.div3) ? element.div3 : [element.div3];
      for (const chapter of chapters) {
        const chapterDoc = await this.createDocument({
          node: chapter,
          type: 'chapter',
          titleNumber: context.titleNumber,
          amendmentDate: context.amendmentDate,
          hierarchy: hierarchy
        });
        if (chapterDoc) documents.push(chapterDoc);

        // Process children with updated hierarchy
        const chapterHierarchy = { ...hierarchy, chapter: chapter.n };
        const childDocs = await this.processDivElement(chapter, { 
          ...context, 
          hierarchy: chapterHierarchy 
        });
        documents.push(...childDocs);
      }
    }

    // Process DIV4 (Subchapter)
    if (element.div4) {
      const subchapters = Array.isArray(element.div4) ? element.div4 : [element.div4];
      for (const subchapter of subchapters) {
        const subchapterDoc = await this.createDocument({
          node: subchapter,
          type: 'subchapter',
          titleNumber: context.titleNumber,
          amendmentDate: context.amendmentDate,
          hierarchy: hierarchy
        });
        if (subchapterDoc) documents.push(subchapterDoc);

        // Process children with updated hierarchy
        const subchapterHierarchy = { ...hierarchy, subchapter: subchapter.n };
        const childDocs = await this.processDivElement(subchapter, { 
          ...context, 
          hierarchy: subchapterHierarchy 
        });
        documents.push(...childDocs);
      }
    }

    // Process DIV5 (Part)
    if (element.div5) {
      const parts = Array.isArray(element.div5) ? element.div5 : [element.div5];
      for (const part of parts) {
        const partDoc = await this.createDocument({
          node: part,
          type: 'part',
          titleNumber: context.titleNumber,
          amendmentDate: context.amendmentDate,
          hierarchy: hierarchy
        });
        if (partDoc) documents.push(partDoc);

        // Process children with updated hierarchy
        const partHierarchy = { ...hierarchy, part: part.n };
        const childDocs = await this.processDivElement(part, { 
          ...context, 
          hierarchy: partHierarchy 
        });
        documents.push(...childDocs);
      }
    }

    // Process DIV6 (Subpart)
    if (element.div6) {
      const subparts = Array.isArray(element.div6) ? element.div6 : [element.div6];
      for (const subpart of subparts) {
        const subpartDoc = await this.createDocument({
          node: subpart,
          type: 'subpart',
          titleNumber: context.titleNumber,
          amendmentDate: context.amendmentDate,
          hierarchy: hierarchy
        });
        if (subpartDoc) documents.push(subpartDoc);

        // Process children with updated hierarchy
        const subpartHierarchy = { ...hierarchy, subpart: subpart.n };
        const childDocs = await this.processDivElement(subpart, { 
          ...context, 
          hierarchy: subpartHierarchy 
        });
        documents.push(...childDocs);
      }
    }

    // Process DIV7 (Subject Group)
    if (element.div7) {
      const subjgrps = Array.isArray(element.div7) ? element.div7 : [element.div7];
      for (const subjgrp of subjgrps) {
        const subjgrpDoc = await this.createDocument({
          node: subjgrp,
          type: 'subjectgroup',
          titleNumber: context.titleNumber,
          amendmentDate: context.amendmentDate,
          hierarchy: hierarchy
        });
        if (subjgrpDoc) documents.push(subjgrpDoc);

        // Process children with updated hierarchy
        const subjgrpHierarchy = { ...hierarchy, subjectGroup: subjgrp.n };
        const childDocs = await this.processDivElement(subjgrp, { 
          ...context, 
          hierarchy: subjgrpHierarchy 
        });
        documents.push(...childDocs);
      }
    }

    // Process DIV8 (Section)
    if (element.div8) {
      const sections = Array.isArray(element.div8) ? element.div8 : [element.div8];
      for (const section of sections) {
        const sectionDoc = await this.createDocument({
          node: section,
          type: 'section',
          titleNumber: context.titleNumber,
          amendmentDate: context.amendmentDate,
          hierarchy: { ...hierarchy, section: section.n }
        });
        if (sectionDoc) documents.push(sectionDoc);
      }
    }

    // Process DIV9 (Appendix)
    if (element.div9) {
      const appendices = Array.isArray(element.div9) ? element.div9 : [element.div9];
      for (const appendix of appendices) {
        const appendixDoc = await this.createDocument({
          node: appendix,
          type: 'appendix',
          titleNumber: context.titleNumber,
          amendmentDate: context.amendmentDate,
          hierarchy: hierarchy
        });
        if (appendixDoc) documents.push(appendixDoc);
      }
    }

    return documents;
  }

  async createDocument({ node, type, titleNumber, amendmentDate, hierarchy = {} }) {
    try {
      // Create unique identifier
      const identifier = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Extract heading
      const heading = this.extractHeading(node);
      
      // Extract authority and source
      const authority = this.extractAuthority(node);
      const source = this.extractSource(node);
      
      // Extract citations
      const citations = this.extractCitations(node);
      
      // Extract editorial notes
      const editorialNotes = this.extractEditorialNotes(node);
      
      // Extract images
      const images = this.extractImages(node);
      
      // Extract structured content
      const structuredContent = this.extractStructuredContent(node);
      
      // Extract plain text for search
      const plainText = this.extractPlainText(node);
      
      // Extract formatted text with HTML tags preserved
      const formattedText = this.extractFormattedText(node);

      // Prepare document
      const document = {
        titleNumber: titleNumber,
        type: type,
        identifier: identifier,
        node: node.node || null,
        subtitle: hierarchy.subtitle || null,
        chapter: hierarchy.chapter || null,
        subchapter: hierarchy.subchapter || null,
        part: hierarchy.part || null,
        subpart: hierarchy.subpart || null,
        subjectGroup: hierarchy.subjectGroup || null,
        section: hierarchy.section || null,
        heading: heading,
        authority: authority,
        source: source,
        structuredContent: structuredContent,
        content: plainText || 'No content available',
        formattedContent: formattedText || plainText || 'No content available',
        contentLength: plainText ? Buffer.byteLength(plainText, 'utf8') : 0,
        citations: citations,
        editorialNotes: editorialNotes,
        images: images,
        effectiveDate: this.parseDate(node.effectivedate),
        amendmentDate: amendmentDate,
        lastModified: new Date()
      };

      // First check total document size to determine if we need GridFS
      const preliminaryDocSize = Buffer.byteLength(JSON.stringify(document), 'utf8');
      
      // If document is approaching MongoDB limit, use GridFS for large fields
      if (preliminaryDocSize > 10 * 1024 * 1024) { // 10MB threshold for safety
        logger.info(`Document approaching size limit: ${type} ${identifier} - ${preliminaryDocSize} bytes`);
        
        // Check content size
        const contentSize = Buffer.byteLength(plainText || '', 'utf8');
        if (contentSize > 1024 * 1024) { // Store content > 1MB in GridFS when doc is large
          logger.info(`Storing large content in GridFS for ${type} ${identifier} (${contentSize} bytes)`);
          const gridfsId = await storeInGridFS(plainText, `${titleNumber}_${identifier}_content`, {
            titleNumber,
            type,
            identifier
          });
          document.contentGridFS = gridfsId;
          document.content = `[Content stored in GridFS: ${contentSize} bytes]`;
        }

        // Check structured content size
        const structuredContentStr = JSON.stringify(structuredContent);
        const structuredSize = Buffer.byteLength(structuredContentStr, 'utf8');
        if (structuredSize > 1024 * 1024) { // Store structured content > 1MB in GridFS when doc is large
          logger.info(`Storing large structured content in GridFS for ${type} ${identifier} (${structuredSize} bytes)`);
          const gridfsId = await storeInGridFS(structuredContentStr, `${titleNumber}_${identifier}_structured`, {
            titleNumber,
            type,
            identifier
          });
          document.structuredContentGridFS = gridfsId;
          document.structuredContent = { storedInGridFS: true, size: structuredSize };
        }

        // Check formatted content size
        const formattedSize = Buffer.byteLength(formattedText || '', 'utf8');
        if (formattedSize > 1024 * 1024) { // Store formatted content > 1MB in GridFS when doc is large
          logger.info(`Storing large formatted content in GridFS for ${type} ${identifier} (${formattedSize} bytes)`);
          const gridfsId = await storeInGridFS(formattedText, `${titleNumber}_${identifier}_formatted`, {
            titleNumber,
            type,
            identifier
          });
          document.formattedContentGridFS = gridfsId;
          document.formattedContent = `[Formatted content stored in GridFS: ${formattedSize} bytes]`;
        }
      }

      // Log final document size for debugging
      const finalDocSize = Buffer.byteLength(JSON.stringify(document), 'utf8');
      if (finalDocSize > 1024 * 1024) { // Log if > 1MB
        logger.info(`Large document created: ${type} ${identifier} - total size: ${finalDocSize} bytes`);
      }

      return document;
    } catch (error) {
      logger.error(`Error creating document for ${type}:`, error);
      return null;
    }
  }

  extractHeading(node) {
    if (node.head) {
      if (typeof node.head === 'string') {
        return node.head;
      } else if (node.head._) {
        return node.head._;
      }
    }
    return null;
  }

  extractAuthority(node) {
    if (node.auth) {
      return this.extractPlainText(node.auth);
    }
    return null;
  }

  extractSource(node) {
    if (node.source) {
      return this.extractPlainText(node.source);
    }
    return null;
  }

  extractCitations(node) {
    const citations = [];
    
    const findCitations = (obj) => {
      if (obj && typeof obj === 'object') {
        if (obj.cita) {
          const citas = Array.isArray(obj.cita) ? obj.cita : [obj.cita];
          citas.forEach(cita => {
            citations.push({
              text: this.extractPlainText(cita),
              type: cita.type || 'N'
            });
          });
        }
        
        for (const key in obj) {
          if (key !== 'cita' && obj.hasOwnProperty(key)) {
            if (Array.isArray(obj[key])) {
              obj[key].forEach(item => findCitations(item));
            } else if (typeof obj[key] === 'object') {
              findCitations(obj[key]);
            }
          }
        }
      }
    };
    
    findCitations(node);
    return citations;
  }

  extractEditorialNotes(node) {
    const notes = [];
    
    const findEdNotes = (obj) => {
      if (obj && typeof obj === 'object') {
        if (obj.ednote) {
          const ednotes = Array.isArray(obj.ednote) ? obj.ednote : [obj.ednote];
          ednotes.forEach(note => {
            notes.push({
              heading: note.hed ? this.extractPlainText(note.hed) : 'Editorial Note',
              content: this.extractPlainText(note)
            });
          });
        }
        
        for (const key in obj) {
          if (key !== 'ednote' && obj.hasOwnProperty(key)) {
            if (Array.isArray(obj[key])) {
              obj[key].forEach(item => findEdNotes(item));
            } else if (typeof obj[key] === 'object') {
              findEdNotes(obj[key]);
            }
          }
        }
      }
    };
    
    findEdNotes(node);
    return notes;
  }

  extractImages(node) {
    const images = [];
    
    const findImages = (obj) => {
      if (obj && typeof obj === 'object') {
        if (obj.img) {
          const imgs = Array.isArray(obj.img) ? obj.img : [obj.img];
          imgs.forEach(img => {
            const imageData = {
              src: img.src || img.$ && img.$.src || null,
              alt: img.alt || img.$ && img.$.alt || null,
              pdfLink: null
            };
            
            // Look for associated PDF link
            if (img.src && img.src.includes('.gif')) {
              const pdfName = img.src.replace('.gif', '.pdf').replace('/graphics/', '/graphics/pdfs/');
              imageData.pdfLink = pdfName;
            }
            
            if (imageData.src) {
              images.push(imageData);
            }
          });
        }
        
        // Also look for <a> tags that might link to PDFs
        if (obj.a && obj.a.href && obj.a.href.includes('.pdf')) {
          const lastImage = images[images.length - 1];
          if (lastImage && !lastImage.pdfLink) {
            lastImage.pdfLink = obj.a.href;
          }
        }
        
        for (const key in obj) {
          if (key !== 'img' && key !== 'a' && obj.hasOwnProperty(key)) {
            if (Array.isArray(obj[key])) {
              obj[key].forEach(item => findImages(item));
            } else if (typeof obj[key] === 'object') {
              findImages(obj[key]);
            }
          }
        }
      }
    };
    
    findImages(node);
    return images;
  }

  extractStructuredContent(node) {
    // Create a structured representation of the content
    const structured = {};
    
    // Extract paragraphs with their structure
    structured.paragraphs = this.extractParagraphs(node);
    
    // Extract tables
    structured.tables = this.extractTables(node);
    
    // Extract lists/extracts
    structured.extracts = this.extractExtracts(node);
    
    // Extract the table of contents if present
    if (node.cfrtoc) {
      structured.tableOfContents = node.cfrtoc;
    }
    
    return structured;
  }

  extractParagraphs(node) {
    const paragraphs = [];
    
    const findParagraphs = (obj, depth = 0) => {
      if (obj && typeof obj === 'object') {
        // Look for paragraph elements
        const pTags = ['p', 'fp', 'fp-1', 'fp-2', 'fp1-2', 'fp2', 'fp2-2', 'fp-dash', 'pspace'];
        
        pTags.forEach(tag => {
          if (obj[tag]) {
            const paras = Array.isArray(obj[tag]) ? obj[tag] : [obj[tag]];
            paras.forEach(para => {
              paragraphs.push({
                type: tag,
                content: this.extractPlainText(para),
                depth: depth
              });
            });
          }
        });
        
        for (const key in obj) {
          if (!pTags.includes(key) && obj.hasOwnProperty(key)) {
            if (Array.isArray(obj[key])) {
              obj[key].forEach(item => findParagraphs(item, depth + 1));
            } else if (typeof obj[key] === 'object') {
              findParagraphs(obj[key], depth + 1);
            }
          }
        }
      }
    };
    
    findParagraphs(node);
    return paragraphs;
  }

  extractTables(node) {
    const tables = [];
    
    const findTables = (obj) => {
      if (obj && typeof obj === 'object') {
        if (obj.table) {
          const tbls = Array.isArray(obj.table) ? obj.table : [obj.table];
          tbls.forEach(table => {
            tables.push({
              raw: table,
              text: this.extractPlainText(table)
            });
          });
        }
        
        for (const key in obj) {
          if (key !== 'table' && obj.hasOwnProperty(key)) {
            if (Array.isArray(obj[key])) {
              obj[key].forEach(item => findTables(item));
            } else if (typeof obj[key] === 'object') {
              findTables(obj[key]);
            }
          }
        }
      }
    };
    
    findTables(node);
    return tables;
  }

  extractExtracts(node) {
    const extracts = [];
    
    const findExtracts = (obj) => {
      if (obj && typeof obj === 'object') {
        if (obj.extract) {
          const exts = Array.isArray(obj.extract) ? obj.extract : [obj.extract];
          exts.forEach(extract => {
            extracts.push({
              content: this.extractPlainText(extract),
              structured: extract
            });
          });
        }
        
        for (const key in obj) {
          if (key !== 'extract' && obj.hasOwnProperty(key)) {
            if (Array.isArray(obj[key])) {
              obj[key].forEach(item => findExtracts(item));
            } else if (typeof obj[key] === 'object') {
              findExtracts(obj[key]);
            }
          }
        }
      }
    };
    
    findExtracts(node);
    return extracts;
  }

  extractPlainText(node) {
    let text = '';

    const extract = (obj) => {
      if (typeof obj === 'string') {
        text += obj + ' ';
      } else if (typeof obj === 'object' && obj !== null) {
        // Handle text content
        if (obj._) {
          text += obj._ + ' ';
        }
        
        // Skip certain structural elements when extracting plain text
        const skipTags = ['$', 'type', 'n', 'node'];
        
        for (const key in obj) {
          if (!skipTags.includes(key) && obj.hasOwnProperty(key)) {
            if (Array.isArray(obj[key])) {
              obj[key].forEach(item => extract(item));
            } else {
              extract(obj[key]);
            }
          }
        }
      }
    };

    extract(node);
    return text.trim();
  }

  // New method to extract text with preserved formatting tags
  extractFormattedText(node) {
    let html = '';
    
    // HTML formatting tags to preserve (case-insensitive)
    const formattingTags = ['i', 'b', 'em', 'strong', 'u', 'sub', 'sup'];
    // Block-level tags to preserve as HTML
    const blockTags = ['p'];
    // Special paragraph tags to convert to <p>
    const paragraphTags = ['fp', 'fp-1', 'fp-2', 'fp1-2', 'fp2', 'fp2-2', 'fp-dash', 'pspace'];
    
    const extract = (obj, parentTag = null) => {
      if (typeof obj === 'string') {
        html += obj;
      } else if (typeof obj === 'object' && obj !== null) {
        // Handle text content
        if (obj._) {
          html += obj._;
        }
        
        // Process child elements
        for (const key in obj) {
          if (key !== '_' && key !== '$' && key !== 'type' && key !== 'n' && key !== 'node' && obj.hasOwnProperty(key)) {
            const children = Array.isArray(obj[key]) ? obj[key] : [obj[key]];
            
            children.forEach(child => {
              const lowerKey = key.toLowerCase();
              
              // Handle standard HTML formatting tags
              if (formattingTags.includes(lowerKey)) {
                html += `<${lowerKey}>`;
                extract(child, key);
                html += `</${lowerKey}>`;
              } 
              // Handle eCFR emphasis tags
              else if (lowerKey === 'e') {
                const emphasisType = child.t || child.T || (child.$ && (child.$.t || child.$.T));
                switch(emphasisType) {
                  case '02':
                    html += '<b>';
                    extract(child, key);
                    html += '</b>';
                    break;
                  case '03':
                    html += '<i>';
                    extract(child, key);
                    html += '</i>';
                    break;
                  case '04':
                  case '05':
                    html += '<span style="font-variant: small-caps;">';
                    extract(child, key);
                    html += '</span>';
                    break;
                  case '51':
                    html += '<sup>';
                    extract(child, key);
                    html += '</sup>';
                    break;
                  case '52':
                    html += '<sub>';
                    extract(child, key);
                    html += '</sub>';
                    break;
                  default:
                    extract(child, key);
                }
              } 
              // Handle SU tag for superscript
              else if (lowerKey === 'su') {
                html += '<sup>';
                extract(child, key);
                html += '</sup>';
              } 
              // Handle block tags - preserve as HTML
              else if (blockTags.includes(lowerKey)) {
                html += `<${lowerKey}>`;
                extract(child, key);
                html += `</${lowerKey}>`;
              }
              // Handle paragraph tags - convert to <p>
              else if (paragraphTags.includes(lowerKey)) {
                html += '<p>';
                extract(child, key);
                html += '</p>';
              } 
              // Other tags - just extract content
              else {
                extract(child, key);
              }
            });
          }
        }
      }
    };
    
    extract(node);
    return html.trim();
  }

  parseDate(dateStr) {
    if (!dateStr) return null;
    
    try {
      // Clean up the date string by removing extra suffixes like (fm)
      const cleanedDate = dateStr.replace(/\s*\(.*?\)\s*$/, '').trim();
      
      // Try to parse the cleaned date
      const date = new Date(cleanedDate);
      
      // If parsing failed, return null
      if (isNaN(date.getTime())) {
        logger.warn(`Failed to parse date: ${dateStr} -> ${cleanedDate}`);
        return null;
      }
      
      return date;
    } catch (error) {
      logger.warn(`Error parsing date: ${dateStr}`, error);
      return null;
    }
  }
}

module.exports = XMLParser;