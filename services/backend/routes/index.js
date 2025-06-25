const express = require('express');
const router = express.Router();
const searchRoutes = require('./search');
const documentRoutes = require('./documents');
const metricsRoutes = require('./metrics');
const titlesRoutes = require('./titles');
const chatRoutes = require('./chat');
const refreshRoutes = require('./refresh');
const analysisRoutes = require('./analysis');
const servicesRoutes = require('./services');
const analysisThreadsRoutes = require('./analysisThreads');
const settingsRoutes = require('./settings');

router.use('/search', searchRoutes);
router.use('/documents', documentRoutes);
router.use('/metrics', metricsRoutes);
router.use('/titles', titlesRoutes);
router.use('/chat', chatRoutes);
router.use('/refresh', refreshRoutes);
router.use('/analysis', analysisRoutes);
router.use('/services', servicesRoutes);
router.use('/analysis-threads', analysisThreadsRoutes);
router.use('/settings', settingsRoutes);

module.exports = router;