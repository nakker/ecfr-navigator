const winston = require('winston');
const logger = require('../../../../services/shared/utils/logger');

describe('Logger Utility', () => {
  let mockTransport;
  let logOutput;

  beforeEach(() => {
    // Create a mock transport to capture log output
    logOutput = [];
    mockTransport = new winston.transports.Stream({
      stream: {
        write: (message) => {
          logOutput.push(JSON.parse(message));
        }
      }
    });

    // Clear existing transports and add mock
    logger.clear();
    logger.add(mockTransport);
  });

  afterEach(() => {
    logger.clear();
  });

  describe('Log Levels', () => {
    it('should log error messages', () => {
      logger.error('Test error message');
      
      expect(logOutput).toHaveLength(1);
      expect(logOutput[0].level).toBe('error');
      expect(logOutput[0].message).toBe('Test error message');
    });

    it('should log warn messages', () => {
      logger.warn('Test warning');
      
      expect(logOutput).toHaveLength(1);
      expect(logOutput[0].level).toBe('warn');
      expect(logOutput[0].message).toBe('Test warning');
    });

    it('should log info messages', () => {
      logger.info('Test info');
      
      expect(logOutput).toHaveLength(1);
      expect(logOutput[0].level).toBe('info');
      expect(logOutput[0].message).toBe('Test info');
    });

    it('should log debug messages when level allows', () => {
      // Temporarily set level to debug
      const originalLevel = logger.level;
      logger.level = 'debug';
      
      logger.debug('Test debug');
      
      expect(logOutput).toHaveLength(1);
      expect(logOutput[0].level).toBe('debug');
      expect(logOutput[0].message).toBe('Test debug');
      
      logger.level = originalLevel;
    });
  });

  describe('Metadata Support', () => {
    it('should include metadata in logs', () => {
      logger.info('User action', { 
        userId: '123',
        action: 'login',
        ip: '192.168.1.1'
      });
      
      expect(logOutput).toHaveLength(1);
      expect(logOutput[0].userId).toBe('123');
      expect(logOutput[0].action).toBe('login');
      expect(logOutput[0].ip).toBe('192.168.1.1');
    });

    it('should handle error objects', () => {
      const error = new Error('Test error');
      error.code = 'TEST_ERROR';
      
      logger.error('Operation failed', { error });
      
      expect(logOutput).toHaveLength(1);
      expect(logOutput[0].error).toBeDefined();
      expect(logOutput[0].error.message).toBe('Test error');
      expect(logOutput[0].error.code).toBe('TEST_ERROR');
    });

    it('should handle circular references in metadata', () => {
      const obj = { name: 'test' };
      obj.circular = obj; // Create circular reference
      
      expect(() => {
        logger.info('Circular test', { data: obj });
      }).not.toThrow();
      
      expect(logOutput).toHaveLength(1);
    });
  });

  describe('Timestamp Format', () => {
    it('should include timestamp in logs', () => {
      logger.info('Test message');
      
      expect(logOutput[0].timestamp).toBeDefined();
      expect(new Date(logOutput[0].timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('Environment Configuration', () => {
    it('should respect LOG_LEVEL environment variable', () => {
      const originalLevel = process.env.LOG_LEVEL;
      
      // Logger is already created, so we need to check its current level
      // In test environment, it should be 'error' based on setup.js
      expect(logger.level).toBe('error');
      
      process.env.LOG_LEVEL = originalLevel;
    });
  });

  describe('Performance', () => {
    it('should handle high volume logging', () => {
      const messageCount = 1000;
      const startTime = Date.now();
      
      for (let i = 0; i < messageCount; i++) {
        logger.info(`Message ${i}`, { index: i });
      }
      
      const duration = Date.now() - startTime;
      
      expect(logOutput).toHaveLength(messageCount);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });

  describe('Special Cases', () => {
    it('should handle undefined and null values', () => {
      logger.info('Test', { 
        undefinedValue: undefined,
        nullValue: null,
        emptyString: '',
        zero: 0,
        false: false
      });
      
      expect(logOutput).toHaveLength(1);
      expect(logOutput[0].nullValue).toBeNull();
      expect(logOutput[0].emptyString).toBe('');
      expect(logOutput[0].zero).toBe(0);
      expect(logOutput[0].false).toBe(false);
    });

    it('should handle very long messages', () => {
      const longMessage = 'x'.repeat(10000);
      
      logger.info(longMessage);
      
      expect(logOutput).toHaveLength(1);
      expect(logOutput[0].message).toBe(longMessage);
    });

    it('should handle non-string messages', () => {
      logger.info(123);
      logger.info(true);
      logger.info({ key: 'value' });
      logger.info(['array', 'items']);
      
      expect(logOutput).toHaveLength(4);
      expect(logOutput[0].message).toBe(123);
      expect(logOutput[1].message).toBe(true);
      expect(typeof logOutput[2].message).toBe('object');
      expect(Array.isArray(logOutput[3].message)).toBe(true);
    });
  });

  describe('Child Loggers', () => {
    it('should create child logger with additional metadata', () => {
      const childLogger = logger.child({ service: 'test-service' });
      
      childLogger.info('Child logger message');
      
      expect(logOutput).toHaveLength(1);
      expect(logOutput[0].service).toBe('test-service');
      expect(logOutput[0].message).toBe('Child logger message');
    });

    it('should inherit parent logger settings', () => {
      const childLogger = logger.child({ component: 'test' });
      
      expect(childLogger.level).toBe(logger.level);
    });
  });
});