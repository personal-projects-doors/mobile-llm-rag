import {
  PartialProcessingResult,
  ProcessingProgress,
  RAGError,
  RAGErrorCategory,
} from './types';
import { ragErrorHandler } from './ErrorHandler';

export interface PartialProcessingOptions<T> {
  batchSize: number;
  maxConcurrent: number;
  continueOnError: boolean;
  maxFailureRate: number; // 0-1, stop if failure rate exceeds this
  onProgress?: (progress: ProcessingProgress) => void;
  onBatchComplete?: (results: T[], batchIndex: number) => void;
  onError?: (error: RAGError, item: any, itemIndex: number) => void;
  shouldRetry?: (error: RAGError, attempt: number) => boolean;
  maxRetries: number;
}

export interface ProcessingState {
  isRunning: boolean;
  isPaused: boolean;
  isCancelled: boolean;
  currentBatch: number;
  totalBatches: number;
  processedItems: number;
  totalItems: number;
  successCount: number;
  failureCount: number;
  startTime: Date;
  estimatedCompletion?: Date;
}

export class PartialProcessor<TInput, TOutput> {
  private state: ProcessingState = {
    isRunning: false,
    isPaused: false,
    isCancelled: false,
    currentBatch: 0,
    totalBatches: 0,
    processedItems: 0,
    totalItems: 0,
    successCount: 0,
    failureCount: 0,
    startTime: new Date(),
  };

  private pausePromise?: Promise<void>;
  private pauseResolve?: () => void;

  constructor(
    private processor: (item: TInput) => Promise<TOutput>,
    private options: PartialProcessingOptions<TOutput>
  ) {}

  // Main processing method
  async process(items: TInput[]): Promise<PartialProcessingResult<TOutput>> {
    if (this.state.isRunning) {
      throw new RAGError(
        'Processing is already running',
        'PROCESSING_IN_PROGRESS',
        RAGErrorCategory.SYSTEM
      );
    }

    this.initializeState(items);

    const result: PartialProcessingResult<TOutput> = {
      completed: [],
      failed: [],
      totalItems: items.length,
      successCount: 0,
      failureCount: 0,
      canContinue: true,
    };

    try {
      const batches = this.createBatches(items);
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        if (this.state.isCancelled) {
          result.canContinue = false;
          break;
        }

        await this.waitIfPaused();

        this.state.currentBatch = batchIndex;
        const batch = batches[batchIndex];
        
        const batchResults = await this.processBatch(batch, batchIndex, result);
        
        if (this.options.onBatchComplete) {
          this.options.onBatchComplete(batchResults, batchIndex);
        }

        // Check failure rate
        const failureRate = result.failureCount / (result.successCount + result.failureCount);
        if (failureRate > this.options.maxFailureRate && result.failureCount > 5) {
          console.warn(`Stopping processing due to high failure rate: ${failureRate}`);
          result.canContinue = false;
          break;
        }

        this.updateProgress();
      }

      result.successCount = this.state.successCount;
      result.failureCount = this.state.failureCount;

    } catch (error) {
      console.error('Batch processing failed:', error);
      result.canContinue = false;
      
      if (error instanceof RAGError) {
        result.failed.push({
          item: items[this.state.processedItems] || null,
          error,
        });
      }
    } finally {
      this.state.isRunning = false;
    }

