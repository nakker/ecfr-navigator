const mongoose = require('mongoose');

const titleSchema = new mongoose.Schema({
  number: {
    type: Number,
    required: true,
    unique: true,
    min: 1,
    max: 50
  },
  name: {
    type: String,
    required: true
  },
  latestAmendedOn: Date,
  latestIssueDate: Date,
  upToDateAsOf: Date,
  reserved: {
    type: Boolean,
    default: false
  },
  checksum: {
    type: String,
    required: true
  },
  lastDownloaded: {
    type: Date,
    required: true
  },
  lastAnalyzed: Date,
  xmlContent: String,
  isOversized: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// number already has a unique index from the schema definition
titleSchema.index({ lastDownloaded: 1 });
titleSchema.index({ upToDateAsOf: 1 });

module.exports = mongoose.model('Title', titleSchema);