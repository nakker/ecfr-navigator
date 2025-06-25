const express = require('express');
const logger = require('./shared/utils/logger');

const app = express();
app.use(express.json());

// Thread manager will be set by main process
let threadManager = null;

// Set thread manager
function setThreadManager(tm) {
  threadManager = tm;
}

// Start a thread
app.post('/threads/:threadType/start', async (req, res) => {
  try {
    if (!threadManager) {
      return res.status(503).json({ success: false, error: 'Service not ready' });
    }

    const { threadType } = req.params;
    const { restart = false } = req.body;
    
    const result = await threadManager.startThread(threadType, restart);
    res.json(result);
  } catch (error) {
    logger.error('API error starting thread:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stop a thread
app.post('/threads/:threadType/stop', async (req, res) => {
  try {
    if (!threadManager) {
      return res.status(503).json({ success: false, error: 'Service not ready' });
    }

    const { threadType } = req.params;
    const result = await threadManager.stopThread(threadType);
    res.json(result);
  } catch (error) {
    logger.error('API error stopping thread:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Restart a thread
app.post('/threads/:threadType/restart', async (req, res) => {
  try {
    if (!threadManager) {
      return res.status(503).json({ success: false, error: 'Service not ready' });
    }

    const { threadType } = req.params;
    const result = await threadManager.restartThread(threadType);
    res.json(result);
  } catch (error) {
    logger.error('API error restarting thread:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get thread status
app.get('/threads/status', async (req, res) => {
  try {
    if (!threadManager) {
      return res.status(503).json({ success: false, error: 'Service not ready' });
    }

    const status = await threadManager.getThreadStatus();
    res.json({ success: true, threads: status });
  } catch (error) {
    logger.error('API error getting status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start the API server
function startApiServer(port = 3003) {
  app.listen(port, () => {
    logger.info(`Data Analysis API server started on port ${port}`);
  });
}

module.exports = {
  setThreadManager,
  startApiServer
};