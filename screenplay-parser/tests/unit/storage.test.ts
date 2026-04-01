import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryAdapter, createStorageAdapter } from '../../src/learning/storage-adapter';

describe('Storage Adapters', () => {
  describe('InMemoryAdapter', () => {
    let adapter: InMemoryAdapter;

    beforeEach(() => {
      adapter = new InMemoryAdapter();
    });

    it('should get and set values', async () => {
      await adapter.set('key1', 'value1');
      const result = await adapter.get('key1');
      expect(result).toBe('value1');
    });

    it('should return null for missing keys', async () => {
      const result = await adapter.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should delete keys', async () => {
      await adapter.set('key1', 'value1');
      await adapter.delete('key1');
      const result = await adapter.get('key1');
      expect(result).toBeNull();
    });

    it('should list keys', async () => {
      await adapter.set('prefix_a', '1');
      await adapter.set('prefix_b', '2');
      await adapter.set('other_c', '3');

      const allKeys = await adapter.keys();
      expect(allKeys.length).toBe(3);

      const filtered = await adapter.keys('prefix_');
      expect(filtered.length).toBe(2);
    });

    it('should clear all data', async () => {
      await adapter.set('a', '1');
      await adapter.set('b', '2');
      await adapter.clear();

      const keys = await adapter.keys();
      expect(keys.length).toBe(0);
    });
  });

  describe('createStorageAdapter', () => {
    it('should create an InMemoryAdapter', () => {
      const adapter = createStorageAdapter('memory');
      expect(adapter).toBeInstanceOf(InMemoryAdapter);
    });

    it('should throw for http without baseUrl', () => {
      expect(() => createStorageAdapter('http')).toThrow('baseUrl');
    });

    it('should throw for unknown type', () => {
      expect(() => createStorageAdapter('unknown' as 'memory')).toThrow('Unknown storage type');
    });
  });
});
