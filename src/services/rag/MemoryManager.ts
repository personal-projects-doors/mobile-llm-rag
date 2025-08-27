import { RAGError, RAGErrorCategory } from './types';

export interface MemoryStats {
  totalUsed: number; // MB
  embeddingCache: number; // MB
  documentCache: number; // MB
  processingBuffer: number; // MB
  available: number; // MB
  threshold: number; // MB
  isLowMemory: boolean;
}

export interface MemoryConfig {
  maxEmbeddingCacheSize: number; // MB
  maxDocumentCacheSize: number; // MB
  maxProcessingBuffer: number; // MB
  lowMemoryThreshold: number; // MB
  criticalMemoryThreshold: number; // MB
  enableAutoCleanup: boolean;
  cleanupInterval: number; // milliseconds
}

export interface CacheEntry<T> {
  key: string;
  data: T;
  size: number; // bytes
  lastAccessed: Date;
  accessCount: number;
  priority: 'low' | 'medium' | 'high';
}

export class MemoryManager {
  private config: MemoryConfig;
  private embeddingCache: Map<string, CacheEntry<number[]>> = new Map();
  private documentCache: Map<string, CacheEntry<string>> = new Map();
  private processingBuffer: Map<string, CacheEntry<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private memoryWarningCallbacks: Array<(stats: MemoryStats) => void> = [];
  private lastCleanup: Date = new Date();

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = {
      maxEmbeddingCacheSize: 100, // 100MB
      maxDocumentCacheSize: 50, // 50MB
      maxProcessingBuffer: 30, // 30MB
      lowMemoryThreshold: 200, // 200MB
      criticalMemoryThreshold: 300, // 300MB
      enableAutoCleanup: true,
      cleanupInterval: 30000, // 30 seconds
      ...config,
    };

