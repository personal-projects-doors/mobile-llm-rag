import { PartialProcessor, createPartialProcessor } from '../PartialProcessor';
import { RAGError, RAGErrorCategory } from '../types';

describe('PartialProcessor', () => {
  describe('process', () => {
    it('should process all items successfully', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = jest.fn().mockImplementation(async (item: number) => item * 2);
      const onProgress = jest.fn();
      const onBatchComplete = jest.fn();

      const partialProcessor = new PartialProcessor(processor, {
        batchSize: 2,
        maxConcurrent: 1,
        continueOnError: true,
        maxFailureRate: 0.5,
        maxRetries: 1,
        onProgress,
        onBatchComplete,
      });

      const result = await partialProcessor.process(items);

      expect(result.completed).toEqual([2, 4, 6, 8, 10]);
      expect(result.successCount).toBe(5);
      expect(result.failureCount).toBe(0);
      expect(result.canContinue).toBe(true);
      expect(onProgress).toHaveBeenCalled();
      expect(onBatchComplete).toHaveBeenCalled();
    });

    it('should handle partial failures and continue', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = jest.fn().mockImplementation(async (item: number) => {
        if (item === 3) {
          throw new Error('Item 3 failed');
        }
        return item * 2;
      });

      const partialProcessor = new PartialProcessor(processor, {
        batchSize: 2,
        maxConcurrent: 1,
        continueOnError: true,
        maxFailureRate: 0.5,
        maxRetries: 0,
      });

      const result = await partialProcessor.process(items);

      expect(result.completed).toEqual([2, 4, 8, 10]);
      expect(result.successCount).toBe(4);
      expect(result.failureCount).toBe(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].item).toBe(3);
      expect(result.canContinue).toBe(true);
    });

    it('should stop on high failure rate', async () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const processor = jest.fn().mockImplementation(async (item: number) => {
        if (item > 2) {
          throw new Error(`Item ${item} failed`);
        }
        return item * 2;
      });

      const partialProcessor = new PartialProcessor(processor, {
        batchSize: 2,
        maxConcurrent: 1,
        continueOnError: true,
        maxFailureRate: 0.2, // 20% failure rate threshold
        maxRetries: 0,
      });

      const result = await partialProcessor.process(items);

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBeGreaterThan(3);
      expect(result.canContinue).toBe(false);
    });

    it('should retry failed items', async () => {
      const items = [1, 2, 3];
      let attemptCounts = new Map<number, number>();

      const processor = jest.fn().mockImplementation(async (item: number) => {
        const attempts = attemptCounts.get(item) || 0;
        attemptCounts.set(item, attempts + 1);

        if (item === 2 && attempts < 2) {
          throw new Error('Item 2 temporary failure');
        }
        return item * 2;
      });

      const shouldRetry = jest.fn().mockReturnValue(true);

      const partialProcessor = new PartialProcessor(processor, {
        batchSize: 2,
        maxConcurrent: 1,
        continueOnError: true,
        maxFailureRate: 0.5,
        maxRetries: 2,
        shouldRetry,
      });

      const result = await partialProcessor.process(items);

      expect(result.completed).toEqual([2, 4, 6]);
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
      expect(attemptCounts.get(2)).toBe(3); // Initial + 2 retries
    });

    it('should stop retrying after max attempts', async () => {
      const items = [1, 2, 3];
      const processor = jest.fn().mockImplementation(async (item: number) => {
        if (item === 2) {
          throw new Error('Item 2 always fails');
        }
        return item * 2;
      });

      const shouldRetry = jest.fn().mockReturnValue(true);

      const partialProcessor = new PartialProcessor(processor, {
        batchSize: 2,
        maxConcurrent: 1,
        continueOnError: true,
        maxFailureRate: 0.5,
        maxRetries: 2,
        shouldRetry,
      });

      const result = await partialProcessor.process(items);

      expect(result.completed).toEqual([2, 6]);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
      expect(result.failed[0].item).toBe(2);
      expect(processor).toHaveBeenCalledTimes(5); // 1 + 3 + 1 (item 2 retried 3 times total)
    });

    it('should handle concurrent processing', async () => {
      const items = [1, 2, 3, 4, 5, 6];
      const processingOrder: number[] = [];
      
      const processor = jest.fn().mockImplementation(async (item: number) => {
        processingOrder.push(item);
        await new Promise(resolve => setTimeout(resolve, 10));
        return item * 2;
      });

      const partialProcessor = new PartialProcessor(processor, {
        batchSize: 3,
        maxConcurrent: 2,
        continueOnError: true,
        maxFailureRate: 0.5,
        maxRetries: 0,
      });

      const result = await partialProcessor.process(items);

      expect(result.completed).toEqual([2, 4, 6, 8, 10, 12]);
      expect(result.successCount).toBe(6);
      expect(result.failureCount).toBe(0);
      expect(processor).toHaveBeenCalledTimes(6);
    });

    it('should throw error if already running', async () => {
      const items = [1, 2, 3];
      const processor = jest.fn().mockImplementation(async (item: number) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return item * 2;
      });

      const partialProcessor = new PartialProcessor(processor, {
        batchSize: 2,
        maxConcurrent: 1,
        continueOnError: true,
        maxFailureRate: 0.5,
        maxRetries: 0,
      });

      // Start processing
      const promise1 = partialProcessor.process(items);

      // Try to start again while running
      await expect(partialProcessor.process(items)).rejects.toThrow(RAGError);

      // Wait for first process to complete
      await promise1;
    });
  });

  describe('control methods', () => {
    it('should pause and resume processing', async () => {
      const items = [1, 2, 3, 4, 5];
      let processedItems: number[] = [];
      
      const processor = jest.fn().mockImplementation(async (item: number) => {
        processedItems.push(item);
        await new Promise(resolve => setTimeout(resolve, 50));
        return item * 2;
      });

      const partialProcessor = new PartialProcessor(processor, {
        batchSize: 2,
        maxConcurrent: 1,
        continueOnError: true,
        maxFailureRate: 0.5,
        maxRetries: 0,
      });

      const processPromise = partialProcessor.process(items);

      // Wait a bit then pause
      await new Promise(resolve => setTimeout(resolve, 75));
      partialProcessor.pause();
      expect(partialProcessor.isPaused()).toBe(true);

      const itemsProcessedWhenPaused = processedItems.length;

      // Wait a bit more to ensure processing is paused
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(processedItems.length).toBe(itemsProcessedWhenPaused);

      // Resume processing
      partialProcessor.resume();
      expect(partialProcessor.isPaused()).toBe(false);

      const result = await processPromise;
      expect(result.successCount).toBe(5);
    });

    it('should cancel processing', async () => {
      const items = [1, 2, 3, 4, 5];
      let processedItems: number[] = [];
      
      const processor = jest.fn().mockImplementation(async (item: number) => {
        processedItems.push(item);
        await new Promise(resolve => setTimeout(resolve, 50));
        return item * 2;
      });

      const partialProcessor = new PartialProcessor(processor, {
        batchSize: 2,
        maxConcurrent: 1,
        continueOnError: true,
        maxFailureRate: 0.5,
        maxRetries: 0,
      });

      const processPromise = partialProcessor.process(items);

      // Wait a bit then cancel
      await new Promise(resolve => setTimeout(resolve, 75));
      partialProcessor.cancel();
      expect(partialProcessor.isCancelled()).toBe(true);

      const result = await processPromise;
      expect(result.successCount).toBeLessThan(5);
      expect(result.canContinue).toBe(false);
    });
  });

  describe('getState', () => {
    it('should return current processing state', async () => {
      const items = [1, 2, 3];
      const processor = jest.fn().mockImplementation(async (item: number) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return item * 2;
      });

      const partialProcessor = new PartialProcessor(processor, {
        batchSize: 2,
        maxConcurrent: 1,
        continueOnError: true,
        maxFailureRate: 0.5,
        maxRetries: 0,
      });

      expect(partialProcessor.isRunning()).toBe(false);

      const processPromise = partialProcessor.process(items);
      expect(partialProcessor.isRunning()).toBe(true);

      const state = partialProcessor.getState();
      expect(state.isRunning).toBe(true);
      expect(state.totalItems).toBe(3);
      expect(state.totalBatches).toBe(2);

      await processPromise;
      expect(partialProcessor.isRunning()).toBe(false);
    });
  });

  describe('createPartialProcessor', () => {
    it('should create processor with default options', () => {
      const processor = jest.fn();
      const partialProcessor = createPartialProcessor(processor);

      expect(partialProcessor).toBeInstanceOf(PartialProcessor);
    });

    it('should create processor with custom options', () => {
      const processor = jest.fn();
      const partialProcessor = createPartialProcessor(processor, {
        batchSize: 5,
        maxConcurrent: 2,
      });

      expect(partialProcessor).toBeInstanceOf(PartialProcessor);
    });
  });
});