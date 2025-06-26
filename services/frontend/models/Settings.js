const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  description: {
    type: String
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Static method to get settings by key
settingsSchema.statics.getSetting = async function(key, defaultValue = null) {
  const setting = await this.findOne({ key });
  return setting ? setting.value : defaultValue;
};

// Static method to update settings
settingsSchema.statics.setSetting = async function(key, value, description = '') {
  return await this.findOneAndUpdate(
    { key },
    { 
      value, 
      description,
      lastModified: new Date()
    },
    { 
      new: true, 
      upsert: true 
    }
  );
};

// Default regulatory keywords
settingsSchema.statics.getDefaultKeywords = function() {
  return [
    'shall',
    'must',
    'prohibited',
    'required',
    'fee',
    'cost',
    'reporting requirement'
  ];
};

module.exports = mongoose.model('Settings', settingsSchema);