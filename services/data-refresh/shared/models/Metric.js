const mongoose = require('mongoose');

const metricSchema = new mongoose.Schema({
  titleNumber: {
    type: Number,
    required: true
  },
  analysisDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  metrics: {
    wordCount: Number,
    regulationAgeDistribution: {
      lessThan1Year: Number,
      oneToFiveYears: Number,
      fiveToTenYears: Number,
      tenToTwentyYears: Number,
      moreThanTwentyYears: Number
    },
    keywordFrequency: {
      type: Map,
      of: Number
    },
    complexityScore: Number,
    averageSentenceLength: Number,
    readabilityScore: Number
  }
}, {
  timestamps: true
});

metricSchema.index({ titleNumber: 1, analysisDate: -1 });

module.exports = mongoose.model('Metric', metricSchema);