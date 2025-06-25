const { Worker } = require('worker_threads');
const path = require('path');
const logger = require('../shared/utils/logger');
const AnalysisThread = require('../shared/models/AnalysisThread');

class ThreadManager {
  constructor() {
    this.workers = new Map();
    this.threadTypes = ['text_metrics', 'age_distribution', 'version_history', 'section_analysis'];
  }

  async initialize() {
    // Ensure thread status records exist
    for (const threadType of this.threadTypes) {
      await AnalysisThread.findOneAndUpdate(
        { threadType },
        { 
          $setOnInsert: { 
            threadType,
            status: 'stopped',
            progress: { current: 0, total: 0, percentage: 0 }
          }
        },
        { upsert: true, new: true }
      );
    }
    logger.info('ThreadManager initialized with thread types:', this.threadTypes);
  }

  async startThread(threadType, restart = false) {
    try {
      // Check if thread is already running
      const thread = await AnalysisThread.findOne({ threadType });
      if (thread && thread.status === 'running') {
        logger.warn(`Thread ${threadType} is already running`);
        return { success: false, message: 'Thread is already running' };
      }

      // Stop existing worker if any
      if (this.workers.has(threadType)) {
        await this.stopThread(threadType);
      }

      // Update thread status
      await AnalysisThread.findOneAndUpdate(
        { threadType },
        { 
          status: 'running',
          lastStartTime: new Date(),
          error: null,
          ...(restart ? { resumeData: null, progress: { current: 0, total: 0, percentage: 0 } } : {})
        }
      );

      // Create worker based on thread type
      const workerPath = path.join(__dirname, 'workers', `${threadType}Worker.js`);
      const worker = new Worker(workerPath, {
        workerData: { 
          threadType,
          restart,
          mongoUri: process.env.MONGO_URI
        }
      });

      // Handle worker messages
      worker.on('message', async (message) => {
        if (message.type === 'progress') {
          await this.updateProgress(threadType, message.data);
        } else if (message.type === 'error') {
          logger.error(`Worker ${threadType} error: ${JSON.stringify(message.error)}`);
          await this.handleWorkerError(threadType, message.error);
        } else if (message.type === 'completed') {
          await this.handleWorkerComplete(threadType, message.data);
        }
      });

      // Handle worker errors
      worker.on('error', async (error) => {
        logger.error(`Worker ${threadType} crashed: ${error.message || JSON.stringify(error)}`);
        await this.handleWorkerError(threadType, error.message);
      });

      // Handle worker exit
      worker.on('exit', async (code) => {
        if (code !== 0) {
          logger.error(`Worker ${threadType} exited with code ${code}`);
        }
        this.workers.delete(threadType);
      });

      this.workers.set(threadType, worker);
      logger.info(`Started thread: ${threadType}`);
      return { success: true, message: `Thread ${threadType} started successfully` };

    } catch (error) {
      logger.error(`Failed to start thread ${threadType}: ${error.message || JSON.stringify(error)}`);
      return { success: false, message: error.message };
    }
  }

  async stopThread(threadType) {
    try {
      const worker = this.workers.get(threadType);
      if (worker) {
        // Send stop signal to worker
        worker.postMessage({ command: 'stop' });
        
        // Give worker time to clean up
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Terminate if still running
        await worker.terminate();
        this.workers.delete(threadType);
      }

      // Update thread status
      await AnalysisThread.findOneAndUpdate(
        { threadType },
        { 
          status: 'stopped',
          lastStopTime: new Date()
        }
      );

      logger.info(`Stopped thread: ${threadType}`);
      return { success: true, message: `Thread ${threadType} stopped successfully` };

    } catch (error) {
      logger.error(`Failed to stop thread ${threadType}: ${error.message || JSON.stringify(error)}`);
      return { success: false, message: error.message };
    }
  }

  async restartThread(threadType) {
    await this.stopThread(threadType);
    return await this.startThread(threadType, true);
  }

  async updateProgress(threadType, progressData) {
    try {
      const thread = await AnalysisThread.findOne({ threadType });
      if (!thread) return;

      const updates = {};

      if (progressData.progress) {
        updates.progress = progressData.progress;
      }

      if (progressData.currentItem) {
        updates.currentItem = progressData.currentItem;
      }

      if (progressData.resumeData) {
        updates.resumeData = progressData.resumeData;
      }

      if (progressData.statistics) {
        if (progressData.statistics.itemsProcessed !== undefined) {
          updates['statistics.itemsProcessed'] = progressData.statistics.itemsProcessed;
        }
        if (progressData.statistics.averageTimePerItem !== undefined) {
          updates['statistics.averageTimePerItem'] = progressData.statistics.averageTimePerItem;
        }
        if (progressData.statistics.itemsFailed !== undefined) {
          updates['statistics.itemsFailed'] = progressData.statistics.itemsFailed;
        }
      }

      await AnalysisThread.findOneAndUpdate(
        { threadType },
        { $set: updates }
      );
    } catch (error) {
      logger.error(`Failed to update progress for ${threadType}: ${error.message || JSON.stringify(error)}`);
    }
  }

  async handleWorkerError(threadType, error) {
    await AnalysisThread.findOneAndUpdate(
      { threadType },
      { 
        status: 'failed',
        error: error.toString(),
        lastStopTime: new Date()
      }
    );
    this.workers.delete(threadType);
  }

  async handleWorkerComplete(threadType, data) {
    const thread = await AnalysisThread.findOne({ threadType });
    const totalRunTime = (thread.totalRunTime || 0) + 
      (new Date() - new Date(thread.lastStartTime));

    await AnalysisThread.findOneAndUpdate(
      { threadType },
      { 
        status: 'completed',
        lastCompletedTime: new Date(),
        totalRunTime,
        progress: { current: data.total, total: data.total, percentage: 100 },
        'statistics.itemsFailed': data.failedCount || 0,
        resumeData: null  // Reset resume data so next run starts from beginning
      }
    );
    this.workers.delete(threadType);
  }

  async getThreadStatus() {
    const threads = await AnalysisThread.find({});
    return threads.map(thread => ({
      threadType: thread.threadType,
      status: thread.status,
      progress: thread.progress,
      currentItem: thread.currentItem,
      lastStartTime: thread.lastStartTime,
      error: thread.error,
      statistics: thread.statistics
    }));
  }

  async stopAllThreads() {
    const promises = [];
    for (const threadType of this.workers.keys()) {
      promises.push(this.stopThread(threadType));
    }
    await Promise.all(promises);
  }
}

module.exports = ThreadManager;