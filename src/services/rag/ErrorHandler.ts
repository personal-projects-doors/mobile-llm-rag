import {
  RAGError,
  RAGErrorCategory,
  RAGRecoveryAction,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
  PartialProcessingResult,
  ProcessingProgress,
} from './types';

export class RAGErrorHandler {
  private retryConfig: RetryConfig;
  private errorHistory: RAGError[] = [];
  private maxHistorySize = 100;

  constructor(retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG) {
    this.retryConfig = retryConfig;
  }

  // Main error handling method
  async handleError<T>(
    error: Error | RAGError,
    context: {
      operation: string;
      fallbackAction?: () => Promise<T>;
      retryAction?: () => Promise<T>;
      documentId?: string;
      chunkId?: string;
    }
  ): Promise<{
    success: boolean;
    result?: T;
    error?: RAGError;
    action: 'success' | 'fallback' | 'retry' | 'failed';
  }> {
    const ragError = this.ensureRAGError(error, context);
    this.addToHistory(ragError);

    // Log error for debugging
    console.error('RAG Error:', ragError.getTechnicalDetails());

    // Check if error is recoverable
    if (!ragError.isRecoverable) {
      return {
        success: false,
        error: ragError,
        action: 'failed',
      };
    }

    // Try recovery actions in order of priority
    const sortedActions = ragError.recoveryActions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    for (const action of sortedActions) {
      try {
        if (action.type === 'retry' && context.retryAction) {
          const result = await this.executeWithRetry(
            context.retryAction,
            ragError.code
          );
          return {
            success: true,
            result,
            action: 'retry',
          };
        } else if (action.type === 'fallback' && context.fallbackAction) {
          const result = await context.fallbackAction();
          return {
            success: true,
            result,
            action: 'fallback',
          };
        }
      } catch (recoveryError) {
        console.error('Recovery action failed:', recoveryError);
        continue;
      }
    }

    return {
      success: false,
      error: ragError,
      action: 'failed',
    };
  }

