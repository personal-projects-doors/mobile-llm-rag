import {
  RAGError,
  RAGErrorCategory,
  PDFErrorCodes,
  EmbeddingErrorCodes,
  PartialProcessingResult,
} from './types';
import { ragErrorHandler } from './ErrorHandler';
import { ragRecoveryManager } from './RecoveryManager';
import { createPartialProcessor } from './PartialProcessor';

/**
 * Example of comprehensive error handling in document processing
 */
export class DocumentProcessingWithErrorHandling {
  
  /**
   * Process a single document with full error handling and recovery
   */
  async processDocumentSafely(
    documentPath: string,
    onProgress?: (progress: number) => void,
    onError?: (error: string, actions: any[]) => void
  ): Promise<{
    success: boolean;
    result?: any;
    error?: string;
    partialResults?: boolean;
  }> {
    try {
      // Simulate document processing that might fail
      const result = await this.processDocument(documentPath, onProgress);
      
      return {
        success: true,
        result,
      };
      
    } catch (error) {
      // Use recovery manager for comprehensive error handling
      const recoveryResult = await ragRecoveryManager.recoverFromError(
        error instanceof RAGError ? error : new RAGError(
          error instanceof Error ? error.message : 'Unknown processing error',
          PDFErrorCodes.PROCESSING_FAILED,
          RAGErrorCategory.DOCUMENT_PROCESSING,
          { operation: 'process_document', documentId: documentPath }
        ),
        {
          originalOperation: 'process_document',
          documentId: documentPath,
        },
        {
          retryAction: async () => {
            // Retry with reduced settings
            return await this.processDocument(documentPath, onProgress, {
              reduceQuality: true,
              skipComplexPages: true,
            });
          },
          fallbackAction: async () => {
            // Fallback: try to extract basic text only
            return await this.extractBasicText(documentPath);
          },
          partialResults: [], // Could include any partial results from failed processing
        }
      );

      if (recoveryResult.success) {
        return {
          success: true,
          result: recoveryResult.result,
          partialResults: recoveryResult.recoveryAction === 'partial_results',
        };
      }

      // If recovery failed, provide user-friendly error
      if (onError && recoveryResult.shouldNotifyUser) {
        const actions = ragRecoveryManager.createUserRecoveryActions(
          error instanceof RAGError ? error : new RAGError(
            'Processing failed',
            PDFErrorCodes.PROCESSING_FAILED,
            RAGErrorCategory.DOCUMENT_PROCESSING
          ),
          {
            originalOperation: 'process_document',
            documentId: documentPath,
          }
        );
        
        onError(recoveryResult.userMessage || 'Document processing failed', actions);
      }

      return {
        success: false,
        error: recoveryResult.userMessage || 'Document processing failed',
      };
    }
  }

  /**
   * Process multiple documents with batch error handling
   */
  async processMultipleDocuments(
    documentPaths: string[],
    onProgress?: (current: number, total: number, currentDoc?: string) => void,
    onBatchComplete?: (results: any[], batchIndex: number) => void,
    onError?: (error: string, canContinue: boolean) => void
  ): Promise<PartialProcessingResult<any>> {
    
    const processor = createPartialProcessor(
      async (documentPath: string) => {
        return await this.processDocument(documentPath);
      },
      {
        batchSize: 3, // Process 3 documents at a time
        maxConcurrent: 2, // Max 2 concurrent operations
        continueOnError: true,
        maxFailureRate: 0.6, // Stop if more than 60% fail
        maxRetries: 2,
        shouldRetry: (error, attempt) => {
          // Retry transient errors and memory errors
          return error.isTransient || 
                 error.code === PDFErrorCodes.MEMORY_ERROR ||
                 error.code === EmbeddingErrorCodes.TIMEOUT;
        },
        onProgress: (progress) => {
          if (onProgress) {
            onProgress(
              progress.current,
              progress.total,
              progress.currentItem
            );
          }
        },
        onBatchComplete,
        onError: (error, item, itemIndex) => {
          console.warn(`Failed to process document ${item}:`, error.getUserMessage());
        },
      }
    );

    const result = await processor.process(documentPaths);

    // Handle partial processing results
    if (result.failureCount > 0) {
      const partialHandling = await ragRecoveryManager.handlePartialProcessing(
        result,
        {
          originalOperation: 'batch_document_processing',
        }
      );

      if (onError) {
        onError(partialHandling.userMessage, partialHandling.shouldContinue);
      }
    }

    return result;
  }

