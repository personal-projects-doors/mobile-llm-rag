import { Database } from '@nozbe/watermelondb';
import { PerformanceOptimizer } from './PerformanceOptimizer';

/**
 * Example demonstrating how to use the performance optimization system
 * in a RAG application.
 */
export class RAGPerformanceExample {
  private optimizer: PerformanceOptimizer;
  private database: Database;

  constructor(database: Database) {
    this.database = database;
    
    // Initialize the performance optimizer with custom configuration
    this.optimizer = new PerformanceOptimizer(database, {
      enableAutoOptimization: true,
      optimizationInterval: 30000, // 30 seconds
      performanceThresholds: {
        maxMemoryUsage: 200, // 200MB
        maxQueryTime: 1500, // 1.5 seconds
        minCacheHitRate: 0.75, // 75%
      },
      backgroundProcessor: {
        maxConcurrentTasks: 3,
        pauseOnBackground: true,
        lowMemoryThreshold: 150, // 150MB
      },
      memoryManager: {
        maxEmbeddingCacheSize: 100, // 100MB
        maxDocumentCacheSize: 50, // 50MB
        enableAutoCleanup: true,
      },
      databaseIndexer: {
        enableVectorIndex: true,
        vectorDimensions: 384, // medgemma-4b-it-Q2_K_L dimensions
        indexBatchSize: 100,
      },
      lazyLoader: {
        pageSize: 50,
        maxCachedPages: 10,
        enablePrefetching: true,
      },
    });

    this.setupPerformanceMonitoring();
  }

  private setupPerformanceMonitoring(): void {
    // Monitor performance metrics and react to changes
    this.optimizer.onPerformanceUpdate((metrics) => {
      console.log('Performance Update:', {
        memoryUsage: `${metrics.memory.totalUsed.toFixed(1)}MB`,
        activeTasks: metrics.processing.activeTasks,
        avgQueryTime: `${metrics.database.averageQueryTime.toFixed(0)}ms`,
        cacheHitRate: `${(metrics.database.cacheHitRate * 100).toFixed(1)}%`,
      });

      // React to performance issues
      if (metrics.memory.isLowMemory) {
        console.warn('Low memory detected, consider reducing cache sizes');
      }

      if (metrics.database.averageQueryTime > 2000) {
        console.warn('Slow queries detected, consider rebuilding index');
      }
    });
  }