    return result;
  }

  // Process a single batch
  private async processBatch(
    batch: TInput[],
    batchIndex: number,
    result: PartialProcessingResult<TOutput>
  ): Promise<TOutput[]> {
    const batchResults: TOutput[] = [];
    const concurrentPromises: Promise<void>[] = [];

    for (let i = 0; i < batch.length; i += this.options.maxConcurrent) {
      const chunk = batch.slice(i, i + this.options.maxConcurrent);
      
      const chunkPromises = chunk.map(async (item, chunkIndex) => {
        const itemIndex = batchIndex * this.options.batchSize + i + chunkIndex;
        await this.processItem(item, itemIndex, result, batchResults);
      });

      concurrentPromises.push(...chunkPromises);
      
      // Wait for this chunk to complete before starting the next
      await Promise.all(chunkPromises);
    }

    return batchResults;
  }

  // Process a single item with retry logic
  private async processItem(
    item: TInput,
    itemIndex: number,
    result: PartialProcessingResult<TOutput>,
    batchResults: TOutput[]
  ): Promise<void> {
    let lastError: RAGError | undefined;
    let attempt = 0;

    while (attempt <= this.options.maxRetries) {
      try {
        if (this.state.isCancelled) {
          return;
        }

        await this.waitIfPaused();

        const output = await this.processor(item);
        batchResults.push(output);
        result.completed.push(output);
        this.state.successCount++;
        this.state.processedItems++;
        return;

      } catch (error) {
        attempt++;
        lastError = error instanceof RAGError ? error : new RAGError(
          error instanceof Error ? error.message : 'Processing failed',
          'ITEM_PROCESSING_FAILED',
          RAGErrorCategory.DOCUMENT_PROCESSING,
          { operation: 'process_item', itemIndex },
          error instanceof Error ? error : undefined
        );

        // Check if we should retry
        if (attempt <= this.options.maxRetries && 
            this.options.shouldRetry && 
            this.options.shouldRetry(lastError, attempt)) {
          
          console.log(`Retrying item ${itemIndex}, attempt ${attempt}/${this.options.maxRetries}`);
          
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        break;
      }
    }

    // Item failed after all retries
    if (lastError) {
      result.failed.push({ item, error: lastError });
      this.state.failureCount++;
      this.state.processedItems++;

      if (this.options.onError) {
        this.options.onError(lastError, item, itemIndex);
      }

      if (!this.options.continueOnError) {
        this.state.isCancelled = true;
      }
    }
  }

  // Control methods
  pause(): void {
    if (!this.state.isRunning || this.state.isPaused) {
      return;
    }

    this.state.isPaused = true;
    this.pausePromise = new Promise(resolve => {
      this.pauseResolve = resolve;
    });
  }

  resume(): void {
    if (!this.state.isPaused) {
      return;
    }

    this.state.isPaused = false;
    if (this.pauseResolve) {
      this.pauseResolve();
      this.pausePromise = undefined;
      this.pauseResolve = undefined;
    }
  }

  cancel(): void {
    this.state.isCancelled = true;
    this.resume(); // Resume if paused to allow cancellation to proceed
  }

  // State getters
  getState(): Readonly<ProcessingState> {
    return { ...this.state };
  }

  isRunning(): boolean {
    return this.state.isRunning;
  }

  isPaused(): boolean {
    return this.state.isPaused;
  }

  isCancelled(): boolean {
    return this.state.isCancelled;
  }

  // Private helper methods
  private initializeState(items: TInput[]): void {
    this.state = {
      isRunning: true,
      isPaused: false,
      isCancelled: false,
      currentBatch: 0,
      totalBatches: Math.ceil(items.length / this.options.batchSize),
      processedItems: 0,
      totalItems: items.length,
      successCount: 0,
      failureCount: 0,
      startTime: new Date(),
    };
  }

  private createBatches(items: TInput[]): TInput[][] {
    const batches: TInput[][] = [];
    for (let i = 0; i < items.length; i += this.options.batchSize) {
      batches.push(items.slice(i, i + this.options.batchSize));
    }
    return batches;
  }

  private async waitIfPaused(): Promise<void> {
    if (this.state.isPaused && this.pausePromise) {
      await this.pausePromise;
    }
  }

  private updateProgress(): void {
    if (!this.options.onProgress) {
      return;
    }

    const elapsed = Date.now() - this.state.startTime.getTime();
    const rate = this.state.processedItems / elapsed; // items per ms
    const remaining = this.state.totalItems - this.state.processedItems;
    const estimatedTimeRemaining = remaining > 0 ? remaining / rate : 0;

    if (estimatedTimeRemaining > 0) {
      this.state.estimatedCompletion = new Date(Date.now() + estimatedTimeRemaining);
    }

    const progress: ProcessingProgress = {
      current: this.state.processedItems,
      total: this.state.totalItems,
      percentage: (this.state.processedItems / this.state.totalItems) * 100,
      currentItem: `Batch ${this.state.currentBatch + 1}/${this.state.totalBatches}`,
      estimatedTimeRemaining,
      canCancel: true,
      canPause: true,
      isPaused: this.state.isPaused,
    };

    this.options.onProgress(progress);
  }
}

// Factory function for creating partial processors
export function createPartialProcessor<TInput, TOutput>(
  processor: (item: TInput) => Promise<TOutput>,
  options: Partial<PartialProcessingOptions<TOutput>> = {}
): PartialProcessor<TInput, TOutput> {
  const defaultOptions: PartialProcessingOptions<TOutput> = {
    batchSize: 10,
    maxConcurrent: 3,
    continueOnError: true,
    maxFailureRate: 0.5,
    maxRetries: 2,
    shouldRetry: (error, attempt) => {
      // Retry transient errors
      return error.isTransient && attempt <= 2;
    },
  };

  return new PartialProcessor(processor, { ...defaultOptions, ...options });
}