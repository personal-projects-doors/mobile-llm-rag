import {Database} from '@nozbe/watermelondb';
import {RetrievalSystem} from './RetrievalSystem';
import {EmbeddingGenerator} from './EmbeddingGenerator';
import {CitationManager, citationManager} from './CitationManager';
import {ragErrorHandler} from './ErrorHandler';
import {ragRecoveryManager} from './RecoveryManager';
import {MessageType} from '../../utils/types';
import {
  SearchResult,
  RetrievalContext,
  AssembledContext,
  RAGError,
  RAGErrorCategory,
} from './types';

export interface RAGProcessingOptions {
  maxResults?: number;
  minSimilarity?: number;
  maxTokens?: number;
  documentIds?: string[];
}

export interface RAGProcessingResult {
  enhancedPrompt: string;
  citations: MessageType.RAGCitation[];
  retrievalContext: RetrievalContext;
  originalQuery: string;
  fallbackUsed?: boolean;
  partialResults?: boolean;
  errorRecovered?: boolean;
}

export class RAGMessageProcessor {
  private database: Database;
  private retrievalSystem: RetrievalSystem;
  private embeddingGenerator: EmbeddingGenerator;
  private citationManager: CitationManager;

  constructor(database: Database, embeddingGenerator: EmbeddingGenerator) {
    this.database = database;
    this.embeddingGenerator = embeddingGenerator;
    this.retrievalSystem = new RetrievalSystem(database, embeddingGenerator);
    this.citationManager = citationManager;
  }

  /**
   * Process a user message with RAG enhancement
   */
  async processMessage(
    message: string,
    options?: RAGProcessingOptions
  ): Promise<RAGProcessingResult> {
    const context = {
      operation: 'process_message',
      documentIds: options?.documentIds,
    };

    try {
      // Retrieve relevant context with error handling
      const retrievalResult = await ragErrorHandler.handleError(
        new Promise(async (resolve, reject) => {
          try {
            const result = await this.retrievalSystem.retrieveAndAssemble(
              message,
              {
                maxResults: options?.maxResults || 5,
                minSimilarity: options?.minSimilarity || 0.7,
                documentIds: options?.documentIds,
                maxTokens: options?.maxTokens || 2000,
              }
            );
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }),
        {
          operation: 'retrieve_and_assemble',
          fallbackAction: async () => {
            // Fallback: return empty context for normal chat
            return {
              context: {
                query: message,
                results: [],
                totalChunks: 0,
                processingTime: 0,
                averageSimilarity: 0,
                maxSimilarity: 0,
                minSimilarity: 0,
              },
              assembled: {
                text: '',
                sources: [],
                totalTokens: 0,
                truncated: false,
                assemblyTime: 0,
              },
            };
          },
          retryAction: async () => {
            return await this.retrievalSystem.retrieveAndAssemble(
              message,
              {
                maxResults: Math.max(1, (options?.maxResults || 5) - 2), // Reduce results on retry
                minSimilarity: Math.max(0.5, (options?.minSimilarity || 0.7) - 0.1), // Lower threshold on retry
                documentIds: options?.documentIds,
                maxTokens: options?.maxTokens || 2000,
              }
            );
          },
        }
      );

      if (!retrievalResult.success) {
        throw retrievalResult.error || new Error('Retrieval failed');
      }

      const {context: retrievalContext, assembled} = retrievalResult.result!;
      const fallbackUsed = retrievalResult.action === 'fallback';
      const errorRecovered = retrievalResult.action === 'retry';

      // Create enhanced prompt with context
      const enhancedPrompt = this.createEnhancedPrompt(message, assembled);

      // Convert search results to citations using CitationManager
      let citations: MessageType.RAGCitation[] = [];
      try {
        citations = this.citationManager.createCitations(retrievalContext.results);
      } catch (citationError) {
        console.warn('Failed to create citations, continuing without them:', citationError);
        // Continue without citations rather than failing completely
      }

      return {
        enhancedPrompt,
        citations,
        retrievalContext,
        originalQuery: message,
        fallbackUsed,
        errorRecovered,
        partialResults: retrievalContext.results.length < (options?.maxResults || 5),
      };

    } catch (error) {
      // Final fallback: use recovery manager for graceful degradation
      const recoveryResult = await ragRecoveryManager.recoverFromError(
        error instanceof RAGError ? error : new RAGError(
          error instanceof Error ? error.message : 'Unknown error during message processing',
          'MESSAGE_PROCESSING_FAILED',
          RAGErrorCategory.MESSAGE_PROCESSING,
          context,
          error instanceof Error ? error : undefined
        ),
        context,
        {
          fallbackAction: async () => {
            // Ultimate fallback: return original message for normal chat
            return {
              enhancedPrompt: message,
              citations: [],
              retrievalContext: {
                query: message,
                results: [],
                totalChunks: 0,
                processingTime: 0,
                averageSimilarity: 0,
                maxSimilarity: 0,
                minSimilarity: 0,
              },
              originalQuery: message,
              fallbackUsed: true,
            };
          },
        }
      );

      if (recoveryResult.success && recoveryResult.result) {
        return recoveryResult.result;
      }

      // If all recovery attempts fail, throw the original error
      throw error;
    }
  }

  /**
   * Create an enhanced prompt with retrieved context
   */
  private createEnhancedPrompt(
    originalMessage: string,
    assembledContext: AssembledContext
  ): string {
    if (assembledContext.sources.length === 0) {
      return originalMessage;
    }

    const contextText = assembledContext.text;
    
    return `Context from documents:
${contextText}

Based on the above context, please answer the following question:
${originalMessage}

Please cite specific information from the context when relevant.`;
  }

  /**
   * Get citation statistics for a set of results
   */
  getCitationStats(citations: MessageType.RAGCitation[]) {
    return this.citationManager.getCitationStats(citations);
  }

  /**
   * Get expanded context for a citation
   */
  getCitationContext(citation: MessageType.RAGCitation) {
    return this.citationManager.getCitationContext(citation);
  }

  /**
   * Check if RAG processing should be applied
   */
  async shouldProcessWithRAG(
    ragEnabled: boolean,
    documentIds: string[]
  ): Promise<boolean> {
    if (!ragEnabled || documentIds.length === 0) {
      return false;
    }

    try {
      // Check if documents exist and have processed chunks
      const documentsCollection = this.database.get('rag_documents');
      
      for (const docId of documentIds) {
        try {
          const document = await documentsCollection.find(docId);
          const docData = document as any;
          
          if (!docData.isProcessed || docData.chunkCount === 0) {
            return false;
          }
        } catch (error) {
          // Document not found, log but continue checking others
          console.warn(`Document ${docId} not found or inaccessible:`, error);
          return false;
        }
      }

      return true;
    } catch (error) {
      // Database error - log and return false to fall back to normal chat
      console.error('Error checking RAG availability:', error);
      return false;
    }
  }

  /**
   * Get available documents for RAG
   */
  async getAvailableDocuments(): Promise<Array<{
    id: string;
    name: string;
    isProcessed: boolean;
    chunkCount: number;
  }>> {
    const documentsCollection = this.database.get('rag_documents');
    const documents = await documentsCollection.query().fetch();

    return documents.map((doc: any) => ({
      id: doc.id,
      name: doc.name,
      isProcessed: doc.isProcessed,
      chunkCount: doc.chunkCount,
    }));
  }
}