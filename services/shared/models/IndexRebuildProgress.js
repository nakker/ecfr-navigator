const mongoose = require('mongoose');

const indexRebuildProgressSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  startTime: Date,
  endTime: Date,
  totalDocuments: {
    type: Number,
    default: 0
  },
  processedDocuments: {
    type: Number,
    default: 0
  },
  indexedDocuments: {
    type: Number,
    default: 0
  },
  failedDocuments: {
    type: Number,
    default: 0
  },
  currentTitle: {
    number: Number,
    name: String
  },
  error: String,
  triggeredBy: {
    type: String,
    default: 'manual'
  },
  operations: {
    deleteIndex: { completed: Boolean, error: String },
    createIndex: { completed: Boolean, error: String },
    indexDocuments: { completed: Boolean, error: String }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('IndexRebuildProgress', indexRebuildProgressSchema);