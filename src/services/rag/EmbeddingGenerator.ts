import { LlamaContext } from '@pocketpalai/llama.rn';
import { Model } from '../../utils/types';
import {
  EmbeddingConfig,
  EmbeddingResult,
  BatchEmbeddingResult,
  EmbeddingProgress,
  EmbeddingError,
  EmbeddingErrorCodes,
  DocumentChunk,
} from './types';

export interface EmbeddingGeneratorOptions {
  model: Model;
  config?: Partial<EmbeddingConfig>;
  onProgress?: (progress: EmbeddingProgress) => void;
  onError?: (error: EmbeddingError) => void;
}

export class EmbeddingGenerator {
  private context: LlamaContext | null = null;
  private model: Model;
  private config: EmbeddingConfig;
  private isLoaded = false;
  private isProcessing = false;
  private cancellationToken = { cancelled: false };
  private onProgress?: (progress: EmbeddingProgress) => void;
  private onError?: (error: EmbeddingError) => void;

  constructor(options: EmbeddingGeneratorOptions) {
    this.model = options.model;
    this.onProgress = options.onProgress;
    this.onError = options.onError;
    
    // Default configuration
    this.config = {
      modelId: options.model.id,
      batchSize: 10, // Process 10 chunks at a time
      maxTokens: 512, // Maximum tokens per chunk for embedding
      normalize: true, // Normalize embeddings to unit vectors
      ...options.config,
    };
  }

  /**
   * Initialize the embedding model
   */
  async initialize(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    try {
      // Check if model is downloaded
      if (!this.model.isDownloaded) {
        throw new EmbeddingError(
          'Model is not downloaded',
          EmbeddingErrorCodes.MODEL_NOT_LOADED
        );
      }

      // Initialize LlamaContext for the embedding model
      this.context = new LlamaContext({
        model: this.model.fullPath || this.model.filename,
        n_ctx: 2048, // Context size for embeddings
        n_batch: this.config.batchSize,
        embedding: true, // Enable embedding mode
        n_gpu_layers: 0, // CPU-only for now to ensure compatibility
      });

      await this.context.loadSession();
      this.isLoaded = true;
    } catch (error) {
      const embeddingError = new EmbeddingError(
        `Failed to initialize embedding model: ${error instanceof Error ? error.message : 'Unknown error'}`,
        EmbeddingErrorCodes.MODEL_LOADING_FAILED,
        undefined,
        error instanceof Error ? error : undefined
      );
      
      this.onError?.(embeddingError);
      throw embeddingError;
    }
  }

  /**
   * Generate embedding for a single text chunk
   */
  async generateEmbedding(text: string, chunkId?: string): Promise<EmbeddingResult> {
    if (!this.isLoaded || !this.context) {
      throw new EmbeddingError(
        'Model not loaded',
        EmbeddingErrorCodes.MODEL_NOT_LOADED,
        chunkId
      );
    }

    if (!text || text.trim().length === 0) {
      throw new EmbeddingError(
        'Invalid input text',
        EmbeddingErrorCodes.INVALID_INPUT,
        chunkId
      );
    }

    const startTime = Date.now();

    try {
      // Tokenize the text to check length
      const tokens = await this.context.tokenize(text);
      
      if (tokens.length > this.config.maxTokens) {
        throw new EmbeddingError(
          `Text too long: ${tokens.length} tokens (max: ${this.config.maxTokens})`,
          EmbeddingErrorCodes.INVALID_INPUT,
          chunkId
        );
      }

      // Generate embedding using the context
      const embedding = await this.context.getEmbedding(text);
      
      if (!embedding || embedding.length === 0) {
        throw new EmbeddingError(
          'Failed to generate embedding',
          EmbeddingErrorCodes.PROCESSING_FAILED,
          chunkId
        );
      }

      // Normalize embedding if configured
      const finalEmbedding = this.config.normalize 
        ? this.normalizeVector(embedding) 
        : embedding;

      const processingTime = Date.now() - startTime;

      return {
        embedding: finalEmbedding,
        tokenCount: tokens.length,
        processingTime,
        chunkId,
      };
    } catch (error) {
      const embeddingError = error instanceof EmbeddingError 
        ? error 
        : new EmbeddingError(
            `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`,
            EmbeddingErrorCodes.PROCESSING_FAILED,
            chunkId,
            error instanceof Error ? error : undefined
          );
      
      this.onError?.(embeddingError);
      throw embeddingError;
    }
  }

