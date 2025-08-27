import { MemoryManager } from '../MemoryManager';

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;

  beforeEach(() => {
    memoryManager = new MemoryManager({
      maxEmbeddingCacheSize: 10, // 10MB for testing
      maxDocumentCacheSize: 5, // 5MB for testing
      maxProcessingBuffer: 3, // 3MB for testing
      enableAutoCleanup: false, // Disable for testing
    });
  });

  afterEach(() => {
    memoryManager.destroy();
  });

  describe('Embedding Cache', () => {
    it('should cache and retrieve embeddings', () => {
      const embedding = new Array(384).fill(0.5); // Typical embedding size
      const key = 'test-embedding-1';

      memoryManager.cacheEmbedding(key, embedding, 'high');
      const retrieved = memoryManager.getEmbedding(key);

      expect(retrieved).toEqual(embedding);
    });

    it('should evict old embeddings when cache is full', () => {
      // Fill cache with embeddings
      const embeddings: Array<{ key: string; data: number[] }> = [];
      
      for (let i = 0; i < 100; i++) {
        const key = `embedding-${i}`;
        const embedding = new Array(1000).fill(i); // Large embeddings to fill cache quickly
        embeddings.push({ key, data: embedding });
        memoryManager.cacheEmbedding(key, embedding, 'low');
      }

      // First embedding should be evicted
      const firstEmbedding = memoryManager.getEmbedding(embeddings[0].key);
      expect(firstEmbedding).toBeNull();

      // Last embedding should still be there
      const lastEmbedding = memoryManager.getEmbedding(embeddings[embeddings.length - 1].key);
      expect(lastEmbedding).toEqual(embeddings[embeddings.length - 1].data);
    });

    it('should prioritize high priority embeddings during eviction', () => {
      const lowPriorityKey = 'low-priority';
      const highPriorityKey = 'high-priority';
      
      const embedding = new Array(1000).fill(0.5);
      
      memoryManager.cacheEmbedding(lowPriorityKey, embedding, 'low');
      memoryManager.cacheEmbedding(highPriorityKey, embedding, 'high');

      // Fill cache to trigger eviction
      for (let i = 0; i < 50; i++) {
        memoryManager.cacheEmbedding(`filler-${i}`, embedding, 'medium');
      }

      // High priority should still be there, low priority should be evicted
      expect(memoryManager.getEmbedding(highPriorityKey)).toEqual(embedding);
      expect(memoryManager.getEmbedding(lowPriorityKey)).toBeNull();
    });

    it('should remove specific embeddings', () => {
      const key = 'test-embedding';
      const embedding = new Array(384).fill(0.5);

      memoryManager.cacheEmbedding(key, embedding);
      expect(memoryManager.getEmbedding(key)).toEqual(embedding);

      const removed = memoryManager.removeEmbedding(key);
      expect(removed).toBe(true);
      expect(memoryManager.getEmbedding(key)).toBeNull();
    });
  });

  describe('Document Cache', () => {
    it('should cache and retrieve documents', () => {
      const content = 'This is a test document with some content.';
      const key = 'test-doc-1';

      memoryManager.cacheDocument(key, content, 'medium');
      const retrieved = memoryManager.getDocument(key);

      expect(retrieved).toBe(content);
    });

    it('should evict documents when cache is full', () => {
      const largeContent = 'x'.repeat(1000000); // 1MB content
      
      // Fill cache
      for (let i = 0; i < 10; i++) {
        memoryManager.cacheDocument(`doc-${i}`, largeContent);
      }

      // First document should be evicted
      expect(memoryManager.getDocument('doc-0')).toBeNull();
      
      // Last document should still be there
      expect(memoryManager.getDocument('doc-9')).toBe(largeContent);
    });

    it('should update access time on retrieval', () => {
      const content = 'Test content';
      memoryManager.cacheDocument('doc-1', content);
      memoryManager.cacheDocument('doc-2', content);

      // Access doc-1 to update its access time
      memoryManager.getDocument('doc-1');

      // Fill cache to trigger eviction
      const largeContent = 'x'.repeat(1000000);
      for (let i = 0; i < 10; i++) {
        memoryManager.cacheDocument(`filler-${i}`, largeContent);
      }

      // doc-1 should still be there (recently accessed)
      // doc-2 should be evicted (not accessed recently)
      expect(memoryManager.getDocument('doc-1')).toBe(content);
      expect(memoryManager.getDocument('doc-2')).toBeNull();
    });
  });

  describe('Processing Buffer', () => {
    it('should manage processing buffer', () => {
      const data = { chunks: ['chunk1', 'chunk2'], metadata: { id: 'test' } };
      const key = 'processing-1';

      memoryManager.addToProcessingBuffer(key, data);
      const retrieved = memoryManager.getFromProcessingBuffer(key);

      expect(retrieved).toEqual(data);
    });

    it('should evict processing buffer items when full', () => {
      const largeData = { data: 'x'.repeat(500000) }; // 500KB data
      
      // Fill buffer
      for (let i = 0; i < 10; i++) {
        memoryManager.addToProcessingBuffer(`buffer-${i}`, largeData);
      }

      // First item should be evicted
      expect(memoryManager.getFromProcessingBuffer('buffer-0')).toBeNull();
      
      // Last item should still be there
      expect(memoryManager.getFromProcessingBuffer('buffer-9')).toEqual(largeData);
    });
  });

  describe('Memory Statistics', () => {
    it('should provide accurate memory statistics', async () => {
      // Add some data to caches
      const embedding = new Array(1000).fill(0.5);
      const document = 'x'.repeat(100000); // 100KB
      const bufferData = { data: 'x'.repeat(50000) }; // 50KB

      memoryManager.cacheEmbedding('test-embedding', embedding);
      memoryManager.cacheDocument('test-doc', document);
      memoryManager.addToProcessingBuffer('test-buffer', bufferData);

      const stats = await memoryManager.getMemoryStats();

      expect(stats.embeddingCache).toBeGreaterThan(0);
      expect(stats.documentCache).toBeGreaterThan(0);
      expect(stats.processingBuffer).toBeGreaterThan(0);
      expect(stats.totalUsed).toBeGreaterThan(0);
    });

    it('should detect low memory conditions', async () => {
      const memoryManager = new MemoryManager({
        lowMemoryThreshold: 1, // 1MB threshold for testing
      });

      // Fill caches to exceed threshold
      const largeEmbedding = new Array(100000).fill(0.5); // Large embedding
      for (let i = 0; i < 10; i++) {
        memoryManager.cacheEmbedding(`embedding-${i}`, largeEmbedding);
      }

      const stats = await memoryManager.getMemoryStats();
      expect(stats.isLowMemory).toBe(true);

      memoryManager.destroy();
    });
  });

  describe('Memory Optimization', () => {
    it('should perform cleanup when requested', async () => {
      // Fill caches
      const embedding = new Array(1000).fill(0.5);
      const document = 'x'.repeat(10000);
      
      for (let i = 0; i < 20; i++) {
        memoryManager.cacheEmbedding(`embedding-${i}`, embedding);
        memoryManager.cacheDocument(`doc-${i}`, document);
      }

      const statsBefore = await memoryManager.getMemoryStats();
      
      await memoryManager.cleanup();
      
      const statsAfter = await memoryManager.getMemoryStats();
      
      expect(statsAfter.totalUsed).toBeLessThan(statsBefore.totalUsed);
    });

    it('should perform aggressive cleanup when needed', async () => {
      // Fill caches
      const embedding = new Array(1000).fill(0.5);
      
      for (let i = 0; i < 30; i++) {
        memoryManager.cacheEmbedding(`embedding-${i}`, embedding);
      }

      const statsBefore = await memoryManager.getMemoryStats();
      
      await memoryManager.cleanup(true); // Aggressive cleanup
      
      const statsAfter = await memoryManager.getMemoryStats();
      
      // Aggressive cleanup should remove more items
      expect(statsAfter.totalUsed).toBeLessThan(statsBefore.totalUsed * 0.6);
    });

    it('should optimize memory automatically', async () => {
      const memoryManager = new MemoryManager({
        lowMemoryThreshold: 1, // 1MB threshold
        enableAutoCleanup: true,
        cleanupInterval: 100, // 100ms for testing
      });

      let warningReceived = false;
      memoryManager.onMemoryWarning(() => {
        warningReceived = true;
      });

      // Fill cache to exceed threshold
      const largeEmbedding = new Array(100000).fill(0.5);
      for (let i = 0; i < 10; i++) {
        memoryManager.cacheEmbedding(`embedding-${i}`, largeEmbedding);
      }

      // Wait for auto cleanup to trigger
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(warningReceived).toBe(true);

      memoryManager.destroy();
    });
  });

  describe('Cache Statistics', () => {
    it('should provide cache statistics', () => {
      // Add some data
      const embedding = new Array(384).fill(0.5);
      memoryManager.cacheEmbedding('test-1', embedding);
      memoryManager.cacheEmbedding('test-2', embedding);
      
      // Access one embedding multiple times
      memoryManager.getEmbedding('test-1');
      memoryManager.getEmbedding('test-1');
      memoryManager.getEmbedding('test-2');

      const stats = memoryManager.getCacheStats();
      
      expect(stats.embedding.entries).toBe(2);
      expect(stats.embedding.size).toBeGreaterThan(0);
      expect(stats.embedding.hitRate).toBeGreaterThan(0);
    });
  });
});