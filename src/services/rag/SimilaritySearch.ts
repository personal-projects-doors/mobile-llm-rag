import {Database} from '@nozbe/watermelondb';
import {Q} from '@nozbe/watermelondb';
import RAGChunk from '../../database/models/RAGChunk';
import RAGDocument from '../../database/models/RAGDocument';
import {
  SearchQuery,
  SearchResult,
  SimilaritySearchConfig,
  SimilaritySearchError,
  SimilaritySearchErrorCodes,
} from './types';

export class SimilaritySearch {
  private database: Database;
  private config: SimilaritySearchConfig;

  constructor(database: Database, config?: Partial<SimilaritySearchConfig>) {
    this.database = database;
    this.config = {
      maxResults: 5,
      minSimilarity: 0.7,
      enableRanking: true,
      rankingWeights: {
        similarity: 0.8,
        recency: 0.1,
        tokenCount: 0.1,
      },
      ...config,
    };
  }

  /**
   * Perform similarity search for a query
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      // Validate query
      this.validateQuery(query);

      // Get chunks with embeddings
      const chunks = await this.getEligibleChunks(query.documentIds);
      
      if (chunks.length === 0) {
        throw new SimilaritySearchError(
          'No chunks with embeddings found',
          SimilaritySearchErrorCodes.NO_EMBEDDINGS
        );
      }

      // Calculate similarities
      const results = await this.calculateSimilarities(chunks, query);

      // Filter by minimum similarity
      const filteredResults = results.filter(
        result => result.similarity >= (query.minSimilarity || this.config.minSimilarity)
      );

      // Rank and limit results
      const rankedResults = this.config.enableRanking 
        ? this.rankResults(filteredResults)
        : filteredResults.sort((a, b) => b.similarity - a.similarity);

      const finalResults = rankedResults.slice(0, query.maxResults || this.config.maxResults);

      console.log(`Similarity search completed in ${Date.now() - startTime}ms, found ${finalResults.length} results`);
      
      return finalResults;
    } catch (error) {
      if (error instanceof SimilaritySearchError) {
        throw error;
      }
      throw new SimilaritySearchError(
        `Search failed: ${error.message}`,
        SimilaritySearchErrorCodes.PROCESSING_FAILED,
        error
      );
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  public static cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Batch calculate similarities for multiple vectors
   */
  public static batchCosineSimilarity(
    queryVector: number[],
    vectors: number[][]
  ): number[] {
    return vectors.map(vector => SimilaritySearch.cosineSimilarity(queryVector, vector));
  }

  /**
   * Update search configuration
   */
  updateConfig(config: Partial<SimilaritySearchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): SimilaritySearchConfig {
    return { ...this.config };
  }

  private validateQuery(query: SearchQuery): void {
    if (!query.text && !query.embedding) {
      throw new SimilaritySearchError(
        'Query must have either text or embedding',
        SimilaritySearchErrorCodes.INVALID_QUERY
      );
    }

    if (query.minSimilarity !== undefined && (query.minSimilarity < 0 || query.minSimilarity > 1)) {
      throw new SimilaritySearchError(
        'Minimum similarity must be between 0 and 1',
        SimilaritySearchErrorCodes.INVALID_SIMILARITY_THRESHOLD
      );
    }

    if (query.maxResults !== undefined && query.maxResults <= 0) {
      throw new SimilaritySearchError(
        'Maximum results must be greater than 0',
        SimilaritySearchErrorCodes.INVALID_QUERY
      );
    }
  }

  private async getEligibleChunks(documentIds?: string[]): Promise<RAGChunk[]> {
    const chunksCollection = this.database.get<RAGChunk>('rag_chunks');
    
    let queryConditions = [Q.where('embedding', Q.notEq(null))];

    if (documentIds && documentIds.length > 0) {
      queryConditions.push(Q.where('document_id', Q.oneOf(documentIds)));
    }

    return await chunksCollection.query(...queryConditions).fetch();
  }

  private async calculateSimilarities(
    chunks: RAGChunk[],
    query: SearchQuery
  ): Promise<SearchResult[]> {
    if (!query.embedding) {
      throw new SimilaritySearchError(
        'Query embedding is required for similarity calculation',
        SimilaritySearchErrorCodes.INVALID_QUERY
      );
    }

    const results: SearchResult[] = [];
    const documentsCache = new Map<string, RAGDocument>();

    for (const chunk of chunks) {
      const chunkEmbedding = chunk.embeddingVector;
      if (!chunkEmbedding) continue;

      try {
        const similarity = SimilaritySearch.cosineSimilarity(query.embedding, chunkEmbedding);
        
        // Get document info (with caching)
        let document = documentsCache.get(chunk.documentId);
        if (!document) {
          const documentsCollection = this.database.get<RAGDocument>('rag_documents');
          document = await documentsCollection.find(chunk.documentId);
          documentsCache.set(chunk.documentId, document);
        }

        results.push({
          chunkId: chunk.id,
          documentId: chunk.documentId,
          documentName: document.name,
          text: chunk.text,
          pageNumber: chunk.pageNumber,
          chunkIndex: chunk.chunkIndex,
          similarity,
          startChar: chunk.startChar,
          endChar: chunk.endChar,
          tokenCount: chunk.tokenCount,
        });
      } catch (error) {
        console.warn(`Failed to calculate similarity for chunk ${chunk.id}:`, error);
        continue;
      }
    }

    return results;
  }

  private rankResults(results: SearchResult[]): SearchResult[] {
    const weights = this.config.rankingWeights;
    const now = Date.now();

    return results
      .map(result => {
        // Calculate composite score
        let score = result.similarity * weights.similarity;

        // Add recency bonus (assuming newer chunks are better)
        // This is a simple heuristic - in practice you might want to use actual timestamps
        const recencyScore = 1 - (result.chunkIndex / 1000); // Simple recency approximation
        score += Math.max(0, recencyScore) * weights.recency;

        // Add token count bonus (prefer chunks with more content, up to a point)
        const tokenScore = Math.min(result.tokenCount / 500, 1); // Normalize to 0-1
        score += tokenScore * weights.tokenCount;

        return { ...result, compositeScore: score };
      })
      .sort((a, b) => (b as any).compositeScore - (a as any).compositeScore)
      .map(result => {
        // Remove the composite score from the final result
        const { compositeScore, ...finalResult } = result as any;
        return finalResult;
      });
  }
}