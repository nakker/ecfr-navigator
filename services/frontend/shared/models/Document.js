const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

const documentSchema = new mongoose.Schema({
  titleNumber: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['title', 'subtitle', 'chapter', 'subchapter', 'part', 'subpart', 'subjectgroup', 'section', 'appendix']
  },
  identifier: {
    type: String,
    required: true
  },
  node: String, // NODE attribute from XML (structured internal value)
  subtitle: String, // DIV2 N attribute
  chapter: String, // DIV3 N attribute
  subchapter: String, // DIV4 N attribute
  part: String, // DIV5 N attribute
  subpart: String, // DIV6 N attribute
  subjectGroup: String, // DIV7 N attribute
  section: String, // DIV8 N attribute
  heading: String, // HEAD element content
  authority: String, // AUTH element content
  source: String, // SOURCE element content
  structuredContent: {
    type: mongoose.Schema.Types.Mixed, // Store structured content preserving XML elements
    required: false
  },
  structuredContentGridFS: {
    type: ObjectId, // Reference to GridFS file if content is too large
    ref: 'fs.files'
  },
  content: {
    type: String, // Plain text content for search
    required: true
  },
  formattedContent: {
    type: String, // Content with HTML formatting preserved
    required: false
  },
  contentGridFS: {
    type: ObjectId, // Reference to GridFS file if content is too large
    ref: 'fs.files'
  },
  formattedContentGridFS: {
    type: ObjectId, // Reference to GridFS file if formatted content is too large
    ref: 'fs.files'
  },
  contentLength: {
    type: Number, // Track content size
    default: 0
  },
  citations: {
    type: [{
      text: { type: String, required: true },
      type: { type: String, required: true }
    }],
    default: []
  },
  editorialNotes: {
    type: [{
      heading: { type: String, required: true },
      content: { type: String, required: true }
    }],
    default: []
  },
  images: {
    type: [{
      src: { type: String, required: true },
      alt: { type: String },
      pdfLink: { type: String }
    }],
    default: []
  },
  effectiveDate: Date,
  amendmentDate: Date, // AMDDATE from XML
  lastModified: Date
}, {
  timestamps: true
});

documentSchema.index({ titleNumber: 1, type: 1 });
documentSchema.index({ titleNumber: 1, identifier: 1 }, { unique: true });
documentSchema.index({ '$**': 'text' });

module.exports = mongoose.model('Document', documentSchema);