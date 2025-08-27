import { RAGRecoveryManager } from '../RecoveryManager';
import {
  RAGError,
  RAGErrorCategory,
  PDFErrorCodes,
  EmbeddingErrorCodes,
  PartialProcessingResult,
} from '../types';

// Mock the model store
jest.mock('../../../store', () => ({
  modelStore: {
    models: [
      {
        id: 'unsloth/medgemma-4b-it-GGUF/medgemma-4b-it-IQ4_NL.gguf',
        isLoaded: false,
      },
    ],
    loadModel: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('RAGRecoveryManager', () => {
  let recoveryManager: RAGRecoveryManager;

  beforeEach(() => {
    recoveryManager = new RAGRecoveryManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    recoveryManager.clearHistory();
  });

  describe('recoverFromError', () => {
    it('should attempt automatic retry for transient errors', async () => {
      let attemptCount = 0;
      const retryAction = jest.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Temporary failure');
        }
        return 'retry_success';
      });

      const error = new RAGError(
        'Transient error',
        EmbeddingErrorCodes.TIMEOUT,
        RAGErrorCategory.EMBEDDING_GENERATION
      );

      const result = await recoveryManager.recoverFromError(error, {
        originalOperation: 'test_operation',
      }, {
        retryAction,
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('retry_success');
      expect(result.recoveryAction).toBe('automatic_retry');
      expect(result.shouldNotifyUser).toBe(false);
    });

    it('should attempt model recovery for embedding errors', async () => {
      const { modelStore } = require('../../../store');
      const retryAction = jest.fn().mockResolvedValue('model_recovery_success');

      const error = new RAGError(
        'Model not loaded',
        EmbeddingErrorCodes.MODEL_NOT_LOADED,
        RAGErrorCategory.EMBEDDING_GENERATION
      );

      // Set retry count to prevent automatic retry
      const result = await recoveryManager.recoverFromError(error, {
        originalOperation: 'embedding_generation',
        retryCount: 3, // Prevent automatic retry
      }, {
        retryAction,
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('model_recovery_success');
      expect(result.recoveryAction).toBe('model_recovery');
      expect(result.shouldNotifyUser).toBe(true);
      expect(modelStore.loadModel).toHaveBeenCalledWith('unsloth/medgemma-4b-it-GGUF/medgemma-4b-it-IQ4_NL.gguf');
    });

    it('should use partial results when available', async () => {
      const error = new RAGError(
        'Processing failed',
        PDFErrorCodes.PROCESSING_FAILED,
        RAGErrorCategory.DOCUMENT_PROCESSING
      );

      const partialResults = ['result1', 'result2', 'result3'];

      const result = await recoveryManager.recoverFromError(error, {
        originalOperation: 'document_processing',
      }, {
        partialResults,
        fallbackOptions: { usePartialResults: true },
      });

      expect(result.success).toBe(true);
      expect(result.result).toEqual(partialResults);
      expect(result.recoveryAction).toBe('partial_results');
      expect(result.shouldNotifyUser).toBe(true);
      expect(result.userMessage).toContain('Processed 3 items successfully');
    });

    it('should skip problematic documents', async () => {
      const error = new RAGError(
        'Document corrupted',
        PDFErrorCodes.CORRUPTED_FILE,
        RAGErrorCategory.DOCUMENT_PROCESSING
      );

      const result = await recoveryManager.recoverFromError(error, {
        originalOperation: 'document_processing',
        documentId: 'doc123',
      }, {
        fallbackOptions: { skipCurrentDocument: true },
      });

      expect(result.success).toBe(true);
      expect(result.recoveryAction).toBe('skip_document');
      expect(result.shouldNotifyUser).toBe(true);
      expect(result.userMessage).toContain('Skipped problematic document');
    });

    it('should fall back to normal chat', async () => {
      const fallbackAction = jest.fn().mockResolvedValue('normal_chat_result');

      const error = new RAGError(
        'RAG system failure',
        'SYSTEM_ERROR',
        RAGErrorCategory.SYSTEM
      );

      const result = await recoveryManager.recoverFromError(error, {
        originalOperation: 'message_processing',
      }, {
        fallbackAction,
        fallbackOptions: { enableNormalChat: true },
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('normal_chat_result');
      expect(result.recoveryAction).toBe('normal_chat_fallback');
      expect(result.shouldNotifyUser).toBe(true);
      expect(result.userMessage).toContain('normal chat');
    });

    it('should handle complete failure', async () => {
      const error = new RAGError(
        'Unrecoverable error',
        PDFErrorCodes.FILE_NOT_FOUND,
        RAGErrorCategory.DOCUMENT_PROCESSING
      );

      const result = await recoveryManager.recoverFromError(error, {
        originalOperation: 'document_processing',
      }, {
        fallbackOptions: { enableNormalChat: false },
      });

      expect(result.success).toBe(false);
      expect(result.recoveryAction).toBe('no_recovery');
      expect(result.shouldNotifyUser).toBe(true);
      expect(result.userMessage).toBe(error.getUserMessage());
    });

    it('should prevent concurrent recoveries for same operation', async () => {
      const retryAction = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'success';
      });

      const error = new RAGError(
        'Test error',
        EmbeddingErrorCodes.TIMEOUT,
        RAGErrorCategory.EMBEDDING_GENERATION
      );

      const context = {
        originalOperation: 'test_operation',
        documentId: 'doc123',
      };

      // Start two concurrent recoveries
      const promise1 = recoveryManager.recoverFromError(error, context, { retryAction });
      const promise2 = recoveryManager.recoverFromError(error, context, { retryAction });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(retryAction).toHaveBeenCalledTimes(1); // Should only be called once
    });
  });

  describe('createUserRecoveryActions', () => {
    it('should create retry action for recoverable errors', () => {
      const error = new RAGError(
        'Recoverable error',
        EmbeddingErrorCodes.TIMEOUT,
        RAGErrorCategory.EMBEDDING_GENERATION
      );

      const actions = recoveryManager.createUserRecoveryActions(error, {
        originalOperation: 'test_operation',
      });

      expect(actions).toHaveLength(2); // Retry + Fallback
      expect(actions[0].type).toBe('retry');
      expect(actions[0].label).toBe('Try Again');
      expect(actions[1].type).toBe('fallback');
      expect(actions[1].label).toBe('Use Normal Chat');
    });

    it('should create skip action for document-specific errors', () => {
      const error = new RAGError(
        'Document error',
        PDFErrorCodes.CORRUPTED_FILE,
        RAGErrorCategory.DOCUMENT_PROCESSING
      );

      const actions = recoveryManager.createUserRecoveryActions(error, {
        originalOperation: 'document_processing',
        documentId: 'doc123',
      });

      const skipAction = actions.find(action => action.type === 'skip');
      expect(skipAction).toBeDefined();
      expect(skipAction!.label).toBe('Skip This Document');
    });

    it('should create report action for critical errors', () => {
      const error = new RAGError(
        'Critical error',
        'CRITICAL_SYSTEM_ERROR',
        RAGErrorCategory.SYSTEM
      );
      // Manually set severity since it's determined by error info
      (error as any).severity = 'critical';

      const actions = recoveryManager.createUserRecoveryActions(error, {
        originalOperation: 'system_operation',
      });

      const reportAction = actions.find(action => action.type === 'manual');
      expect(reportAction).toBeDefined();
      expect(reportAction!.label).toBe('Report Issue');
    });
  });

  describe('handlePartialProcessing', () => {
    it('should suggest continuing with high success rate', async () => {
      const partialResult: PartialProcessingResult<string> = {
        completed: ['result1', 'result2', 'result3', 'result4'],
        failed: [
          {
            item: 'item5',
            error: new RAGError('Failed', 'PROCESSING_FAILED', RAGErrorCategory.DOCUMENT_PROCESSING),
          },
        ],
        totalItems: 5,
        successCount: 4,
        failureCount: 1,
        canContinue: true,
      };

      const result = await recoveryManager.handlePartialProcessing(partialResult, {
        originalOperation: 'batch_processing',
      });

      expect(result.shouldContinue).toBe(true);
      expect(result.userMessage).toContain('4/5 items successfully');
      expect(result.recoveryActions).toHaveLength(2);
      expect(result.recoveryActions[0].type).toBe('fallback');
      expect(result.recoveryActions[1].type).toBe('retry');
    });

    it('should suggest stopping with low success rate', async () => {
      const partialResult: PartialProcessingResult<string> = {
        completed: ['result1'],
        failed: [
          {
            item: 'item2',
            error: new RAGError('Failed', 'PROCESSING_FAILED', RAGErrorCategory.DOCUMENT_PROCESSING),
          },
          {
            item: 'item3',
            error: new RAGError('Failed', 'PROCESSING_FAILED', RAGErrorCategory.DOCUMENT_PROCESSING),
          },
          {
            item: 'item4',
            error: new RAGError('Failed', 'PROCESSING_FAILED', RAGErrorCategory.DOCUMENT_PROCESSING),
          },
        ],
        totalItems: 4,
        successCount: 1,
        failureCount: 3,
        canContinue: false,
      };

      const result = await recoveryManager.handlePartialProcessing(partialResult, {
        originalOperation: 'batch_processing',
      });

      expect(result.shouldContinue).toBe(false);
      expect(result.userMessage).toContain('failed for most items');
      expect(result.recoveryActions).toHaveLength(2);
      expect(result.recoveryActions[0].type).toBe('manual');
      expect(result.recoveryActions[1].type).toBe('retry');
    });

    it('should handle complete success', async () => {
      const partialResult: PartialProcessingResult<string> = {
        completed: ['result1', 'result2', 'result3'],
        failed: [],
        totalItems: 3,
        successCount: 3,
        failureCount: 0,
        canContinue: true,
      };

      const result = await recoveryManager.handlePartialProcessing(partialResult, {
        originalOperation: 'batch_processing',
      });

      expect(result.shouldContinue).toBe(true);
      expect(result.userMessage).toContain('Successfully processed all 3 items');
      expect(result.recoveryActions).toHaveLength(0);
    });
  });

  describe('getRecoveryStatistics', () => {
    it('should track recovery statistics', async () => {
      const error1 = new RAGError('Error 1', EmbeddingErrorCodes.TIMEOUT, RAGErrorCategory.EMBEDDING_GENERATION);
      const error2 = new RAGError('Error 2', PDFErrorCodes.CORRUPTED_FILE, RAGErrorCategory.DOCUMENT_PROCESSING);

      // Successful recovery
      await recoveryManager.recoverFromError(error1, {
        originalOperation: 'test1',
      }, {
        retryAction: async () => 'success',
      });

      // Failed recovery
      await recoveryManager.recoverFromError(error2, {
        originalOperation: 'test2',
      }, {
        fallbackOptions: { enableNormalChat: false },
      });

      const stats = recoveryManager.getRecoveryStatistics();

      expect(stats.totalRecoveries).toBe(2);
      expect(stats.successfulRecoveries).toBe(1);
      expect(stats.failedRecoveries).toBe(1);
      expect(stats.recoveryRate).toBe(0.5);
      expect(stats.commonRecoveryActions).toBeInstanceOf(Array);
    });
  });
});