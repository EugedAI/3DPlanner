import type { StorageAdapter } from '../core/types';

// ============================================================
// IN-MEMORY STORAGE ADAPTER
// ============================================================

/** Simple in-memory storage (no persistence — useful for testing) */
export class InMemoryAdapter implements StorageAdapter {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async keys(prefix?: string): Promise<string[]> {
    const allKeys = Array.from(this.store.keys());
    if (prefix) {
      return allKeys.filter((k) => k.startsWith(prefix));
    }
    return allKeys;
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

// ============================================================
// LOCAL STORAGE ADAPTER (Browser)
// ============================================================

/** Browser localStorage adapter */
export class LocalStorageAdapter implements StorageAdapter {
  private prefix: string;

  constructor(prefix = 'sp_') {
    this.prefix = prefix;
  }

  async get(key: string): Promise<string | null> {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage is not available in this environment');
    }
    return localStorage.getItem(this.prefix + key);
  }

  async set(key: string, value: string): Promise<void> {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage is not available in this environment');
    }
    localStorage.setItem(this.prefix + key, value);
  }

  async delete(key: string): Promise<void> {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage is not available in this environment');
    }
    localStorage.removeItem(this.prefix + key);
  }

  async keys(prefix?: string): Promise<string[]> {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage is not available in this environment');
    }
    const fullPrefix = this.prefix + (prefix ?? '');
    const result: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(fullPrefix)) {
        result.push(key.slice(this.prefix.length));
      }
    }
    return result;
  }

  async clear(): Promise<void> {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage is not available in this environment');
    }
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  }
}

// ============================================================
// INDEXEDDB STORAGE ADAPTER (Browser)
// ============================================================

/** Browser IndexedDB adapter for larger datasets */
export class IndexedDBAdapter implements StorageAdapter {
  private dbName: string;
  private storeName: string;
  private db: IDBDatabase | null = null;

  constructor(dbName = 'screenplay-parser', storeName = 'data') {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available in this environment'));
        return;
      }

      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };
    });
  }

  async get(key: string): Promise<string | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(new Error(`IndexedDB get failed: ${request.error?.message}`));
    });
  }

  async set(key: string, value: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`IndexedDB set failed: ${request.error?.message}`));
    });
  }

  async delete(key: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`IndexedDB delete failed: ${request.error?.message}`));
    });
  }

  async keys(prefix?: string): Promise<string[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAllKeys();
      request.onsuccess = () => {
        let keys = (request.result as string[]).filter((k) => typeof k === 'string');
        if (prefix) {
          keys = keys.filter((k) => k.startsWith(prefix));
        }
        resolve(keys);
      };
      request.onerror = () => reject(new Error(`IndexedDB keys failed: ${request.error?.message}`));
    });
  }

  async clear(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`IndexedDB clear failed: ${request.error?.message}`));
    });
  }
}

// ============================================================
// HTTP STORAGE ADAPTER (Backend API)
// ============================================================

/** HTTP-based storage adapter for backend persistence */
export class HttpAdapter implements StorageAdapter {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(baseUrl: string, headers: Record<string, string> = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
      ...headers,
    };
  }

  async get(key: string): Promise<string | null> {
    const response = await fetch(`${this.baseUrl}/storage/${encodeURIComponent(key)}`, {
      headers: this.headers,
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP storage get failed: ${response.status}`);
    const data = await response.json();
    return data.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/storage/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify({ value }),
    });
    if (!response.ok) throw new Error(`HTTP storage set failed: ${response.status}`);
  }

  async delete(key: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/storage/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`HTTP storage delete failed: ${response.status}`);
    }
  }

  async keys(prefix?: string): Promise<string[]> {
    const params = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
    const response = await fetch(`${this.baseUrl}/storage/keys${params}`, {
      headers: this.headers,
    });
    if (!response.ok) throw new Error(`HTTP storage keys failed: ${response.status}`);
    const data = await response.json();
    return data.keys ?? [];
  }

  async clear(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/storage`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!response.ok) throw new Error(`HTTP storage clear failed: ${response.status}`);
  }
}

// ============================================================
// FACTORY
// ============================================================

export type StorageType = 'memory' | 'localStorage' | 'indexedDB' | 'http';

/** Create a storage adapter by type */
export function createStorageAdapter(
  type: StorageType,
  options?: { prefix?: string; dbName?: string; baseUrl?: string; headers?: Record<string, string> }
): StorageAdapter {
  switch (type) {
    case 'memory':
      return new InMemoryAdapter();
    case 'localStorage':
      return new LocalStorageAdapter(options?.prefix);
    case 'indexedDB':
      return new IndexedDBAdapter(options?.dbName);
    case 'http':
      if (!options?.baseUrl) throw new Error('HttpAdapter requires a baseUrl');
      return new HttpAdapter(options.baseUrl, options.headers);
    default:
      throw new Error(`Unknown storage type: ${type}`);
  }
}