    if (this.config.enableAutoCleanup) {
      this.startAutoCleanup();
    }
  }

  private startAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.performAutoCleanup();
    }, this.config.cleanupInterval);
  }

  private async performAutoCleanup(): Promise<void> {
    try {
      const stats = await this.getMemoryStats();
      
      if (stats.isLowMemory) {
        console.warn('Low memory detected, performing cleanup');
        await this.cleanup();
        
        // Notify callbacks
        this.memoryWarningCallbacks.forEach(callback => {
          try {
            callback(stats);
          } catch (error) {
            console.error('Memory warning callback failed:', error);
          }
        });
      }
    } catch (error) {
      console.error('Auto cleanup failed:', error);
    }
  }

  public async getMemoryStats(): Promise<MemoryStats> {
    const embeddingCacheSize = this.calculateCacheSize(this.embeddingCache);
    const documentCacheSize = this.calculateCacheSize(this.documentCache);
    const processingBufferSize = this.calculateCacheSize(this.processingBuffer);
    
    const totalUsed = embeddingCacheSize + documentCacheSize + processingBufferSize;
    const available = await this.getAvailableMemory();
    const isLowMemory = totalUsed > this.config.lowMemoryThreshold || 
                       available < this.config.lowMemoryThreshold;

    return {
      totalUsed,
      embeddingCache: embeddingCacheSize,
      documentCache: documentCacheSize,
      processingBuffer: processingBufferSize,
      available,
      threshold: this.config.lowMemoryThreshold,
      isLowMemory,
    };
  }

  private calculateCacheSize<T>(cache: Map<string, CacheEntry<T>>): number {
    let totalSize = 0;
    cache.forEach(entry => {
      totalSize += entry.size;
    });
    return totalSize / (1024 * 1024); // Convert to MB
  }

  private async getAvailableMemory(): Promise<number> {
    // This would need platform-specific implementation
    // For now, return a simulated value
    return 500; // 500MB available
  }

  // Embedding cache management
  public cacheEmbedding(key: string, embedding: number[], priority: 'low' | 'medium' | 'high' = 'medium'): void {
    const size = embedding.length * 4; // 4 bytes per float32
    const entry: CacheEntry<number[]> = {
      key,
      data: embedding,
      size,
      lastAccessed: new Date(),
      accessCount: 1,
      priority,
    };

    // Check if adding this entry would exceed cache limit
    const currentSize = this.calculateCacheSize(this.embeddingCache);
    const maxSize = this.config.maxEmbeddingCacheSize;
    
    if ((currentSize + size / (1024 * 1024)) > maxSize) {
      this.evictEmbeddingCache(size);
    }

    this.embeddingCache.set(key, entry);
  }

  public getEmbedding(key: string): number[] | null {
    const entry = this.embeddingCache.get(key);
    if (entry) {
      entry.lastAccessed = new Date();
      entry.accessCount++;
      return entry.data;
    }
    return null;
  }

  public removeEmbedding(key: string): boolean {
    return this.embeddingCache.delete(key);
  }

  private evictEmbeddingCache(requiredSpace: number): void {
    const entries = Array.from(this.embeddingCache.entries());
    
    // Sort by priority (low first) and then by LRU
    entries.sort(([, a], [, b]) => {
      const priorityOrder = { low: 0, medium: 1, high: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      
      // If same priority, sort by last accessed (oldest first)
      return a.lastAccessed.getTime() - b.lastAccessed.getTime();
    });

    let freedSpace = 0;
    const requiredSpaceMB = requiredSpace / (1024 * 1024);
    
    for (const [key, entry] of entries) {
      if (freedSpace >= requiredSpaceMB) {
        break;
      }
      
      this.embeddingCache.delete(key);
      freedSpace += entry.size / (1024 * 1024);
    }
  }

  // Document cache management
  public cacheDocument(key: string, content: string, priority: 'low' | 'medium' | 'high' = 'medium'): void {
    const size = content.length * 2; // 2 bytes per character (UTF-16)
    const entry: CacheEntry<string> = {
      key,
      data: content,
      size,
      lastAccessed: new Date(),
      accessCount: 1,
      priority,
    };

    const currentSize = this.calculateCacheSize(this.documentCache);
    const maxSize = this.config.maxDocumentCacheSize;
    
    if ((currentSize + size / (1024 * 1024)) > maxSize) {
      this.evictDocumentCache(size);
    }

    this.documentCache.set(key, entry);
  }

  public getDocument(key: string): string | null {
    const entry = this.documentCache.get(key);
    if (entry) {
      entry.lastAccessed = new Date();
      entry.accessCount++;
      return entry.data;
    }
    return null;
  }

  public removeDocument(key: string): boolean {
    return this.documentCache.delete(key);
  }

  private evictDocumentCache(requiredSpace: number): void {
    const entries = Array.from(this.documentCache.entries());
    
    entries.sort(([, a], [, b]) => {
      const priorityOrder = { low: 0, medium: 1, high: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      
      return a.lastAccessed.getTime() - b.lastAccessed.getTime();
    });

    let freedSpace = 0;
    const requiredSpaceMB = requiredSpace / (1024 * 1024);
    
    for (const [key, entry] of entries) {
      if (freedSpace >= requiredSpaceMB) {
        break;
      }
      
      this.documentCache.delete(key);
      freedSpace += entry.size / (1024 * 1024);
    }
  }

  // Processing buffer management
  public addToProcessingBuffer(key: string, data: any, priority: 'low' | 'medium' | 'high' = 'medium'): void {
    const size = this.estimateObjectSize(data);
    const entry: CacheEntry<any> = {
      key,
      data,
      size,
      lastAccessed: new Date(),
      accessCount: 1,
      priority,
    };

    const currentSize = this.calculateCacheSize(this.processingBuffer);
    const maxSize = this.config.maxProcessingBuffer;
    
    if ((currentSize + size / (1024 * 1024)) > maxSize) {
      this.evictProcessingBuffer(size);
    }

    this.processingBuffer.set(key, entry);
  }

  public getFromProcessingBuffer(key: string): any | null {
    const entry = this.processingBuffer.get(key);
    if (entry) {
      entry.lastAccessed = new Date();
      entry.accessCount++;
      return entry.data;
    }
    return null;
  }

  public removeFromProcessingBuffer(key: string): boolean {
    return this.processingBuffer.delete(key);
  }

  private evictProcessingBuffer(requiredSpace: number): void {
    const entries = Array.from(this.processingBuffer.entries());
    
    entries.sort(([, a], [, b]) => {
      const priorityOrder = { low: 0, medium: 1, high: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      
      return a.lastAccessed.getTime() - b.lastAccessed.getTime();
    });

    let freedSpace = 0;
    const requiredSpaceMB = requiredSpace / (1024 * 1024);
    
    for (const [key, entry] of entries) {
      if (freedSpace >= requiredSpaceMB) {
        break;
      }
      
      this.processingBuffer.delete(key);
      freedSpace += entry.size / (1024 * 1024);
    }
  }

  private estimateObjectSize(obj: any): number {
    // Simple object size estimation
    const jsonString = JSON.stringify(obj);
    return jsonString.length * 2; // 2 bytes per character
  }

  // Memory optimization methods
  public async optimizeMemory(): Promise<void> {
    const stats = await this.getMemoryStats();
    
    if (stats.totalUsed > this.config.lowMemoryThreshold) {
      // Aggressive cleanup
      await this.cleanup(true);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
  }

  public async cleanup(aggressive: boolean = false): Promise<void> {
    const cleanupThreshold = aggressive ? 0.5 : 0.8; // Clean more aggressively if needed
    
    // Clean embedding cache
    const embeddingEntries = Array.from(this.embeddingCache.entries());
    const embeddingsToRemove = Math.floor(embeddingEntries.length * (1 - cleanupThreshold));
    
    embeddingEntries
      .sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime())
      .slice(0, embeddingsToRemove)
      .forEach(([key]) => this.embeddingCache.delete(key));

    // Clean document cache
    const documentEntries = Array.from(this.documentCache.entries());
    const documentsToRemove = Math.floor(documentEntries.length * (1 - cleanupThreshold));
    
    documentEntries
      .sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime())
      .slice(0, documentsToRemove)
      .forEach(([key]) => this.documentCache.delete(key));

    // Clean processing buffer (more aggressive)
    const bufferEntries = Array.from(this.processingBuffer.entries());
    const bufferToRemove = Math.floor(bufferEntries.length * 0.7); // Always clean 70% of buffer
    
    bufferEntries
      .sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime())
      .slice(0, bufferToRemove)
      .forEach(([key]) => this.processingBuffer.delete(key));

    this.lastCleanup = new Date();
  }

  public onMemoryWarning(callback: (stats: MemoryStats) => void): void {
    this.memoryWarningCallbacks.push(callback);
  }

  public removeMemoryWarningCallback(callback: (stats: MemoryStats) => void): void {
    const index = this.memoryWarningCallbacks.indexOf(callback);
    if (index > -1) {
      this.memoryWarningCallbacks.splice(index, 1);
    }
  }

  // Cache statistics
  public getCacheStats(): {
    embedding: { size: number; entries: number; hitRate: number };
    document: { size: number; entries: number; hitRate: number };
    processing: { size: number; entries: number; hitRate: number };
  } {
    return {
      embedding: {
        size: this.calculateCacheSize(this.embeddingCache),
        entries: this.embeddingCache.size,
        hitRate: this.calculateHitRate(this.embeddingCache),
      },
      document: {
        size: this.calculateCacheSize(this.documentCache),
        entries: this.documentCache.size,
        hitRate: this.calculateHitRate(this.documentCache),
      },
      processing: {
        size: this.calculateCacheSize(this.processingBuffer),
        entries: this.processingBuffer.size,
        hitRate: this.calculateHitRate(this.processingBuffer),
      },
    };
  }

  private calculateHitRate<T>(cache: Map<string, CacheEntry<T>>): number {
    if (cache.size === 0) return 0;
    
    let totalAccesses = 0;
    cache.forEach(entry => {
      totalAccesses += entry.accessCount;
    });
    
    return totalAccesses / cache.size;
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.embeddingCache.clear();
    this.documentCache.clear();
    this.processingBuffer.clear();
    this.memoryWarningCallbacks = [];
  }
}