const mongoose = require('mongoose');
const Settings = require('../../../../services/shared/models/Settings');
const { DatabaseHelper } = require('../../../utils/testHelpers');

describe('Settings Model', () => {
  beforeAll(async () => {
    await DatabaseHelper.connectMongo(process.env.MONGODB_URI);
  });

  afterEach(async () => {
    await DatabaseHelper.clearDatabase();
  });

  describe('Schema Validation', () => {
    it('should create a valid setting', async () => {
      const setting = new Settings({
        key: 'testKey',
        value: 'testValue',
        description: 'Test setting'
      });

      const saved = await setting.save();
      expect(saved._id).toBeDefined();
      expect(saved.key).toBe('testKey');
      expect(saved.value).toBe('testValue');
      expect(saved.description).toBe('Test setting');
    });

    it('should require key field', async () => {
      const setting = new Settings({
        value: 'testValue'
      });

      await expect(setting.save()).rejects.toThrow(/key.*required/);
    });

    it('should enforce unique key constraint', async () => {
      await Settings.create({
        key: 'uniqueKey',
        value: 'value1'
      });

      const duplicate = new Settings({
        key: 'uniqueKey',
        value: 'value2'
      });

      await expect(duplicate.save()).rejects.toThrow(/duplicate key/);
    });

    it('should accept mixed type values', async () => {
      // String value
      const stringSetting = await Settings.create({
        key: 'stringKey',
        value: 'string value'
      });
      expect(stringSetting.value).toBe('string value');

      // Number value
      const numberSetting = await Settings.create({
        key: 'numberKey',
        value: 42
      });
      expect(numberSetting.value).toBe(42);

      // Boolean value
      const boolSetting = await Settings.create({
        key: 'boolKey',
        value: true
      });
      expect(boolSetting.value).toBe(true);

      // Array value
      const arraySetting = await Settings.create({
        key: 'arrayKey',
        value: [1, 2, 3]
      });
      expect(arraySetting.value).toEqual([1, 2, 3]);

      // Object value
      const objectSetting = await Settings.create({
        key: 'objectKey',
        value: { foo: 'bar', nested: { value: 123 } }
      });
      expect(objectSetting.value).toEqual({ foo: 'bar', nested: { value: 123 } });
    });
  });

  describe('getSetting', () => {
    it('should retrieve existing setting by key', async () => {
      await Settings.create({
        key: 'testKey',
        value: 'testValue',
        description: 'Test description'
      });

      const result = await Settings.getSetting('testKey');
      expect(result).toBe('testValue');
    });

    it('should return default value if setting not found', async () => {
      const result = await Settings.getSetting('nonExistentKey', 'defaultValue');
      expect(result).toBe('defaultValue');
    });

    it('should return null if no default provided and setting not found', async () => {
      const result = await Settings.getSetting('nonExistentKey');
      expect(result).toBeNull();
    });

    it('should handle complex value types', async () => {
      const complexValue = {
        enabled: true,
        config: {
          timeout: 5000,
          retries: 3
        },
        tags: ['tag1', 'tag2']
      };

      await Settings.create({
        key: 'complexSetting',
        value: complexValue
      });

      const result = await Settings.getSetting('complexSetting');
      expect(result).toEqual(complexValue);
    });

    it('should handle database errors gracefully', async () => {
      // Mock a database error
      const originalFindOne = Settings.findOne;
      Settings.findOne = jest.fn().mockRejectedValue(new Error('DB Error'));

      const result = await Settings.getSetting('testKey', 'fallback');
      expect(result).toBe('fallback');

      Settings.findOne = originalFindOne;
    });
  });

  describe('setSetting', () => {
    it('should create new setting if not exists', async () => {
      const result = await Settings.setSetting('newKey', 'newValue', 'New setting');
      
      expect(result.key).toBe('newKey');
      expect(result.value).toBe('newValue');
      expect(result.description).toBe('New setting');

      // Verify it was saved
      const saved = await Settings.findOne({ key: 'newKey' });
      expect(saved).toBeDefined();
      expect(saved.value).toBe('newValue');
    });

    it('should update existing setting', async () => {
      // Create initial setting
      await Settings.create({
        key: 'existingKey',
        value: 'oldValue',
        description: 'Old description'
      });

      // Update it
      const result = await Settings.setSetting('existingKey', 'newValue', 'New description');
      
      expect(result.key).toBe('existingKey');
      expect(result.value).toBe('newValue');
      expect(result.description).toBe('New description');

      // Verify only one document exists
      const count = await Settings.countDocuments({ key: 'existingKey' });
      expect(count).toBe(1);
    });

    it('should preserve description if not provided on update', async () => {
      await Settings.create({
        key: 'keyWithDesc',
        value: 'value1',
        description: 'Original description'
      });

      await Settings.setSetting('keyWithDesc', 'value2');
      
      const updated = await Settings.findOne({ key: 'keyWithDesc' });
      expect(updated.value).toBe('value2');
      expect(updated.description).toBe('Original description');
    });

    it('should handle concurrent updates', async () => {
      // Test that upsert handles race conditions
      const promises = Array(5).fill(null).map((_, i) => 
        Settings.setSetting('concurrentKey', `value${i}`, `desc${i}`)
      );

      await Promise.all(promises);

      // Should only have one document
      const count = await Settings.countDocuments({ key: 'concurrentKey' });
      expect(count).toBe(1);

      // Value should be from one of the updates
      const saved = await Settings.findOne({ key: 'concurrentKey' });
      expect(saved.value).toMatch(/value[0-4]/);
    });

    it('should handle database errors', async () => {
      const originalFindOneAndUpdate = Settings.findOneAndUpdate;
      Settings.findOneAndUpdate = jest.fn().mockRejectedValue(new Error('DB Error'));

      await expect(Settings.setSetting('errorKey', 'value'))
        .rejects.toThrow('DB Error');

      Settings.findOneAndUpdate = originalFindOneAndUpdate;
    });
  });

  describe('getDefaultKeywords', () => {
    it('should return array of default keywords', () => {
      const keywords = Settings.getDefaultKeywords();
      
      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords).toContain('shall');
      expect(keywords).toContain('must');
      expect(keywords).toContain('required');
      expect(keywords).toContain('prohibited');
    });

    it('should return consistent keywords', () => {
      const keywords1 = Settings.getDefaultKeywords();
      const keywords2 = Settings.getDefaultKeywords();
      
      expect(keywords1).toEqual(keywords2);
    });

    it('should return keywords suitable for regulatory text', () => {
      const keywords = Settings.getDefaultKeywords();
      const regulatoryTerms = [
        'shall', 'must', 'required', 'prohibited', 'mandatory',
        'compliance', 'violation', 'penalty', 'enforce', 'regulate'
      ];
      
      const hasRegulatoryTerms = regulatoryTerms.some(term => 
        keywords.includes(term)
      );
      
      expect(hasRegulatoryTerms).toBe(true);
    });
  });

  describe('Timestamps', () => {
    it('should auto-populate createdAt and updatedAt', async () => {
      const setting = await Settings.create({
        key: 'timestampTest',
        value: 'test'
      });

      expect(setting.createdAt).toBeDefined();
      expect(setting.updatedAt).toBeDefined();
      expect(setting.createdAt).toEqual(setting.updatedAt);
    });

    it('should update updatedAt on modification', async () => {
      const setting = await Settings.create({
        key: 'updateTest',
        value: 'initial'
      });

      const initialUpdatedAt = setting.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await Settings.setSetting('updateTest', 'modified');
      
      const updated = await Settings.findOne({ key: 'updateTest' });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });
  });
});