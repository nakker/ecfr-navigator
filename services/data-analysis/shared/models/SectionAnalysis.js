const mongoose = require('mongoose');

const sectionAnalysisSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true,
    index: true
  },
  titleNumber: {
    type: Number,
    required: true
  },
  sectionIdentifier: {
    type: String,
    required: true,
    index: true
  },
  analysisDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  analysisVersion: {
    type: String,
    default: '1.0'
  },
  summary: {
    type: String,
    required: true
  },
  antiquatedScore: {
    type: Number,
    min: 1,
    max: 100,
    required: true,
    index: true
  },
  antiquatedExplanation: {
    type: String,
    required: true
  },
  businessUnfriendlyScore: {
    type: Number,
    min: 1,
    max: 100,
    required: true,
    index: true
  },
  businessUnfriendlyExplanation: {
    type: String,
    required: true
  },
  metadata: {
    model: {
      type: String,
      default: 'grok-3-mini'
    },
    temperature: {
      type: Number,
      default: 0.3
    }
  }
}, {
  timestamps: true
});

// Create compound indexes for efficient queries
sectionAnalysisSchema.index({ documentId: 1, analysisVersion: 1 }, { unique: true });
sectionAnalysisSchema.index({ titleNumber: 1, antiquatedScore: -1 });
sectionAnalysisSchema.index({ titleNumber: 1, businessUnfriendlyScore: -1 });
sectionAnalysisSchema.index({ analysisDate: -1 });

// Static method to get most antiquated sections (highest scores)
sectionAnalysisSchema.statics.getMostAntiquatedSections = async function(titleNumber = null, limit = 10, minScore = 50) {
  const query = { antiquatedScore: { $gte: minScore } };
  if (titleNumber) {
    query.titleNumber = titleNumber;
  }
  
  return this.find(query)
    .sort({ antiquatedScore: -1, analysisDate: -1 })
    .limit(limit)
    .populate('documentId', 'heading titleName part section identifier')
    .lean();
};

// Static method to get most business-unfriendly sections (highest scores)
sectionAnalysisSchema.statics.getMostBusinessUnfriendlySections = async function(titleNumber = null, limit = 10, minScore = 50) {
  const query = { businessUnfriendlyScore: { $gte: minScore } };
  if (titleNumber) {
    query.titleNumber = titleNumber;
  }
  
  return this.find(query)
    .sort({ businessUnfriendlyScore: -1, analysisDate: -1 })
    .limit(limit)
    .populate('documentId', 'heading titleName part section identifier')
    .lean();
};

// Static method to get analysis stats
sectionAnalysisSchema.statics.getAnalysisStats = async function(titleNumber = null, scoreThreshold = 50) {
  const matchStage = titleNumber ? { $match: { titleNumber } } : { $match: {} };
  
  const stats = await this.aggregate([
    matchStage,
    {
      $group: {
        _id: null,
        totalAnalyzed: { $sum: 1 },
        antiquatedCount: { 
          $sum: { $cond: [{ $gte: ['$antiquatedScore', scoreThreshold] }, 1, 0] }
        },
        businessUnfriendlyCount: { 
          $sum: { $cond: [{ $gte: ['$businessUnfriendlyScore', scoreThreshold] }, 1, 0] }
        },
        avgAntiquatedScore: { $avg: '$antiquatedScore' },
        avgBusinessUnfriendlyScore: { $avg: '$businessUnfriendlyScore' },
        maxAntiquatedScore: { $max: '$antiquatedScore' },
        maxBusinessUnfriendlyScore: { $max: '$businessUnfriendlyScore' },
        lastAnalysisDate: { $max: '$analysisDate' }
      }
    }
  ]);
  
  return stats[0] || {
    totalAnalyzed: 0,
    antiquatedCount: 0,
    businessUnfriendlyCount: 0,
    avgAntiquatedScore: 0,
    avgBusinessUnfriendlyScore: 0,
    maxAntiquatedScore: 0,
    maxBusinessUnfriendlyScore: 0,
    lastAnalysisDate: null
  };
};

module.exports = mongoose.model('SectionAnalysis', sectionAnalysisSchema);