const mongoose = require('mongoose');

const analysisThreadSchema = new mongoose.Schema({
  threadType: {
    type: String,
    enum: ['text_metrics', 'age_distribution', 'version_history', 'section_analysis'],
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['stopped', 'running', 'completed', 'failed'],
    default: 'stopped'
  },
  progress: {
    current: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 }
  },
  currentItem: {
    titleNumber: Number,
    titleName: String,
    description: String
  },
  lastStartTime: Date,
  lastStopTime: Date,
  lastCompletedTime: Date,
  totalRunTime: { type: Number, default: 0 }, // in milliseconds
  error: String,
  resumeData: mongoose.Schema.Types.Mixed, // Store position to resume from
  statistics: {
    itemsProcessed: { type: Number, default: 0 },
    itemsFailed: { type: Number, default: 0 },
    averageTimePerItem: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Add index for quick status lookups
analysisThreadSchema.index({ threadType: 1, status: 1 });

module.exports = mongoose.model('AnalysisThread', analysisThreadSchema);