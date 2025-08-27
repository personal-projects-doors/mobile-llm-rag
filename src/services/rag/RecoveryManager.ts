import {
  RAGError,
  RAGErrorCategory,
  RAGRecoveryAction,
  PartialProcessingResult,
} from './types';
import { ragErrorHandler } from './ErrorHandler';
import { modelStore } from '../../store';

export interface RecoveryContext {
  originalOperation: string;
  documentId?: string;
  chunkId?: string;
  userId?: string;
  sessionId?: string;
  retryCount?: number;
}

export interface FallbackOptions {
  enableNormalChat: boolean;
  skipCurrentDocument: boolean;
  usePartialResults: boolean;
  notifyUser: boolean;
}

export class RAGRecoveryManager {
  private activeRecoveries = new Map<string, Promise<any>>();
  private recoveryHistory: Array<{
    error: RAGError;
    action: string;
    success: boolean;
    timestamp: Date;
  }> = [];

  // Main recovery orchestration method
  async recoverFromError<T>(
    error: RAGError,
    context: RecoveryContext,
    options: {
      fallbackAction?: () => Promise<T>;
      retryAction?: () => Promise<T>;
      partialResults?: any[];
      fallbackOptions?: Partial<FallbackOptions>;
    } = {}
  ): Promise<{
    success: boolean;
    result?: T;
    recoveryAction: string;
    shouldNotifyUser: boolean;
    userMessage?: string;
  }> {
    const recoveryKey = `${context.originalOperation}-${context.documentId || 'global'}`;
    
    // Prevent concurrent recoveries for the same operation
    if (this.activeRecoveries.has(recoveryKey)) {
      try {
        const result = await this.activeRecoveries.get(recoveryKey);
        return result;
      } catch (concurrentError) {
        // Continue with new recovery attempt
      }
    }

    const recoveryPromise = this.executeRecovery(error, context, options);
    this.activeRecoveries.set(recoveryKey, recoveryPromise);

    try {
      const result = await recoveryPromise;
      this.recordRecoveryAttempt(error, result.recoveryAction, result.success);
      return result;
    } finally {
      this.activeRecoveries.delete(recoveryKey);
    }
  }

  // Execute the actual recovery logic
  private async executeRecovery<T>(
    error: RAGError,
    context: RecoveryContext,
    options: {
      fallbackAction?: () => Promise<T>;
      retryAction?: () => Promise<T>;
      partialResults?: any[];
      fallbackOptions?: Partial<FallbackOptions>;
    }
  ): Promise<{
    success: boolean;
    result?: T;
    recoveryAction: string;
    shouldNotifyUser: boolean;
    userMessage?: string;
  }> {
    const fallbackOptions: FallbackOptions = {
      enableNormalChat: true,
      skipCurrentDocument: false,
      usePartialResults: true,
      notifyUser: true,
      ...options.fallbackOptions,
    };

    // Strategy 1: Automatic retry for transient errors
    if (error.isTransient && options.retryAction && (context.retryCount || 0) < 2) {
      try {
        console.log(`Attempting automatic retry for transient error: ${error.code}`);
        const result = await ragErrorHandler.executeWithRetry(options.retryAction, error.code);
        
        return {
          success: true,
          result,
          recoveryAction: 'automatic_retry',
          shouldNotifyUser: false,
        };
      } catch (retryError) {
        console.log('Automatic retry failed, proceeding to fallback strategies');
      }
    }

    // Strategy 2: Model-specific recovery
    if (error.category === RAGErrorCategory.EMBEDDING_GENERATION || 
        error.category === RAGErrorCategory.MODEL_MANAGEMENT) {
      const modelRecovery = await this.attemptModelRecovery(error, options.retryAction);
      if (modelRecovery.success) {
        return {
          ...modelRecovery,
          recoveryAction: 'model_recovery',
          shouldNotifyUser: true,
          userMessage: 'AI model reloaded successfully. Continuing with document search.',
        };
      }
    }

    // Strategy 3: Partial processing recovery
    if (options.partialResults && options.partialResults.length > 0 && fallbackOptions.usePartialResults) {
      console.log(`Using partial results: ${options.partialResults.length} items processed`);
      
      return {
        success: true,
        result: options.partialResults as T,
        recoveryAction: 'partial_results',
        shouldNotifyUser: true,
        userMessage: `Processed ${options.partialResults.length} items successfully. Some items were skipped due to errors.`,
      };
    }

    // Strategy 4: Document-specific recovery
    if (error.category === RAGErrorCategory.DOCUMENT_PROCESSING && fallbackOptions.skipCurrentDocument) {
      return {
        success: true,
        result: undefined,
        recoveryAction: 'skip_document',
        shouldNotifyUser: true,
        userMessage: 'Skipped problematic document. Continuing with other documents.',
      };
    }

    // Strategy 5: Graceful degradation to normal chat
    if (fallbackOptions.enableNormalChat && options.fallbackAction) {
      try {
        console.log('Degrading to normal chat mode');
        const result = await ragErrorHandler.degradeToNormalChat(
          options.fallbackAction,
          `RAG error: ${error.code}`
        );

        return {
          success: true,
          result,
          recoveryAction: 'normal_chat_fallback',
          shouldNotifyUser: fallbackOptions.notifyUser,
          userMessage: fallbackOptions.notifyUser 
            ? 'Continuing with normal chat. Document search is temporarily unavailable.'
            : undefined,
        };
      } catch (fallbackError) {
        console.error('Fallback to normal chat failed:', fallbackError);
      }
    }

    // Strategy 6: Complete failure
    return {
      success: false,
      recoveryAction: 'no_recovery',
      shouldNotifyUser: true,
      userMessage: error.getUserMessage(),
    };
  }

