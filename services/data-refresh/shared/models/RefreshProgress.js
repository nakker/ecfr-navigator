const mongoose = require('mongoose');

const refreshProgressSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['initial', 'refresh', 'single_title'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    default: 'pending'
  },
  totalTitles: {
    type: Number,
    default: 0
  },
  processedTitles: {
    type: Number,
    default: 0
  },
  failedTitles: [{
    number: Number,
    name: String,
    error: String,
    failedAt: Date
  }],
  currentTitle: {
    number: Number,
    name: String,
    startedAt: Date
  },
  lastProcessedTitle: {
    number: Number,
    name: String,
    completedAt: Date
  },
  startedAt: Date,
  completedAt: Date,
  lastError: String,
  titlesOrder: [Number], // Array to maintain the order of titles to process
  processedTitleNumbers: [Number], // Array of successfully processed title numbers
  triggeredBy: {
    type: String,
    enum: ['scheduled', 'manual', 'manual_single'],
    default: 'scheduled'
  },
  metadata: mongoose.Schema.Types.Mixed // For storing additional data like target title for single refresh
}, {
  timestamps: true
});

// Index for quick lookups
refreshProgressSchema.index({ type: 1, status: 1 });

// Static method to get or create current progress
refreshProgressSchema.statics.getCurrentProgress = async function(type = 'initial') {
  let progress = await this.findOne({ 
    type, 
    status: { $in: ['pending', 'in_progress'] } 
  }).sort({ createdAt: -1 });
  
  if (!progress) {
    progress = await this.create({ type, status: 'pending' });
  }
  
  return progress;
};

// Instance method to mark a title as processed
refreshProgressSchema.methods.markTitleProcessed = async function(titleNumber, titleName) {
  this.processedTitles += 1;
  this.lastProcessedTitle = {
    number: titleNumber,
    name: titleName,
    completedAt: new Date()
  };
  
  if (!this.processedTitleNumbers.includes(titleNumber)) {
    this.processedTitleNumbers.push(titleNumber);
  }
  
  // Clear current title
  this.currentTitle = undefined;
  
  // Check if all titles are processed
  if (this.processedTitles >= this.totalTitles) {
    this.status = 'completed';
    this.completedAt = new Date();
  }
  
  await this.save();
};

// Instance method to mark a title as failed
refreshProgressSchema.methods.markTitleFailed = async function(titleNumber, titleName, error) {
  const errorMessage = error.message || String(error);
  
  this.failedTitles.push({
    number: titleNumber,
    name: titleName,
    error: errorMessage,
    failedAt: new Date()
  });
  
  this.lastError = errorMessage;
  this.currentTitle = undefined;
  
  await this.save();
};

// Instance method to get next title to process
refreshProgressSchema.methods.getNextTitle = function(allTitles) {
  // Filter out already processed titles
  const remainingTitles = allTitles.filter(title => 
    !this.processedTitleNumbers.includes(title.number) &&
    !title.reserved // Skip reserved titles
  );
  
  return remainingTitles[0] || null;
};

// Instance method to check if should retry failed title
refreshProgressSchema.methods.shouldRetryTitle = function(titleNumber) {
  const failedTitle = this.failedTitles.find(t => t.number === titleNumber);
  if (!failedTitle) return true;
  
  // Retry if it's been more than 30 minutes since last failure
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  return failedTitle.failedAt < thirtyMinutesAgo;
};

module.exports = mongoose.model('RefreshProgress', refreshProgressSchema);