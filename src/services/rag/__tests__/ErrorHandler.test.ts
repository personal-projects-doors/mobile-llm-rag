import { RAGErrorHandler } from '../ErrorHandler';
import {
  RAGError,
  RAGErrorCategory,
  PDFErrorCodes,
  EmbeddingErrorCodes,
  SimilaritySearchErrorCodes,
  DEFAULT_RETRY_CONFIG,
} from '../types';

describe('RAGErrorHandler', () => {
  let errorHandler: RAGErrorHandler;

  beforeEach(() => {
    errorHandler = new RAGErrorHandler();
  });

  afterEach(() => {
    errorHandler.clearHistory();
  });

  describe('handleError', () => {
    it('should handle recoverable errors with retry', async () => {
      let attemptCount = 0;
      const retryAction = jest.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const error = new RAGError(
        'Temporary error',
        EmbeddingErrorCodes.TIMEOUT,
        RAGErrorCategory.EMBEDDING_GENERATION
      );

      const result = await errorHandler.handleError(error, {
        operation: 'test_operation',
        retryAction,
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.action).toBe('retry');
      expect(retryAction).toHaveBeenCalledTimes(2);
    });

    it('should use fallback action when retry fails', async () => {
      const retryAction = jest.fn().mockRejectedValue(new Error('Retry failed'));
      const fallbackAction = jest.fn().mockResolvedValue('fallback_result');

      const error = new RAGError(
        'Recoverable error',
        EmbeddingErrorCodes.MODEL_NOT_LOADED,
        RAGErrorCategory.EMBEDDING_GENERATION
      );

      const result = await errorHandler.handleError(error, {
        operation: 'test_operation',
        retryAction,
        fallbackAction,
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('fallback_result');
      expect(result.action).toBe('fallback');
      expect(fallbackAction).toHaveBeenCalled();
    });

    it('should fail for non-recoverable errors', async () => {
      const error = new RAGError(
        'File not found',
        PDFErrorCodes.FILE_NOT_FOUND,
        RAGErrorCategory.DOCUMENT_PROCESSING
      );

      const result = await errorHandler.handleError(error, {
        operation: 'test_operation',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.action).toBe('failed');
    });

    it('should convert regular errors to RAGErrors', async () => {
      const regularError = new Error('Regular error');
      const fallbackAction = jest.fn().mockResolvedValue('fallback');

      const result = await errorHandler.handleError(regularError, {
        operation: 'test_operation',
        fallbackAction,
      });

      // Regular errors are converted to RAGErrors which are not recoverable by default
      expect(result.success).toBe(false);
      expect(result.action).toBe('failed');
    });
  });

  describe('executeWithRetry', () => {
    it('should retry transient errors', async () => {
      let attemptCount = 0;
      const fn = jest.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const result = await errorHandler.executeWithRetry(fn, EmbeddingErrorCodes.TIMEOUT);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Non-retryable error'));

      await expect(
        errorHandler.executeWithRetry(fn, PDFErrorCodes.FILE_NOT_FOUND)
      ).rejects.toThrow('Non-retryable error');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should respect max retry attempts', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Always fails'));

      await expect(
        errorHandler.executeWithRetry(fn, EmbeddingErrorCodes.TIMEOUT)
      ).rejects.toThrow('Always fails');

      expect(fn).toHaveBeenCalledTimes(DEFAULT_RETRY_CONFIG.maxAttempts);
    });
  });

  describe('degradeToNormalChat', () => {
    it('should execute normal chat action', async () => {
      const normalChatAction = jest.fn().mockResolvedValue('normal_chat_result');

      const result = await errorHandler.degradeToNormalChat(
        normalChatAction,
        'Test degradation'
      );

      expect(result).toBe('normal_chat_result');
      expect(normalChatAction).toHaveBeenCalled();
    });

    it('should throw RAGError if normal chat fails', async () => {
      const normalChatAction = jest.fn().mockRejectedValue(new Error('Chat failed'));

      await expect(
        errorHandler.degradeToNormalChat(normalChatAction, 'Test degradation')
      ).rejects.toThrow(RAGError);
    });
  });

  describe('processInBatches', () => {
    it('should process items in batches successfully', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = jest.fn().mockImplementation(async (item: number) => item * 2);
      const onProgress = jest.fn();
      const onBatchComplete = jest.fn();

      const result = await errorHandler.processInBatches(items, processor, {
        batchSize: 2,
        onProgress,
        onBatchComplete,
      });

      expect(result.completed).toEqual([2, 4, 6, 8, 10]);
      expect(result.successCount).toBe(5);
      expect(result.failureCount).toBe(0);
      expect(result.canContinue).toBe(true);
      expect(onProgress).toHaveBeenCalled();
      expect(onBatchComplete).toHaveBeenCalled();
    });

    it('should handle partial failures', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = jest.fn().mockImplementation(async (item: number) => {
        if (item === 3) {
          throw new Error('Item 3 failed');
        }
        return item * 2;
      });

      const result = await errorHandler.processInBatches(items, processor, {
        batchSize: 2,
        shouldContinueOnError: true,
      });

      expect(result.completed).toEqual([2, 4, 8, 10]);
      expect(result.successCount).toBe(4);
      expect(result.failureCount).toBe(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].item).toBe(3);
    });

    it('should stop on high failure rate', async () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const processor = jest.fn().mockImplementation(async (item: number) => {
        if (item > 3) {
          throw new Error(`Item ${item} failed`);
        }
        return item * 2;
      });

      const result = await errorHandler.processInBatches(items, processor, {
        batchSize: 2,
        shouldContinueOnError: true,
        maxFailures: 3,
      });

      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBeGreaterThan(0);
      expect(result.canContinue).toBe(false);
    });
  });

  describe('createUserErrorMessage', () => {
    it('should create user-friendly error messages', () => {
      const error = new RAGError(
        'Technical error message',
        PDFErrorCodes.CORRUPTED_FILE,
        RAGErrorCategory.DOCUMENT_PROCESSING
      );

      const userMessage = errorHandler.createUserErrorMessage(error);

      expect(userMessage.title).toBe('Document Processing Error');
      expect(userMessage.message).toContain('corrupted');
      expect(userMessage.suggestions).toBeInstanceOf(Array);
      expect(userMessage.actions).toBeInstanceOf(Array);
    });
  });

  describe('getErrorStatistics', () => {
    it('should track error statistics', async () => {
      // Generate some errors
      const error1 = new RAGError('Error 1', PDFErrorCodes.CORRUPTED_FILE, RAGErrorCategory.DOCUMENT_PROCESSING);
      const error2 = new RAGError('Error 2', EmbeddingErrorCodes.TIMEOUT, RAGErrorCategory.EMBEDDING_GENERATION);
      const error3 = new RAGError('Error 3', PDFErrorCodes.CORRUPTED_FILE, RAGErrorCategory.DOCUMENT_PROCESSING);

      await errorHandler.handleError(error1, { operation: 'test1' });
      await errorHandler.handleError(error2, { operation: 'test2' });
      await errorHandler.handleError(error3, { operation: 'test3' });

      const stats = errorHandler.getErrorStatistics();

      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByCategory[RAGErrorCategory.DOCUMENT_PROCESSING]).toBe(2);
      expect(stats.errorsByCategory[RAGErrorCategory.EMBEDDING_GENERATION]).toBe(1);
      expect(stats.errorsByCode[PDFErrorCodes.CORRUPTED_FILE]).toBe(2);
      expect(stats.errorsByCode[EmbeddingErrorCodes.TIMEOUT]).toBe(1);
    });

    it('should filter by time window', async () => {
      const oldError = new RAGError('Old error', PDFErrorCodes.CORRUPTED_FILE, RAGErrorCategory.DOCUMENT_PROCESSING);
      await errorHandler.handleError(oldError, { operation: 'old_test' });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      const newError = new RAGError('New error', EmbeddingErrorCodes.TIMEOUT, RAGErrorCategory.EMBEDDING_GENERATION);
      await errorHandler.handleError(newError, { operation: 'new_test' });

      const stats = errorHandler.getErrorStatistics(5); // Last 5ms

      expect(stats.totalErrors).toBe(1);
      expect(stats.errorsByCode[EmbeddingErrorCodes.TIMEOUT]).toBe(1);
      expect(stats.errorsByCode[PDFErrorCodes.CORRUPTED_FILE]).toBeUndefined();
    });
  });
});