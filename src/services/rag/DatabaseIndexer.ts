import { Database } from '@nozbe/watermelondb';
import { RAGError, RAGErrorCategory, SearchResult } from './types';
import RAGChunk from '../../database/models/RAGChunk';
import RAGDocument from '../../database/models/RAGDocument';
import { securityManager } from './SecurityManager';

export interface IndexConfig {
  enableVectorIndex: boolean;
  vectorDimensions: number;
  indexBatchSize: number;
  maxIndexSize: number;
  rebuildThreshold: number; // Percentage of changes before rebuild
  enableMetadataIndex: boolean;
  enableFullTextSearch: boolean;
}

export interface IndexStats {
  totalVectors: number;
  indexSize: number; // MB
  lastRebuild: Date | null;
  rebuildCount: number;
  searchPerformance: {
    averageQueryTime: number;
    totalQueries: number;
    cacheHitRate: number;
  };
}

export interface VectorIndex {
  id: string;
  vector: number[];
  metadata: {
    documentId: string;
    chunkId: string;
    pageNumber: number;
    tokenCount: number;
    lastUpdated: Date;
  };
}

export interface SearchIndex {
  vectors: Map<string, VectorIndex>;
  documentIndex: Map<string, string[]>; // documentId -> chunkIds
  metadataIndex: Map<string, any>; // For quick metadata lookups
  fullTextIndex: Map<string, Set<string>>; // word -> chunkIds
}

export class DatabaseIndexer {
  private database: Database;
  private config: IndexConfig;
  private searchIndex: SearchIndex;
  private indexStats: IndexStats;
  private queryTimes: number[] = [];
  private isRebuilding: boolean = false;
  private lastOptimization: Date = new Date();

  constructor(database: Database, config: Partial<IndexConfig> = {}) {
    this.database = database;
    this.config = {
      enableVectorIndex: true,
      vectorDimensions: 384, // Default for medgemma-4b-it-Q2_K_L
      indexBatchSize: 100,
      maxIndexSize: 200, // 200MB
      rebuildThreshold: 0.1, // 10% changes
      enableMetadataIndex: true,
      enableFullTextSearch: true,
      ...config,
    };

    this.searchIndex = {
      vectors: new Map(),
      documentIndex: new Map(),
      metadataIndex: new Map(),
      fullTextIndex: new Map(),
    };

    this.indexStats = {
      totalVectors: 0,
      indexSize: 0,
      lastRebuild: null,
      rebuildCount: 0,
      searchPerformance: {
        averageQueryTime: 0,
        totalQueries: 0,
        cacheHitRate: 0,
      },
    };
  }

  public async buildIndex(): Promise<void> {
    if (this.isRebuilding) {
      throw new RAGError(
        'Index rebuild already in progress',
        'INDEX_REBUILD_IN_PROGRESS',
        RAGErrorCategory.DATABASE,
        { operation: 'build_index' }
      );
    }

    this.isRebuilding = true;
    
    try {
      console.log('Starting index rebuild...');
      
      // Clear existing index
      this.clearIndex();
      
      // Load all chunks from database
      const chunks = await this.loadAllChunks();
      
      // Build vector index in batches
      await this.buildVectorIndex(chunks);
      
      // Build metadata index
      if (this.config.enableMetadataIndex) {
        await this.buildMetadataIndex(chunks);
      }
      
      // Build full-text search index
      if (this.config.enableFullTextSearch) {
        await this.buildFullTextIndex(chunks);
      }
      
      // Update statistics
      this.updateIndexStats();
      
      console.log(`Index rebuild completed. Total vectors: ${this.indexStats.totalVectors}`);
      
    } catch (error) {
      throw new RAGError(
        'Failed to build search index',
        'INDEX_BUILD_FAILED',
        RAGErrorCategory.DATABASE,
        { operation: 'build_index' },
        error instanceof Error ? error : new Error(String(error))
      );
    } finally {
      this.isRebuilding = false;
    }
  }

