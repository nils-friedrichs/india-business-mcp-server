interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class TtlCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private ttlMs: number;

  /**
   * @param ttlMinutes Time to live in minutes. Defaults to 60.
   */
  constructor(ttlMinutes = 60) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  /**
   * Retrieves an item from the cache. Returns null if expired or not found.
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const isExpired = Date.now() - entry.timestamp > this.ttlMs;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Saves an item to the cache.
   */
  set(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Clears the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }
}
