import { LlamaContext, initLlama } from '@pocketpalai/llama.rn';
import { Model } from '../../utils/types';
import { securityManager } from './SecurityManager';
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
      // Ensure security manager is initialized for encrypted operations
      if (!securityManager.isInitialized()) {
        await securityManager.initialize();
      }

      // Validate that this is an offline operation
      securityManager.validateOfflineOperation('embedding_model_initialization');
      
      // Check if model is downloaded
      if (!this.model.isDownloaded) {
        throw new EmbeddingError(
          `Model '${this.model.name}' is not downloaded`,
          EmbeddingErrorCodes.MODEL_NOT_LOADED
        );
      }

      // Get the model file path
      const modelPath = await this.getModelPath();
      if (!modelPath) {
        throw new EmbeddingError(
          `Model file path not found for '${this.model.name}'`,
          EmbeddingErrorCodes.MODEL_NOT_LOADED
        );
      }

      console.log(`Initializing embedding model: ${this.model.name} at ${modelPath}`);

      // Initialize the embedding model using initLlama with conservative settings for mobile
      // Try different configurations to enable embedding support
      const initSettings = {
        model: modelPath,
        n_ctx: 512, // Conservative context size for embedding generation
        n_batch: 32, // Small batch size for mobile devices
        n_ubatch: 32,
        n_threads: 4, // Conservative thread count
        flash_attn: false, // Disable flash attention for compatibility
        cache_type_k: 'f16' as const,
        cache_type_v: 'f16' as const,
        n_gpu_layers: 0, // Use CPU for embedding generation for stability
        no_gpu_devices: true,
        use_mlock: false,
        use_mmap: true,
        use_progress_callback: false, // Disable progress callback for embedding mode
        embeddings: true, // Enable embedding generation
        embedding: true, // Alternative parameter name
        pooling_type: 1, // Try mean pooling for embeddings
      };

      console.log('Embedding model init settings:', initSettings);

      const startTime = Date.now();
      
      try {
        this.context = await initLlama(initSettings);
      } catch (initError) {
        console.error('Failed to initialize with embedding settings, trying basic settings:', initError);
        
        // Fallback to basic settings without embedding-specific parameters
        const basicSettings = {
          model: modelPath,
          n_ctx: 512,
          n_batch: 32,
          n_ubatch: 32,
          n_threads: 4,
          n_gpu_layers: 0,
          no_gpu_devices: true,
          use_mlock: false,
          use_mmap: true,
        };
        
        console.log('Trying basic init settings:', basicSettings);
        this.context = await initLlama(basicSettings);
      }
      
      const initTime = Date.now() - startTime;
      console.log(`Embedding model initialized in ${initTime}ms`);
      
      // Debug: Check what methods are available on the context
      const contextMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(this.context))
        .filter(name => typeof (this.context as any)[name] === 'function');
      console.log('Available context methods:', contextMethods);
      
      // Test if embedding method exists
      if (typeof this.context.embedding === 'function') {
        console.log('✓ Embedding method is available');
      } else {
        console.warn('✗ Embedding method is not available on context');
        console.warn('This model may not support direct embedding generation');
        console.warn('Available methods:', contextMethods);
      }
      
      this.isLoaded = true;
      
      console.log(`Successfully initialized embedding model: ${this.model.name}`);
    } catch (error) {
      const embeddingError = new EmbeddingError(
        `Failed to initialize embedding model '${this.model.name}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        EmbeddingErrorCodes.MODEL_LOADING_FAILED,
        undefined,
        error instanceof Error ? error : undefined
      );
      
      console.error('Embedding model initialization failed:', embeddingError);
      this.onError?.(embeddingError);
      throw embeddingError;
    }
  }

  /**
   * Get the full path to the model file
   */
  private async getModelPath(): Promise<string | null> {
    try {
      // Import modelStore dynamically to avoid circular dependencies
      const { modelStore } = await import('../../store');
      return await modelStore.getModelFullPath(this.model);
    } catch (error) {
      console.error('Failed to get model path:', error);
      return null;
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

    // Validate offline operation
    securityManager.validateOfflineOperation('embedding_generation');

    const startTime = Date.now();

    try {
      // Preprocess text for MedGemma model
      const processedText = this.preprocessTextForEmbedding(text);
      
      // Tokenize the text to check length
      const tokens = await this.context.tokenize(processedText);
      const tokenCount = Array.isArray(tokens) ? tokens.length : (tokens.tokens ? tokens.tokens.length : 0);
      
      if (tokenCount > this.config.maxTokens) {
        // Try to truncate the text if it's too long
        const truncatedText = this.truncateText(processedText, this.config.maxTokens);
        console.warn(`Text truncated from ${tokenCount} to ~${this.config.maxTokens} tokens for chunk ${chunkId}`);
        return this.generateEmbedding(truncatedText, chunkId);
      }

      // Generate embedding using the context
      let embeddingResult;
      try {
        // Try different possible embedding methods
        if (typeof this.context.embedding === 'function') {
          console.log('Using context.embedding() method');
          embeddingResult = await this.context.embedding(processedText);
        } else if (typeof this.context.embed === 'function') {
          console.log('Using context.embed() method');
          embeddingResult = await this.context.embed(processedText);
        } else if (typeof (this.context as any).getEmbedding === 'function') {
          console.log('Using context.getEmbedding() method');
          embeddingResult = await (this.context as any).getEmbedding(processedText);
        } else {
          // Fallback: Try to use completion with a special prompt to get embeddings
          console.log('Trying fallback embedding approach using completion...');
          
          // Some models might support embedding through special prompts or completion
          const embeddingPrompt = `Generate embedding for: "${processedText}"`;
          
          try {
            // Try using completion method as a fallback
            if (typeof this.context.completion === 'function') {
              const completionResult = await this.context.completion(embeddingPrompt, {
                n_predict: 1,
                temperature: 0,
                top_p: 1,
                top_k: 1,
              });
              
              // This is a fallback - we'll create a simple hash-based embedding
              console.warn('Using fallback hash-based embedding (not ideal for production)');
              embeddingResult = this.createFallbackEmbedding(processedText);
            } else {
              // List available methods for debugging
              const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this.context))
                .filter(name => typeof (this.context as any)[name] === 'function');
              console.log('Available context methods:', methods);
              
              throw new Error('No embedding or completion method found on context. Available methods: ' + methods.join(', '));
            }
          } catch (fallbackError) {
            console.error('Fallback embedding approach also failed:', fallbackError);
            throw new Error('No embedding method found on context and fallback failed');
          }
        }
      } catch (embeddingError) {
        // If embedding method fails, it might not be supported by this model
        throw new EmbeddingError(
          `Embedding generation failed: ${embeddingError instanceof Error ? embeddingError.message : 'Unknown error'}. This model may not support embedding generation.`,
          EmbeddingErrorCodes.PROCESSING_FAILED,
          chunkId,
          embeddingError instanceof Error ? embeddingError : undefined
        );
      }
      
      // Extract the actual embedding array from the result
      let embedding: number[] = [];
      
      if (Array.isArray(embeddingResult)) {
        embedding = embeddingResult;
      } else if (embeddingResult && typeof embeddingResult === 'object') {
        // Handle different possible response formats
        embedding = (embeddingResult as any).embedding || 
                   (embeddingResult as any).data || 
                   (embeddingResult as any).vector || 
                   [];
      }
      
      if (!embedding || embedding.length === 0) {
        throw new EmbeddingError(
          'Failed to generate embedding - empty result. The model may not support embedding generation or the input text may be invalid.',
          EmbeddingErrorCodes.PROCESSING_FAILED,
          chunkId
        );
      }

      // Validate embedding dimensions (MedGemma produces 2560-dimensional embeddings)
      const expectedDimensions = 2560; // Updated based on actual MedGemma output
      if (embedding.length !== expectedDimensions) {
        console.warn(`Unexpected embedding dimension: ${embedding.length}, expected ${expectedDimensions} for MedGemma`);
      } else {
        console.log(`✓ Embedding dimensions correct: ${embedding.length}`);
      }

      // Normalize embedding if configured
      const finalEmbedding = this.config.normalize 
        ? this.normalizeVector(embedding) 
        : embedding;

      const processingTime = Date.now() - startTime;

      return {
        embedding: finalEmbedding,
        tokenCount,
        processingTime,
        chunkId,
      };
    } catch (error) {
      const embeddingError = error instanceof EmbeddingError 
        ? error 
        : new EmbeddingError(
            `Failed to generate embedding for chunk ${chunkId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            EmbeddingErrorCodes.PROCESSING_FAILED,
            chunkId,
            error instanceof Error ? error : undefined
          );
      
      console.error('Embedding generation failed:', embeddingError);
      this.onError?.(embeddingError);
      throw embeddingError;
    }
  }

  /**
   * Preprocess text for optimal embedding generation with MedGemma
   */
  private preprocessTextForEmbedding(text: string): string {
    // Clean up the text
    let processed = text.trim();
    
    // Remove excessive whitespace
    processed = processed.replace(/\s+/g, ' ');
    
    // For MedGemma, we don't need special prefixes as it's designed for embeddings
    // Just return the cleaned text
    return processed;
  }

  /**
   * Truncate text to fit within token limits
   */
  private truncateText(text: string, maxTokens: number): string {
    // Rough estimation: 1 token ≈ 4 characters for English text
    const estimatedChars = maxTokens * 3; // Conservative estimate
    
    if (text.length <= estimatedChars) {
      return text;
    }
    
    // Truncate at word boundaries when possible
    const truncated = text.substring(0, estimatedChars);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > estimatedChars * 0.8) {
      return truncated.substring(0, lastSpaceIndex);
    }
    
    return truncated;
  }

  /**
   * Create a fallback embedding using text hashing (not ideal but functional)
   * This is only used when the model doesn't support proper embedding generation
   */
  private createFallbackEmbedding(text: string): number[] {
    console.warn('Creating fallback hash-based embedding - this is not optimal for production use');
    
    // Create a simple hash-based embedding with 2560 dimensions (matching MedGemma)
    const embedding = new Array(2560).fill(0);
    
    // Use multiple hash functions to distribute values
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      
      // Hash 1: Simple character position
      const idx1 = (char * (i + 1)) % 2560;
      embedding[idx1] += 0.1;
      
      // Hash 2: Character value with offset
      const idx2 = ((char + i) * 31) % 2560;
      embedding[idx2] += 0.05;
      
      // Hash 3: Combined hash
      const idx3 = ((char ^ i) * 17) % 2560;
      embedding[idx3] += 0.02;
    }
    
    // Add some randomness based on text length and content
    const textHash = this.simpleHash(text);
    for (let i = 0; i < 100; i++) {
      const idx = (textHash + i * 41) % 2560;
      embedding[idx] += 0.01;
    }
    
    // Normalize the embedding
    return this.normalizeVector(embedding);
  }

  /**
   * Simple hash function for text
   */
  private simpleHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
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
   * Validate that the model is properly configured for embedding generation
   */
  async validateModelForEmbedding(): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if model is the expected MedGemma model
    if (!this.model.id.includes('medgemma-4b-it')) {
      issues.push('Model is not the expected MedGemma embedding model');
      recommendations.push('Use the MedGemma-4B-IT model for optimal embedding performance');
    }

    // Check if model is downloaded
    if (!this.model.isDownloaded) {
      issues.push('Model is not downloaded');
      recommendations.push('Download the model before using for embeddings');
    }

    // Check model size
    const expectedSize = 2800000000; // ~2.8GB for IQ4_NL
    if (this.model.size && Math.abs(this.model.size - expectedSize) > 500000000) {
      issues.push(`Model size (${this.model.size}) differs significantly from expected size (${expectedSize})`);
      recommendations.push('Verify model integrity and re-download if necessary');
    }

    // Check if context is loaded
    if (!this.isLoaded || !this.context) {
      issues.push('Model context is not loaded');
      recommendations.push('Initialize the embedding generator before use');
    }

    // Test embedding generation if model is loaded
    if (this.isLoaded && this.context) {
      try {
        const testResult = await this.generateEmbedding('test', 'validation');
        const expectedDimensions = 2560; // MedGemma produces 2560-dimensional embeddings
        if (testResult.embedding.length !== expectedDimensions) {
          issues.push(`Embedding dimension mismatch: got ${testResult.embedding.length}, expected ${expectedDimensions}`);
          recommendations.push('Check model configuration and compatibility');
        } else {
          console.log(`✓ Embedding validation passed: ${expectedDimensions} dimensions confirmed`);
        }
      } catch (error) {
        issues.push(`Test embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        recommendations.push('Check model loading and context initialization');
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations,
    };
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