  private async loadAllChunks(): Promise<any[]> {
    try {
      // Ensure security manager is initialized for decryption
      if (!securityManager.isInitialized()) {
        await securityManager.initialize();
      }

      const chunksCollection = this.database.get<RAGChunk>('rag_chunks');
      const chunks = await chunksCollection.query().fetch();
      
      return chunks.map(chunk => ({
        id: chunk.id,
        documentId: chunk.documentId,
        text: chunk.decryptedText, // Use decrypted text
        pageNumber: chunk.pageNumber,
        chunkIndex: chunk.chunkIndex,
        embedding: chunk.embeddingVector, // Use decrypted embedding
        startChar: chunk.startChar,
        endChar: chunk.endChar,
        tokenCount: chunk.tokenCount,
      }));
    } catch (error) {
      throw new RAGError(
        'Failed to load chunks from database',
        'CHUNK_LOAD_FAILED',
        RAGErrorCategory.DATABASE,
        { operation: 'load_chunks' },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private async buildVectorIndex(chunks: any[]): Promise<void> {
    if (!this.config.enableVectorIndex) return;

    const batchSize = this.config.indexBatchSize;
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      for (const chunk of batch) {
        if (chunk.embedding && Array.isArray(chunk.embedding)) {
          const vectorIndex: VectorIndex = {
            id: chunk.id,
            vector: chunk.embedding,
            metadata: {
              documentId: chunk.documentId,
              chunkId: chunk.id,
              pageNumber: chunk.pageNumber,
              tokenCount: chunk.tokenCount,
              lastUpdated: new Date(),
            },
          };
          
          this.searchIndex.vectors.set(chunk.id, vectorIndex);
          
          // Update document index
          const documentChunks = this.searchIndex.documentIndex.get(chunk.documentId) || [];
          documentChunks.push(chunk.id);
          this.searchIndex.documentIndex.set(chunk.documentId, documentChunks);
        }
      }
      
      // Allow other operations to run
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }

  private async buildMetadataIndex(chunks: any[]): Promise<void> {
    if (!this.config.enableMetadataIndex) return;

    for (const chunk of chunks) {
      this.searchIndex.metadataIndex.set(chunk.id, {
        documentId: chunk.documentId,
        pageNumber: chunk.pageNumber,
        chunkIndex: chunk.chunkIndex,
        tokenCount: chunk.tokenCount,
        startChar: chunk.startChar,
        endChar: chunk.endChar,
      });
    }
  }

  private async buildFullTextIndex(chunks: any[]): Promise<void> {
    if (!this.config.enableFullTextSearch) return;

    for (const chunk of chunks) {
      const words = this.extractWords(chunk.text);
      
      for (const word of words) {
        const chunkIds = this.searchIndex.fullTextIndex.get(word) || new Set();
        chunkIds.add(chunk.id);
        this.searchIndex.fullTextIndex.set(word, chunkIds);
      }
    }
  }

  private extractWords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2); // Filter out very short words
  }

  private clearIndex(): void {
    this.searchIndex.vectors.clear();
    this.searchIndex.documentIndex.clear();
    this.searchIndex.metadataIndex.clear();
    this.searchIndex.fullTextIndex.clear();
  }

  private updateIndexStats(): void {
    this.indexStats.totalVectors = this.searchIndex.vectors.size;
    this.indexStats.indexSize = this.calculateIndexSize();
    this.indexStats.lastRebuild = new Date();
    this.indexStats.rebuildCount++;
  }

  private calculateIndexSize(): number {
    let totalSize = 0;
    
    // Vector index size
    this.searchIndex.vectors.forEach(vectorIndex => {
      totalSize += vectorIndex.vector.length * 4; // 4 bytes per float32
      totalSize += JSON.stringify(vectorIndex.metadata).length * 2; // 2 bytes per char
    });
    
    // Metadata index size
    this.searchIndex.metadataIndex.forEach(metadata => {
      totalSize += JSON.stringify(metadata).length * 2;
    });
    
    // Full-text index size (approximate)
    this.searchIndex.fullTextIndex.forEach((chunkIds, word) => {
      totalSize += word.length * 2; // Word string
      totalSize += chunkIds.size * 36; // Approximate UUID size
    });
    
    return totalSize / (1024 * 1024); // Convert to MB
  }

  public async addToIndex(chunkId: string, embedding: number[], metadata: any): Promise<void> {
    if (!this.config.enableVectorIndex) return;

    const vectorIndex: VectorIndex = {
      id: chunkId,
      vector: embedding,
      metadata: {
        documentId: metadata.documentId,
        chunkId: chunkId,
        pageNumber: metadata.pageNumber,
        tokenCount: metadata.tokenCount,
        lastUpdated: new Date(),
      },
    };

    this.searchIndex.vectors.set(chunkId, vectorIndex);
    
    // Update document index
    const documentChunks = this.searchIndex.documentIndex.get(metadata.documentId) || [];
    if (!documentChunks.includes(chunkId)) {
      documentChunks.push(chunkId);
      this.searchIndex.documentIndex.set(metadata.documentId, documentChunks);
    }
    
    // Update metadata index
    if (this.config.enableMetadataIndex) {
      this.searchIndex.metadataIndex.set(chunkId, metadata);
    }
    
    // Update full-text index
    if (this.config.enableFullTextSearch && metadata.text) {
      const words = this.extractWords(metadata.text);
      for (const word of words) {
        const chunkIds = this.searchIndex.fullTextIndex.get(word) || new Set();
        chunkIds.add(chunkId);
        this.searchIndex.fullTextIndex.set(word, chunkIds);
      }
    }
    
    this.indexStats.totalVectors = this.searchIndex.vectors.size;
  }

  public async removeFromIndex(chunkId: string): Promise<void> {
    const vectorIndex = this.searchIndex.vectors.get(chunkId);
    if (!vectorIndex) return;

    // Remove from vector index
    this.searchIndex.vectors.delete(chunkId);
    
    // Remove from document index
    const documentId = vectorIndex.metadata.documentId;
    const documentChunks = this.searchIndex.documentIndex.get(documentId);
    if (documentChunks) {
      const index = documentChunks.indexOf(chunkId);
      if (index > -1) {
        documentChunks.splice(index, 1);
        if (documentChunks.length === 0) {
          this.searchIndex.documentIndex.delete(documentId);
        } else {
          this.searchIndex.documentIndex.set(documentId, documentChunks);
        }
      }
    }
    
    // Remove from metadata index
    this.searchIndex.metadataIndex.delete(chunkId);
    
    // Remove from full-text index
    this.searchIndex.fullTextIndex.forEach((chunkIds, word) => {
      chunkIds.delete(chunkId);
      if (chunkIds.size === 0) {
        this.searchIndex.fullTextIndex.delete(word);
      }
    });
    
    this.indexStats.totalVectors = this.searchIndex.vectors.size;
  }

  public async searchSimilar(
    queryEmbedding: number[],
    maxResults: number = 10,
    minSimilarity: number = 0.7,
    documentIds?: string[]
  ): Promise<SearchResult[]> {
    const startTime = Date.now();
    
    try {
      const results: Array<{ chunkId: string; similarity: number }> = [];
      
      // Filter by document IDs if specified
      const candidateChunks = documentIds 
        ? this.getChunksForDocuments(documentIds)
        : Array.from(this.searchIndex.vectors.keys());
      
      // Calculate similarities
      for (const chunkId of candidateChunks) {
        const vectorIndex = this.searchIndex.vectors.get(chunkId);
        if (!vectorIndex) continue;
        
        const similarity = this.calculateCosineSimilarity(queryEmbedding, vectorIndex.vector);
        
        if (similarity >= minSimilarity) {
          results.push({ chunkId, similarity });
        }
      }
      
      // Sort by similarity (descending) and limit results
      results.sort((a, b) => b.similarity - a.similarity);
      const topResults = results.slice(0, maxResults);
      
      // Convert to SearchResult format
      const searchResults: SearchResult[] = [];
      
      for (const { chunkId, similarity } of topResults) {
        const metadata = this.searchIndex.metadataIndex.get(chunkId);
        if (metadata) {
          // Load full chunk data from database
          const chunk = await this.loadChunkFromDatabase(chunkId);
          if (chunk) {
            searchResults.push({
              chunkId,
              documentId: metadata.documentId,
              documentName: await this.getDocumentName(metadata.documentId),
              text: chunk.text,
              pageNumber: metadata.pageNumber,
              chunkIndex: metadata.chunkIndex,
              similarity,
              startChar: metadata.startChar,
              endChar: metadata.endChar,
              tokenCount: metadata.tokenCount,
            });
          }
        }
      }
      
      // Update performance stats
      const queryTime = Date.now() - startTime;
      this.updateQueryStats(queryTime);
      
      return searchResults;
      
    } catch (error) {
      throw new RAGError(
        'Similarity search failed',
        'SIMILARITY_SEARCH_FAILED',
        RAGErrorCategory.SIMILARITY_SEARCH,
        { operation: 'search_similar' },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private getChunksForDocuments(documentIds: string[]): string[] {
    const chunks: string[] = [];
    
    for (const documentId of documentIds) {
      const documentChunks = this.searchIndex.documentIndex.get(documentId);
      if (documentChunks) {
        chunks.push(...documentChunks);
      }
    }
    
    return chunks;
  }

  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  private async loadChunkFromDatabase(chunkId: string): Promise<any | null> {
    try {
      const chunksCollection = this.database.get<RAGChunk>('rag_chunks');
      const chunk = await chunksCollection.find(chunkId);
      return {
        id: chunk.id,
        text: chunk.decryptedText, // Use decrypted text
        documentId: chunk.documentId,
        pageNumber: chunk.pageNumber,
        chunkIndex: chunk.chunkIndex,
        startChar: chunk.startChar,
        endChar: chunk.endChar,
        tokenCount: chunk.tokenCount,
      };
    } catch (error) {
      console.error(`Failed to load chunk ${chunkId}:`, error);
      return null;
    }
  }

  private async getDocumentName(documentId: string): Promise<string> {
    try {
      const documentsCollection = this.database.get<RAGDocument>('rag_documents');
      const document = await documentsCollection.find(documentId);
      return document.name;
    } catch (error) {
      console.error(`Failed to load document name for ${documentId}:`, error);
      return 'Unknown Document';
    }
  }

  private updateQueryStats(queryTime: number): void {
    this.queryTimes.push(queryTime);
    
    // Keep only last 100 query times for rolling average
    if (this.queryTimes.length > 100) {
      this.queryTimes.shift();
    }
    
    this.indexStats.searchPerformance.totalQueries++;
    this.indexStats.searchPerformance.averageQueryTime = 
      this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length;
  }

  public async optimizeIndex(): Promise<void> {
    const now = new Date();
    const timeSinceLastOptimization = now.getTime() - this.lastOptimization.getTime();
    
    // Only optimize if it's been at least 5 minutes since last optimization
    if (timeSinceLastOptimization < 300000) {
      return;
    }
    
    console.log('Starting index optimization...');
    
    try {
      // Remove orphaned entries
      await this.removeOrphanedEntries();
      
      // Compact full-text index
      await this.compactFullTextIndex();
      
      // Update statistics
      this.updateIndexStats();
      
      this.lastOptimization = now;
      
      console.log('Index optimization completed');
      
    } catch (error) {
      console.error('Index optimization failed:', error);
    }
  }

  private async removeOrphanedEntries(): Promise<void> {
    // Check for vector entries without corresponding database records
    const orphanedChunks: string[] = [];
    
    for (const chunkId of this.searchIndex.vectors.keys()) {
      try {
        const chunksCollection = this.database.get<RAGChunk>('rag_chunks');
        await chunksCollection.find(chunkId);
      } catch (error) {
        // Chunk not found in database, mark as orphaned
        orphanedChunks.push(chunkId);
      }
    }
    
    // Remove orphaned entries
    for (const chunkId of orphanedChunks) {
      await this.removeFromIndex(chunkId);
    }
    
    console.log(`Removed ${orphanedChunks.length} orphaned index entries`);
  }

  private async compactFullTextIndex(): Promise<void> {
    // Remove empty word entries
    const emptyWords: string[] = [];
    
    this.searchIndex.fullTextIndex.forEach((chunkIds, word) => {
      if (chunkIds.size === 0) {
        emptyWords.push(word);
      }
    });
    
    for (const word of emptyWords) {
      this.searchIndex.fullTextIndex.delete(word);
    }
    
    console.log(`Removed ${emptyWords.length} empty word entries from full-text index`);
  }

  public getIndexStats(): IndexStats {
    return { ...this.indexStats };
  }

  public async rebuildIfNeeded(): Promise<boolean> {
    // Check if rebuild is needed based on configuration
    const changeThreshold = this.config.rebuildThreshold;
    const indexSize = this.indexStats.indexSize;
    const maxSize = this.config.maxIndexSize;
    
    // Rebuild if index is too large or hasn't been rebuilt recently
    const needsRebuild = 
      indexSize > maxSize ||
      (this.indexStats.lastRebuild && 
       (Date.now() - this.indexStats.lastRebuild.getTime()) > 24 * 60 * 60 * 1000); // 24 hours
    
    if (needsRebuild) {
      await this.buildIndex();
      return true;
    }
    
    return false;
  }

  public destroy(): void {
    this.clearIndex();
    this.queryTimes = [];
  }
}