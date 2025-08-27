import {Database} from '@nozbe/watermelondb';
import {Q} from '@nozbe/watermelondb';
import {SimilaritySearch} from './SimilaritySearch';
import {ContextAssembler} from './ContextAssembler';
import {EmbeddingGenerator} from './EmbeddingGenerator';
import {
  SearchQuery,
  SearchResult,
  RetrievalContext,
  AssembledContext,
  SimilaritySearchConfig,
  ContextAssemblyConfig,
  SimilaritySearchError,
  SimilaritySearchErrorCodes,
} from './types';

export interface RetrievalSystemConfig {
  similarity?: Partial<SimilaritySearchConfig>;
  assembly?: Partial<ContextAssemblyConfig>;
}

export class RetrievalSystem {
  private database: Database;
  private similaritySearch: SimilaritySearch;
  private contextAssembler: ContextAssembler;
  private embeddingGenerator: EmbeddingGenerator;

  constructor(
    database: Database,
    embeddingGenerator: EmbeddingGenerator,
    config?: RetrievalSystemConfig
  ) {
    this.database = database;
    this.embeddingGenerator = embeddingGenerator;
    this.similaritySearch = new SimilaritySearch(database, config?.similarity);
    this.contextAssembler = new ContextAssembler(config?.assembly);
  }

  /**
   * Perform end-to-end retrieval for a text query
   */
  async retrieve(
    queryText: string,
    options?: {
      maxResults?: number;
      minSimilarity?: number;
      documentIds?: string[];
      includeContext?: boolean;
    }
  ): Promise<RetrievalContext> {
    const startTime = Date.now();

    try {
      // Generate embedding for the query
      const embeddingResult = await this.embeddingGenerator.generateEmbedding(queryText);
      
      // Prepare search query
      const searchQuery: SearchQuery = {
        text: queryText,
        embedding: embeddingResult.embedding,
        maxResults: options?.maxResults || 5,
        minSimilarity: options?.minSimilarity || 0.7,
        documentIds: options?.documentIds,
      };

      // Perform similarity search
      const results = await this.similaritySearch.search(searchQuery);

      // Create retrieval context
      const processingTime = Date.now() - startTime;
      const context = this.contextAssembler.createRetrievalContext(
        queryText,
        results,
        processingTime
      );

      return context;
    } catch (error) {
      if (error instanceof SimilaritySearchError) {
        throw error;
      }
      throw new SimilaritySearchError(
        `Retrieval failed: ${error.message}`,
        SimilaritySearchErrorCodes.PROCESSING_FAILED,
        error
      );
    }
  }

  /**
   * Retrieve and assemble context for a query
   */
  async retrieveAndAssemble(
    queryText: string,
    options?: {
      maxResults?: number;
      minSimilarity?: number;
      documentIds?: string[];
      maxTokens?: number;
    }
  ): Promise<{
    context: RetrievalContext;
    assembled: AssembledContext;
  }> {
    // Get retrieval results
    const context = await this.retrieve(queryText, options);

    // Assemble context
    const assembled = this.contextAssembler.assembleContext(queryText, context.results);

    return { context, assembled };
  }

  /**
   * Search for similar chunks without generating embeddings (when embedding is already available)
   */
  async searchWithEmbedding(
    queryEmbedding: number[],
    options?: {
      maxResults?: number;
      minSimilarity?: number;
      documentIds?: string[];
    }
  ): Promise<SearchResult[]> {
    const searchQuery: SearchQuery = {
      text: '', // Not needed when embedding is provided
      embedding: queryEmbedding,
      maxResults: options?.maxResults || 5,
      minSimilarity: options?.minSimilarity || 0.7,
      documentIds: options?.documentIds,
    };

    return await this.similaritySearch.search(searchQuery);
  }

  /**
   * Get similar documents (grouped by document)
   */
  async getSimilarDocuments(
    queryText: string,
    options?: {
      maxDocuments?: number;
      minSimilarity?: number;
      documentIds?: string[];
    }
  ): Promise<{
    documentId: string;
    documentName: string;
    chunks: SearchResult[];
    averageSimilarity: number;
    maxSimilarity: number;
  }[]> {
    const context = await this.retrieve(queryText, {
      maxResults: 50, // Get more results to group by document
      minSimilarity: options?.minSimilarity,
      documentIds: options?.documentIds,
    });

    // Group results by document
    const documentGroups = new Map<string, SearchResult[]>();
    
    for (const result of context.results) {
      if (!documentGroups.has(result.documentId)) {
        documentGroups.set(result.documentId, []);
      }
      documentGroups.get(result.documentId)!.push(result);
    }

    // Calculate document-level similarities
    const documentSimilarities = Array.from(documentGroups.entries()).map(([documentId, chunks]) => {
      const similarities = chunks.map(chunk => chunk.similarity);
      return {
        documentId,
        documentName: chunks[0].documentName,
        chunks: chunks.sort((a, b) => b.similarity - a.similarity), // Sort chunks by similarity
        averageSimilarity: similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length,
        maxSimilarity: Math.max(...similarities),
      };
    });

    // Sort by average similarity and limit results
    return documentSimilarities
      .sort((a, b) => b.averageSimilarity - a.averageSimilarity)
      .slice(0, options?.maxDocuments || 5);
  }

  /**
   * Update system configuration
   */
  updateConfig(config: RetrievalSystemConfig): void {
    if (config.similarity) {
      this.similaritySearch.updateConfig(config.similarity);
    }
    if (config.assembly) {
      this.contextAssembler.updateConfig(config.assembly);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): {
    similarity: SimilaritySearchConfig;
    assembly: ContextAssemblyConfig;
  } {
    return {
      similarity: this.similaritySearch.getConfig(),
      assembly: this.contextAssembler.getConfig(),
    };
  }

  /**
   * Get system statistics
   */
  async getStatistics(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    chunksWithEmbeddings: number;
    averageChunksPerDocument: number;
  }> {
    const documentsCollection = this.database.get('rag_documents');
    const chunksCollection = this.database.get('rag_chunks');

    const [totalDocuments, totalChunks, chunksWithEmbeddings] = await Promise.all([
      documentsCollection.query().fetchCount(),
      chunksCollection.query().fetchCount(),
      chunksCollection.query(Q.where('embedding', Q.notEq(null))).fetchCount(),
    ]);

    return {
      totalDocuments,
      totalChunks,
      chunksWithEmbeddings,
      averageChunksPerDocument: totalDocuments > 0 ? totalChunks / totalDocuments : 0,
    };
  }
}