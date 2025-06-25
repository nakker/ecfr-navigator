const mongoose = require('mongoose');

const analysisProgressSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['comprehensive', 'single_title'],
    default: 'comprehensive'
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    default: 'pending'
  },
  startTime: Date,
  endTime: Date,
  totalTitles: Number,
  processedTitles: Number,
  currentTitle: {
    number: Number,
    name: String
  },
  failedTitles: [{
    number: Number,
    name: String,
    error: String
  }],
  error: String,
  triggeredBy: {
    type: String,
    enum: ['startup', 'manual'],
    default: 'manual'
  },
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

module.exports = mongoose.model('AnalysisProgress', analysisProgressSchema);