  // Attempt to recover from model-related errors
  private async attemptModelRecovery<T>(
    error: RAGError,
    retryAction?: () => Promise<T>
  ): Promise<{ success: boolean; result?: T }> {
    try {
      // Check if medgemma model is available
      const medgemmaModel = modelStore.models.find(m => m.id === 'unsloth/medgemma-4b-it-GGUF/medgemma-4b-it-IQ4_NL.gguf');
      
      if (!medgemmaModel) {
        console.log('medgemma model not found, cannot recover');
        return { success: false };
      }

      // Try to reload the model if it's not loaded
      if (!medgemmaModel.isLoaded) {
        console.log('Attempting to load medgemma model for recovery');
        await modelStore.loadModel(medgemmaModel.id);
        
        // Wait a bit for the model to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Retry the original action if provided
      if (retryAction) {
        const result = await retryAction();
        return { success: true, result };
      }

      return { success: true };
    } catch (modelError) {
      console.error('Model recovery failed:', modelError);
      return { success: false };
    }
  }

  // Create recovery actions for user interaction
  createUserRecoveryActions(
    error: RAGError,
    context: RecoveryContext
  ): RAGRecoveryAction[] {
    const actions: RAGRecoveryAction[] = [];

    // Retry action for recoverable errors
    if (error.isRecoverable) {
      actions.push({
        type: 'retry',
        label: 'Try Again',
        description: 'Attempt the operation again',
        action: async () => {
          // This would be implemented by the calling component
          console.log('User initiated retry');
        },
        priority: 'high',
      });
    }

    // Skip current item for batch operations
    if (context.documentId) {
      actions.push({
        type: 'skip',
        label: 'Skip This Document',
        description: 'Continue without processing this document',
        action: async () => {
          console.log(`Skipping document: ${context.documentId}`);
        },
        priority: 'medium',
      });
    }

    // Fallback to normal chat
    actions.push({
      type: 'fallback',
      label: 'Use Normal Chat',
      description: 'Continue without document search',
      action: async () => {
        console.log('User chose normal chat fallback');
      },
      priority: 'medium',
    });

    // Manual intervention for critical errors
    if (error.severity === 'critical') {
      actions.push({
        type: 'manual',
        label: 'Report Issue',
        description: 'Report this issue for further assistance',
        action: async () => {
          console.log('User reporting issue:', error.getTechnicalDetails());
        },
        priority: 'low',
      });
    }

    return actions;
  }

  // Handle partial processing scenarios
  async handlePartialProcessing<T>(
    partialResult: PartialProcessingResult<T>,
    context: RecoveryContext
  ): Promise<{
    shouldContinue: boolean;
    userMessage: string;
    recoveryActions: RAGRecoveryAction[];
  }> {
    const successRate = partialResult.successCount / partialResult.totalItems;
    const hasFailures = partialResult.failureCount > 0;

    // If success rate is very low, suggest stopping
    if (successRate < 0.3 && hasFailures) {
      return {
        shouldContinue: false,
        userMessage: `Processing failed for most items (${partialResult.failureCount}/${partialResult.totalItems} failed). Consider checking your documents or trying again later.`,
        recoveryActions: [
          {
            type: 'manual',
            label: 'Check Documents',
            description: 'Review the documents that failed to process',
            action: async () => {},
            priority: 'high',
          },
          {
            type: 'retry',
            label: 'Retry Failed Items',
            description: 'Try processing the failed items again',
            action: async () => {},
            priority: 'medium',
          },
        ],
      };
    }

    // If some items succeeded, offer to continue with partial results
    if (partialResult.successCount > 0 && hasFailures) {
      return {
        shouldContinue: true,
        userMessage: `Processed ${partialResult.successCount}/${partialResult.totalItems} items successfully. ${partialResult.failureCount} items failed.`,
        recoveryActions: [
          {
            type: 'fallback',
            label: 'Continue with Partial Results',
            description: 'Use the successfully processed items',
            action: async () => {},
            priority: 'high',
          },
          {
            type: 'retry',
            label: 'Retry Failed Items',
            description: 'Try processing the failed items again',
            action: async () => {},
            priority: 'medium',
          },
        ],
      };
    }

    // All items processed successfully
    return {
      shouldContinue: true,
      userMessage: `Successfully processed all ${partialResult.successCount} items.`,
      recoveryActions: [],
    };
  }

  // Get recovery statistics
  getRecoveryStatistics(): {
    totalRecoveries: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    recoveryRate: number;
    commonRecoveryActions: Array<{ action: string; count: number }>;
  } {
    const total = this.recoveryHistory.length;
    const successful = this.recoveryHistory.filter(r => r.success).length;
    const failed = total - successful;
    const rate = total > 0 ? successful / total : 0;

    // Count recovery actions
    const actionCounts = new Map<string, number>();
    for (const recovery of this.recoveryHistory) {
      const count = actionCounts.get(recovery.action) || 0;
      actionCounts.set(recovery.action, count + 1);
    }

    const commonActions = Array.from(actionCounts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalRecoveries: total,
      successfulRecoveries: successful,
      failedRecoveries: failed,
      recoveryRate: rate,
      commonRecoveryActions: commonActions,
    };
  }

  // Clear recovery history
  clearHistory(): void {
    this.recoveryHistory = [];
  }

  // Private helper methods
  private recordRecoveryAttempt(error: RAGError, action: string, success: boolean): void {
    this.recoveryHistory.push({
      error,
      action,
      success,
      timestamp: new Date(),
    });

    // Keep history manageable
    if (this.recoveryHistory.length > 1000) {
      this.recoveryHistory = this.recoveryHistory.slice(-1000);
    }
  }
}

// Singleton instance for global use
export const ragRecoveryManager = new RAGRecoveryManager();