  /**
   * Process a new document with performance optimization
   */
  public async processDocument(documentPath: string, documentId: string): Promise<void> {
    try {
      console.log(`Processing document: ${documentId}`);

      // 1. Extract text and create chunks (simulated)
      const chunks = await this.simulateDocumentProcessing(documentPath);
      
      // 2. Add document to index using background processing
      await this.optimizer.addDocumentToIndex(documentId, chunks);
      
      // 3. Generate embeddings using background processing
      await this.optimizer.generateEmbeddings(chunks, 'medgemma-4b-it-Q2_K_L');
      
      console.log(`Document ${documentId} processed successfully`);
      
    } catch (error) {
      console.error(`Failed to process document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Perform a similarity search with lazy loading
   */
  public async searchDocuments(query: string, maxResults: number = 10): Promise<any[]> {
    try {
      // 1. Generate query embedding (simulated)
      const queryEmbedding = await this.simulateEmbeddingGeneration(query);
      
      // 2. Perform similarity search using optimized database indexer
      const databaseIndexer = this.optimizer.getDatabaseIndexer();
      const results = await databaseIndexer.searchSimilar(
        queryEmbedding,
        maxResults,
        0.7 // minimum similarity
      );
      
      console.log(`Found ${results.length} similar documents for query: "${query}"`);
      return results;
      
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }

  /**
   * Load documents with lazy loading for efficient memory usage
   */
  public async loadDocuments(startIndex: number = 0, count: number = 20): Promise<any[]> {
    try {
      // Create or get lazy loader for documents
      const documentsLoader = this.optimizer.getLazyLoader('rag_documents') || 
                             this.optimizer.createLazyLoader('rag_documents');
      
      // Load documents with lazy loading
      const result = await documentsLoader.getItems(startIndex, count);
      
      console.log(`Loaded ${result.items.length} documents (${startIndex}-${startIndex + count})`);
      console.log(`Total documents: ${result.totalCount}, Has more: ${result.hasMore}`);
      
      return result.items;
      
    } catch (error) {
      console.error('Failed to load documents:', error);
      throw error;
    }
  }

  /**
   * Monitor and optimize performance manually
   */
  public async optimizePerformance(): Promise<void> {
    try {
      console.log('Starting manual performance optimization...');
      
      // Get current performance metrics
      const metrics = await this.optimizer.getPerformanceMetrics();
      console.log('Current Performance Metrics:', {
        memory: `${metrics.memory.totalUsed.toFixed(1)}MB`,
        processing: `${metrics.processing.activeTasks} active, ${metrics.processing.queuedTasks} queued`,
        database: `${metrics.database.totalVectors} vectors, ${metrics.database.averageQueryTime.toFixed(0)}ms avg query`,
        lazyLoading: `${metrics.lazyLoading.loadedPages} pages loaded`,
      });
      
      // Perform optimization
      await this.optimizer.optimizePerformance();
      
      // Get updated metrics
      const updatedMetrics = await this.optimizer.getPerformanceMetrics();
      console.log('Performance optimization completed');
      console.log('Updated Memory Usage:', `${updatedMetrics.memory.totalUsed.toFixed(1)}MB`);
      
    } catch (error) {
      console.error('Performance optimization failed:', error);
      throw error;
    }
  }

  /**
   * Pause all processing (useful during app backgrounding)
   */
  public async pauseProcessing(): Promise<void> {
    console.log('Pausing all processing...');
    await this.optimizer.pauseAllProcessing();
  }

  /**
   * Resume all processing
   */
  public async resumeProcessing(): Promise<void> {
    console.log('Resuming all processing...');
    await this.optimizer.resumeAllProcessing();
  }

  /**
   * Get processing statistics
   */
  public getProcessingStats(): any {
    const processingController = this.optimizer.getProcessingController();
    const backgroundProcessor = this.optimizer.getBackgroundProcessor();
    
    return {
      tasks: processingController.getStatistics(),
      background: backgroundProcessor.getState(),
      memory: this.optimizer.getMemoryManager().getCacheStats(),
    };
  }

  /**
   * Clean shutdown
   */
  public async shutdown(): Promise<void> {
    console.log('Shutting down RAG performance system...');
    await this.optimizer.shutdown();
    console.log('Shutdown complete');
  }

  // Simulation methods (in real implementation, these would use actual processors)
  
  private async simulateDocumentProcessing(documentPath: string): Promise<any[]> {
    // Simulate PDF processing and chunking
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return [
      { id: 'chunk1', text: 'Sample chunk 1 from document', pageNumber: 1 },
      { id: 'chunk2', text: 'Sample chunk 2 from document', pageNumber: 1 },
      { id: 'chunk3', text: 'Sample chunk 3 from document', pageNumber: 2 },
    ];
  }

  private async simulateEmbeddingGeneration(text: string): Promise<number[]> {
    // Simulate embedding generation
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Return a mock embedding vector
    return new Array(384).fill(0).map(() => Math.random() - 0.5);
  }
}

/**
 * Usage example
 */
export async function demonstrateRAGPerformance(database: Database): Promise<void> {
  const ragExample = new RAGPerformanceExample(database);
  
  try {
    // Process some documents
    await ragExample.processDocument('/path/to/doc1.pdf', 'doc1');
    await ragExample.processDocument('/path/to/doc2.pdf', 'doc2');
    
    // Perform searches
    const results = await ragExample.searchDocuments('medical anatomy');
    console.log('Search results:', results.length);
    
    // Load documents with lazy loading
    const documents = await ragExample.loadDocuments(0, 10);
    console.log('Loaded documents:', documents.length);
    
    // Monitor performance
    await ragExample.optimizePerformance();
    
    // Get statistics
    const stats = ragExample.getProcessingStats();
    console.log('Processing statistics:', stats);
    
  } finally {
    // Clean shutdown
    await ragExample.shutdown();
  }
}