  // Execute function with retry logic
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    errorCode?: string
  ): Promise<T> {
    let lastError: Error;
    let delay = this.retryConfig.baseDelay;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Check if this error should be retried
        if (errorCode && !this.retryConfig.retryableErrors.includes(errorCode)) {
          throw error;
        }

        // Don't wait after the last attempt
        if (attempt < this.retryConfig.maxAttempts) {
          await this.sleep(delay);
          delay = Math.min(
            delay * this.retryConfig.backoffMultiplier,
            this.retryConfig.maxDelay
          );
        }
      }
    }

    throw lastError!;
  }

  // Graceful degradation to normal chat mode
  async degradeToNormalChat<T>(
    normalChatAction: () => Promise<T>,
    reason: string
  ): Promise<T> {
    console.log(`Degrading to normal chat: ${reason}`);
    
    try {
      return await normalChatAction();
    } catch (error) {
      throw new RAGError(
        'Failed to fall back to normal chat mode',
        'FALLBACK_FAILED',
        RAGErrorCategory.SYSTEM,
        { operation: 'fallback_to_normal_chat' },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // Partial processing support for large documents
  async processInBatches<TInput, TOutput>(
    items: TInput[],
    processor: (item: TInput) => Promise<TOutput>,
    options: {
      batchSize?: number;
      onProgress?: (progress: ProcessingProgress) => void;
      onBatchComplete?: (batch: TOutput[], batchIndex: number) => void;
      shouldContinueOnError?: boolean;
      maxFailures?: number;
    } = {}
  ): Promise<PartialProcessingResult<TOutput>> {
    const {
      batchSize = 10,
      onProgress,
      onBatchComplete,
      shouldContinueOnError = true,
      maxFailures = Math.floor(items.length * 0.5), // Allow up to 50% failures
    } = options;

    const result: PartialProcessingResult<TOutput> = {
      completed: [],
      failed: [],
      totalItems: items.length,
      successCount: 0,
      failureCount: 0,
      canContinue: true,
    };

    let processedCount = 0;
    const startTime = Date.now();

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults: TOutput[] = [];
      
      for (const item of batch) {
        try {
          const output = await processor(item);
          batchResults.push(output);
          result.completed.push(output);
          result.successCount++;
        } catch (error) {
          const ragError = this.ensureRAGError(error, {
            operation: 'batch_processing',
          });
          
          result.failed.push({ item, error: ragError });
          result.failureCount++;

          // Check if we should stop processing
          if (!shouldContinueOnError || result.failureCount >= maxFailures) {
            result.canContinue = false;
            result.nextBatch = items.slice(i + batch.indexOf(item) + 1);
            break;
          }
        }

        processedCount++;
        
        // Report progress
        if (onProgress) {
          const elapsed = Date.now() - startTime;
          const rate = processedCount / elapsed; // items per ms
          const remaining = items.length - processedCount;
          const estimatedTimeRemaining = remaining / rate;

          onProgress({
            current: processedCount,
            total: items.length,
            percentage: (processedCount / items.length) * 100,
            currentItem: String(item),
            estimatedTimeRemaining,
            canCancel: true,
            canPause: true,
            isPaused: false,
          });
        }
      }

      if (onBatchComplete && batchResults.length > 0) {
        onBatchComplete(batchResults, Math.floor(i / batchSize));
      }

      if (!result.canContinue) {
        break;
      }
    }

    return result;
  }

  // Create user-friendly error messages with recovery suggestions
  createUserErrorMessage(error: RAGError): {
    title: string;
    message: string;
    suggestions: string[];
    actions: RAGRecoveryAction[];
  } {
    const title = this.getErrorTitle(error.category);
    const message = error.getUserMessage();
    const suggestions = this.getRecoverySuggestions(error);
    
    return {
      title,
      message,
      suggestions,
      actions: error.recoveryActions,
    };
  }

  // Get error statistics for monitoring
  getErrorStatistics(timeWindow?: number): {
    totalErrors: number;
    errorsByCategory: Record<RAGErrorCategory, number>;
    errorsByCode: Record<string, number>;
    recoverableErrors: number;
    transientErrors: number;
    recentErrors: RAGError[];
  } {
    const cutoff = timeWindow ? Date.now() - timeWindow : 0;
    const relevantErrors = this.errorHistory.filter(
      error => error.timestamp.getTime() > cutoff
    );

    const errorsByCategory = {} as Record<RAGErrorCategory, number>;
    const errorsByCode = {} as Record<string, number>;
    let recoverableErrors = 0;
    let transientErrors = 0;

    for (const error of relevantErrors) {
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
      errorsByCode[error.code] = (errorsByCode[error.code] || 0) + 1;
      
      if (error.isRecoverable) recoverableErrors++;
      if (error.isTransient) transientErrors++;
    }

    return {
      totalErrors: relevantErrors.length,
      errorsByCategory,
      errorsByCode,
      recoverableErrors,
      transientErrors,
      recentErrors: relevantErrors.slice(-10), // Last 10 errors
    };
  }

  // Clear error history
  clearHistory(): void {
    this.errorHistory = [];
  }

  // Private helper methods
  private ensureRAGError(error: Error | RAGError, context: any): RAGError {
    if (error instanceof RAGError) {
      return error;
    }

    // Try to categorize the error based on its message or type
    let category = RAGErrorCategory.SYSTEM;
    let code = 'UNKNOWN_ERROR';

    if (error.message.includes('PDF') || error.message.includes('document')) {
      category = RAGErrorCategory.DOCUMENT_PROCESSING;
      code = 'PROCESSING_FAILED';
    } else if (error.message.includes('embedding') || error.message.includes('model')) {
      category = RAGErrorCategory.EMBEDDING_GENERATION;
      code = 'PROCESSING_FAILED';
    } else if (error.message.includes('database') || error.message.includes('query')) {
      category = RAGErrorCategory.DATABASE;
      code = 'DATABASE_ERROR';
    }

    return new RAGError(
      error.message,
      code,
      category,
      context,
      error
    );
  }

  private addToHistory(error: RAGError): void {
    this.errorHistory.push(error);
    
    // Keep history size manageable
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }

  private getErrorTitle(category: RAGErrorCategory): string {
    const titles: Record<RAGErrorCategory, string> = {
      [RAGErrorCategory.DOCUMENT_PROCESSING]: 'Document Processing Error',
      [RAGErrorCategory.EMBEDDING_GENERATION]: 'AI Model Error',
      [RAGErrorCategory.SIMILARITY_SEARCH]: 'Search Error',
      [RAGErrorCategory.CONTEXT_ASSEMBLY]: 'Context Assembly Error',
      [RAGErrorCategory.MESSAGE_PROCESSING]: 'Message Processing Error',
      [RAGErrorCategory.DATABASE]: 'Database Error',
      [RAGErrorCategory.MODEL_MANAGEMENT]: 'Model Management Error',
      [RAGErrorCategory.SYSTEM]: 'System Error',
    };

    return titles[category] || 'Unknown Error';
  }

  private getRecoverySuggestions(error: RAGError): string[] {
    const suggestions: string[] = [];

    if (error.isTransient) {
      suggestions.push('This is usually a temporary issue. Try again in a moment.');
    }

    if (error.category === RAGErrorCategory.DOCUMENT_PROCESSING) {
      suggestions.push('Make sure the PDF file is not corrupted or password-protected.');
      suggestions.push('Try processing a smaller document first.');
    }

    if (error.category === RAGErrorCategory.EMBEDDING_GENERATION) {
      suggestions.push('Close other apps to free up memory.');
      suggestions.push('Try processing fewer documents at once.');
    }

    if (error.category === RAGErrorCategory.DATABASE) {
      suggestions.push('Restart the app if the problem persists.');
      suggestions.push('Check available storage space on your device.');
    }

    if (error.severity === 'high' || error.severity === 'critical') {
      suggestions.push('Contact support if this error continues to occur.');
    }

    return suggestions;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance for global use
export const ragErrorHandler = new RAGErrorHandler();