  /**
   * Generate embeddings for multiple chunks with batch processing
   */
  async generateBatchEmbeddings(
    chunks: DocumentChunk[]
  ): Promise<BatchEmbeddingResult> {
    if (!this.isLoaded) {
      await this.initialize();
    }

    this.isProcessing = true;
    // Don't reset cancellation token if it was already set

    const results: EmbeddingResult[] = [];
    const errors: EmbeddingError[] = [];
    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;

    try {
      // Check for cancellation before starting
      if (this.cancellationToken.cancelled) {
        throw new EmbeddingError(
          'Processing cancelled',
          EmbeddingErrorCodes.CANCELLED
        );
      }

      // Process chunks in batches
      for (let i = 0; i < chunks.length; i += this.config.batchSize) {
        if (this.cancellationToken.cancelled) {
          throw new EmbeddingError(
            'Processing cancelled',
            EmbeddingErrorCodes.CANCELLED
          );
        }

        const batch = chunks.slice(i, i + this.config.batchSize);
        
        // Update progress
        this.onProgress?.({
          processed: i,
          total: chunks.length,
          currentChunk: batch[0]?.id,
          estimatedTimeRemaining: this.estimateTimeRemaining(i, chunks.length, startTime),
          cancelled: false,
        });

        // Process batch concurrently
        const batchPromises = batch.map(async (chunk) => {
          // Check cancellation before processing each chunk
          if (this.cancellationToken.cancelled) {
            throw new EmbeddingError(
              'Processing cancelled',
              EmbeddingErrorCodes.CANCELLED,
              chunk.id
            );
          }

          try {
            const result = await this.generateEmbedding(chunk.text, chunk.id);
            successCount++;
            return result;
          } catch (error) {
            failureCount++;
            const embeddingError = error instanceof EmbeddingError 
              ? error 
              : new EmbeddingError(
                  `Failed to process chunk ${chunk.id}`,
                  EmbeddingErrorCodes.PROCESSING_FAILED,
                  chunk.id,
                  error instanceof Error ? error : undefined
                );
            errors.push(embeddingError);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.filter((result): result is EmbeddingResult => result !== null));

        // Small delay between batches to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Final progress update
      this.onProgress?.({
        processed: chunks.length,
        total: chunks.length,
        estimatedTimeRemaining: 0,
        cancelled: false,
      });

      const totalProcessingTime = Date.now() - startTime;

      return {
        results,
        totalProcessingTime,
        successCount,
        failureCount,
        errors,
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Cancel ongoing batch processing
   */
  cancel(): void {
    this.cancellationToken.cancelled = true;
  }

  /**
   * Check if the generator is currently processing
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Get the current configuration
   */
  getConfig(): EmbeddingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<EmbeddingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    this.cancel();
    
    if (this.context) {
      try {
        await this.context.release();
      } catch (error) {
        console.warn('Error releasing embedding context:', error);
      }
      this.context = null;
    }
    
    this.isLoaded = false;
  }

  /**
   * Normalize a vector to unit length
   */
  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude === 0) {
      return vector; // Return original if magnitude is 0
    }
    
    return vector.map(val => val / magnitude);
  }

  /**
   * Estimate remaining processing time
   */
  private estimateTimeRemaining(
    processed: number,
    total: number,
    startTime: number
  ): number {
    if (processed === 0) return 0;
    
    const elapsed = Date.now() - startTime;
    const rate = processed / elapsed;
    const remaining = total - processed;
    
    return remaining / rate;
  }
}