  /**
   * Generate embeddings with comprehensive error handling
   */
  async generateEmbeddingsSafely(
    textChunks: string[],
    onProgress?: (progress: number) => void,
    onError?: (error: string, canRetry: boolean) => void
  ): Promise<{
    success: boolean;
    embeddings?: number[][];
    partialResults?: boolean;
  }> {
    
    try {
      const embeddings = await ragErrorHandler.executeWithRetry(
        async () => {
          return await this.generateEmbeddings(textChunks, onProgress);
        },
        EmbeddingErrorCodes.MODEL_NOT_LOADED
      );

      return {
        success: true,
        embeddings,
      };

    } catch (error) {
      const ragError = error instanceof RAGError ? error : new RAGError(
        error instanceof Error ? error.message : 'Embedding generation failed',
        EmbeddingErrorCodes.PROCESSING_FAILED,
        RAGErrorCategory.EMBEDDING_GENERATION,
        { operation: 'generate_embeddings' }
      );

      // Try recovery
      const recoveryResult = await ragRecoveryManager.recoverFromError(
        ragError,
        {
          originalOperation: 'generate_embeddings',
        },
        {
          retryAction: async () => {
            // Retry with smaller batches
            return await this.generateEmbeddingsInSmallBatches(textChunks, onProgress);
          },
          partialResults: [], // Could include any successfully generated embeddings
        }
      );

      if (recoveryResult.success) {
        return {
          success: true,
          embeddings: recoveryResult.result,
          partialResults: recoveryResult.recoveryAction === 'partial_results',
        };
      }

      if (onError) {
        onError(
          recoveryResult.userMessage || 'Failed to generate embeddings',
          ragError.isRecoverable
        );
      }

      return {
        success: false,
      };
    }
  }

  /**
   * Search with graceful degradation
   */
  async searchWithFallback(
    query: string,
    onError?: (error: string, fallbackUsed: boolean) => void
  ): Promise<{
    success: boolean;
    results?: any[];
    fallbackUsed?: boolean;
  }> {
    
    const result = await ragErrorHandler.handleError(
      new Promise(async (resolve, reject) => {
        try {
          const results = await this.performSearch(query);
          resolve(results);
        } catch (error) {
          reject(error);
        }
      }),
      {
        operation: 'search_documents',
        retryAction: async () => {
          // Retry with relaxed parameters
          return await this.performSearch(query, { relaxed: true });
        },
        fallbackAction: async () => {
          // Fallback to simple text search
          return await this.performSimpleTextSearch(query);
        },
      }
    );

    if (result.success) {
      return {
        success: true,
        results: result.result,
        fallbackUsed: result.action === 'fallback',
      };
    }

    if (onError) {
      onError(
        result.error?.getUserMessage() || 'Search failed',
        result.action === 'fallback'
      );
    }

    return {
      success: false,
    };
  }

  // Private helper methods (these would be implemented with actual processing logic)
  
  private async processDocument(
    documentPath: string,
    onProgress?: (progress: number) => void,
    options?: { reduceQuality?: boolean; skipComplexPages?: boolean }
  ): Promise<any> {
    // Simulate processing that might fail
    if (Math.random() < 0.3) { // 30% chance of failure for demo
      throw new RAGError(
        'Document processing failed',
        PDFErrorCodes.PROCESSING_FAILED,
        RAGErrorCategory.DOCUMENT_PROCESSING
      );
    }
    
    // Simulate progress
    for (let i = 0; i <= 100; i += 10) {
      if (onProgress) onProgress(i);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    return { text: 'Processed document content', pages: 10 };
  }

  private async extractBasicText(documentPath: string): Promise<any> {
    // Fallback text extraction
    return { text: 'Basic extracted text', pages: 1 };
  }

  private async generateEmbeddings(
    textChunks: string[],
    onProgress?: (progress: number) => void
  ): Promise<number[][]> {
    // Simulate embedding generation that might fail
    if (Math.random() < 0.2) { // 20% chance of failure
      throw new RAGError(
        'Model not loaded',
        EmbeddingErrorCodes.MODEL_NOT_LOADED,
        RAGErrorCategory.EMBEDDING_GENERATION
      );
    }
    
    const embeddings: number[][] = [];
    for (let i = 0; i < textChunks.length; i++) {
      if (onProgress) onProgress((i / textChunks.length) * 100);
      embeddings.push(new Array(384).fill(0).map(() => Math.random()));
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    return embeddings;
  }

  private async generateEmbeddingsInSmallBatches(
    textChunks: string[],
    onProgress?: (progress: number) => void
  ): Promise<number[][]> {
    // Process in smaller batches to avoid memory issues
    const batchSize = 5;
    const embeddings: number[][] = [];
    
    for (let i = 0; i < textChunks.length; i += batchSize) {
      const batch = textChunks.slice(i, i + batchSize);
      const batchEmbeddings = await this.generateEmbeddings(batch);
      embeddings.push(...batchEmbeddings);
      
      if (onProgress) {
        onProgress((i / textChunks.length) * 100);
      }
    }
    
    return embeddings;
  }

  private async performSearch(
    query: string,
    options?: { relaxed?: boolean }
  ): Promise<any[]> {
    // Simulate search that might fail
    if (Math.random() < 0.15) { // 15% chance of failure
      throw new RAGError(
        'Database connection failed',
        'DATABASE_ERROR',
        RAGErrorCategory.DATABASE
      );
    }
    
    return [
      { id: '1', text: 'Search result 1', similarity: 0.9 },
      { id: '2', text: 'Search result 2', similarity: 0.8 },
    ];
  }

  private async performSimpleTextSearch(query: string): Promise<any[]> {
    // Fallback simple search
    return [
      { id: '1', text: 'Simple search result', similarity: 0.5 },
    ];
  }
}

// Usage example
export const documentProcessingExample = new DocumentProcessingWithErrorHandling();