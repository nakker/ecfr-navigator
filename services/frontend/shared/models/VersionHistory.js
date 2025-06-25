const mongoose = require('mongoose');

const versionSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  identifier: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  part: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  }
}, { _id: false });

const versionHistorySchema = new mongoose.Schema({
  titleNumber: {
    type: Number,
    required: true,
    unique: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  versions: {
    type: [versionSchema],
    default: []
  }
}, {
  timestamps: true
});

versionHistorySchema.index({ titleNumber: 1 });

module.exports = mongoose.model('VersionHistory', versionHistorySchema);