// Sample data for testing

const sampleXML = {
  small: `<?xml version="1.0" encoding="UTF-8"?>
<title>
  <num>1</num>
  <name>General Provisions</name>
  <part>
    <num>1</num>
    <name>Organization</name>
    <section>
      <num>1.1</num>
      <subject>Purpose</subject>
      <p>This part describes the organization.</p>
    </section>
  </part>
</title>`,
  
  withMultipleParts: `<?xml version="1.0" encoding="UTF-8"?>
<title>
  <num>2</num>
  <name>Grants and Agreements</name>
  <part>
    <num>200</num>
    <name>Uniform Administrative Requirements</name>
    <section>
      <num>200.1</num>
      <subject>Purpose</subject>
      <p>This part establishes uniform administrative requirements.</p>
    </section>
    <section>
      <num>200.2</num>
      <subject>Definitions</subject>
      <p>As used in this part: Award means financial assistance.</p>
    </section>
  </part>
  <part>
    <num>201</num>
    <name>Cost Principles</name>
    <section>
      <num>201.1</num>
      <subject>Composition of costs</subject>
      <p>The total cost of a Federal award is the sum of the allowable direct and allocable indirect costs.</p>
    </section>
  </part>
</title>`,
  
  malformed: `<?xml version="1.0" encoding="UTF-8"?>
<title>
  <num>3</num>
  <name>Malformed Title</name>
  <part>
    <num>300</num>
    <!-- Missing closing tag -->
    <section>
      <num>300.1</num>
      <subject>Test</subject>
</title>`
};

const sampleDocuments = [
  {
    titleNumber: 1,
    identifier: 'part-1',
    type: 'part',
    label: 'Part 1',
    title: 'Organization',
    content: 'This part describes the organization.',
    hierarchy: {
      title: 1,
      part: '1'
    },
    effectiveDate: new Date('2023-01-01'),
    lastModified: new Date('2023-01-01')
  },
  {
    titleNumber: 1,
    identifier: 'section-1.1',
    type: 'section',
    label: 'Section 1.1',
    title: 'Purpose',
    content: 'This part describes the organization.',
    hierarchy: {
      title: 1,
      part: '1',
      section: '1.1'
    },
    effectiveDate: new Date('2023-01-01'),
    lastModified: new Date('2023-01-01')
  },
  {
    titleNumber: 2,
    identifier: 'part-200',
    type: 'part',
    label: 'Part 200',
    title: 'Uniform Administrative Requirements',
    content: 'This part establishes uniform administrative requirements for Federal awards to non-Federal entities.',
    hierarchy: {
      title: 2,
      part: '200'
    },
    effectiveDate: new Date('2023-01-01'),
    lastModified: new Date('2023-06-01')
  }
];

const sampleMetrics = {
  title: {
    titleNumber: 1,
    type: 'title',
    identifier: null,
    metrics: {
      totalSections: 15,
      totalWords: 2500,
      averageWordsPerSection: 166.67,
      complexityScore: 0.65,
      readabilityScore: 45.2,
      lastUpdated: new Date('2023-12-01')
    },
    calculatedAt: new Date('2023-12-01')
  },
  part: {
    titleNumber: 1,
    type: 'part',
    identifier: 'part-1',
    metrics: {
      totalSections: 5,
      totalWords: 800,
      averageWordsPerSection: 160,
      complexityScore: 0.55,
      readabilityScore: 52.3,
      lastUpdated: new Date('2023-12-01')
    },
    calculatedAt: new Date('2023-12-01')
  }
};

const sampleAnalysisResult = {
  summary: 'This section establishes requirements for grant recipients to maintain proper financial records.',
  keyRequirements: [
    'Maintain records for 3 years after grant closeout',
    'Make records available for federal inspection',
    'Use Generally Accepted Accounting Principles (GAAP)'
  ],
  complianceSteps: [
    'Implement a financial management system that meets federal standards',
    'Train staff on record retention requirements',
    'Establish procedures for federal audits'
  ],
  potentialIssues: [
    'Inadequate record retention policies',
    'Lack of GAAP compliance',
    'Insufficient audit trails'
  ],
  relatedSections: ['200.334', '200.335', '200.336']
};

const sampleSearchQuery = {
  simple: {
    query: 'grant requirements',
    filters: {}
  },
  withFilters: {
    query: 'financial management',
    filters: {
      titleNumbers: [2],
      documentTypes: ['section'],
      dateRange: {
        start: '2023-01-01',
        end: '2023-12-31'
      }
    }
  },
  advanced: {
    query: '(grant OR award) AND (requirement OR standard)',
    filters: {
      titleNumbers: [2, 45],
      documentTypes: ['section', 'part'],
      mustInclude: ['compliance'],
      mustExclude: ['obsolete', 'reserved']
    }
  }
};

const sampleSettings = {
  refreshInterval: 24,
  analysisInterval: 6,
  enableAIAnalysis: true,
  aiProvider: 'gemini',
  aiModel: 'gemini-2.0-flash-exp',
  maxConcurrentAnalysis: 3,
  enabledTitles: [1, 2, 3, 4, 5],
  searchResultsLimit: 50
};

module.exports = {
  sampleXML,
  sampleDocuments,
  sampleMetrics,
  sampleAnalysisResult,
  sampleSearchQuery,
  sampleSettings
};