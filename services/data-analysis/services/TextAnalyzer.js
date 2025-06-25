const natural = require('natural');
const Settings = require('../shared/models/Settings');

class TextAnalyzer {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.sentenceTokenizer = new natural.SentenceTokenizer();
    this.syllableModule = null;
    
    // Regex to match words only (letters, numbers, hyphens/apostrophes within words)
    // This excludes punctuation and symbols
    this.wordRegex = /\b[a-zA-Z0-9]+(?:[-'][a-zA-Z0-9]+)*\b/g;
    
    this.regulatoryKeywords = null; // Will be loaded from database
  }

  async getKeywords() {
    if (!this.regulatoryKeywords) {
      try {
        this.regulatoryKeywords = await Settings.getSetting('regulatory_keywords', Settings.getDefaultKeywords());
        console.log('TextAnalyzer - Loaded keywords from database:', this.regulatoryKeywords);
      } catch (error) {
        console.error('Failed to load custom keywords, using defaults:', error);
        this.regulatoryKeywords = Settings.getDefaultKeywords();
        console.log('TextAnalyzer - Using default keywords:', this.regulatoryKeywords);
      }
    }
    return this.regulatoryKeywords;
  }

  async loadSyllableModule() {
    if (!this.syllableModule) {
      this.syllableModule = await import('syllable');
    }
    return this.syllableModule;
  }

  cleanText(text) {
    // Remove HTML/XML tags
    let cleanedText = text.replace(/<[^>]*>/g, ' ');
    
    // Remove common XML entities
    cleanedText = cleanedText.replace(/&[a-zA-Z]+;/g, ' ');
    cleanedText = cleanedText.replace(/&#\d+;/g, ' ');
    
    // Replace multiple spaces with single space
    cleanedText = cleanedText.replace(/\s+/g, ' ');
    
    return cleanedText.trim();
  }

  countWords(text) {
    // Clean the text first to remove any XML/HTML tags
    const cleanedText = this.cleanText(text);
    
    // Use regex to match words only (letters, numbers, hyphens within words)
    // This excludes punctuation and symbols
    const words = cleanedText.match(this.wordRegex);
    
    return words ? words.length : 0;
  }

  async analyzeKeywords(text) {
    // Clean the text first
    const cleanedText = this.cleanText(text);
    const lowerText = cleanedText.toLowerCase();
    const frequency = {};

    const keywords = await this.getKeywords();
    
    keywords.forEach(keyword => {
      // Handle multi-word keywords
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = lowerText.match(regex);
      // Create a camelCase key for multi-word keywords
      const key = keyword.replace(/\s+(.)/g, (match, chr) => chr.toUpperCase()).replace(/\s+/g, '');
      frequency[key] = matches ? matches.length : 0;
    });

    return frequency;
  }

  async calculateComplexity(text) {
    // Custom complexity score based on:
    // 1. Average sentence length
    // 2. Number of complex words (3+ syllables)
    // 3. Sentence structure variation
    
    const cleanedText = this.cleanText(text);
    const sentences = this.sentenceTokenizer.tokenize(cleanedText);
    
    // Use regex to get words consistently
    const words = cleanedText.match(this.wordRegex) || [];
    
    if (sentences.length === 0 || words.length === 0) return 0;

    // Average sentence length
    const avgSentenceLength = words.length / sentences.length;
    
    // Complex words ratio
    const syllableModule = await this.loadSyllableModule();
    const syllable = syllableModule.syllable || syllableModule.default;
    const complexWords = words.filter(word => syllable(word) >= 3).length;
    const complexWordRatio = complexWords / words.length;
    
    // Sentence length variation
    const sentenceLengths = sentences.map(s => {
      const sentenceWords = s.match(this.wordRegex) || [];
      return sentenceWords.length;
    });
    const lengthVariance = this.calculateVariance(sentenceLengths);
    
    // Normalize scores and combine
    const sentenceLengthScore = Math.min(avgSentenceLength / 30, 1) * 40;
    const complexWordScore = complexWordRatio * 40;
    const varianceScore = Math.min(lengthVariance / 100, 1) * 20;
    
    return Math.round(sentenceLengthScore + complexWordScore + varianceScore);
  }

  async calculateReadability(text) {
    // Flesch Reading Ease score
    // 206.835 - 1.015 * (total words / total sentences) - 84.6 * (total syllables / total words)
    
    const cleanedText = this.cleanText(text);
    const sentences = this.sentenceTokenizer.tokenize(cleanedText);
    
    // Use regex to get words consistently
    const words = cleanedText.match(this.wordRegex) || [];
    
    if (sentences.length === 0 || words.length === 0) return 100;

    const syllableModule = await this.loadSyllableModule();
    const syllable = syllableModule.syllable || syllableModule.default;
    const totalSyllables = words.reduce((sum, word) => sum + syllable(word), 0);
    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = totalSyllables / words.length;
    
    const score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
    
    // Clamp between 0 and 100
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  getAverageSentenceLength(text) {
    const cleanedText = this.cleanText(text);
    const sentences = this.sentenceTokenizer.tokenize(cleanedText);
    
    // Use regex to get words consistently
    const words = cleanedText.match(this.wordRegex) || [];
    
    if (sentences.length === 0) return 0;
    
    return Math.round(words.length / sentences.length);
  }

  calculateVariance(numbers) {
    if (numbers.length === 0) return 0;
    
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / numbers.length;
    
    return variance;
  }
}

module.exports = TextAnalyzer;