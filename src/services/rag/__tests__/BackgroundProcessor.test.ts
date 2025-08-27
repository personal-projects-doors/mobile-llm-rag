import { BackgroundProcessor, BackgroundTask } from '../BackgroundProcessor';
import { RAGError, RAGErrorCategory } from '../types';

// Mock AppState
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({
      remove: jest.fn(),
    })),
  },
}));

describe('BackgroundProcessor', () => {
  let processor: BackgroundProcessor;

  beforeEach(() => {
    processor = new BackgroundProcessor({
      maxConcurrentTasks: 2,
      pauseOnBackground: false, // Disable for testing
      lowMemoryThreshold: 100,
      maxProcessingTime: 5000,
      enableProgressTracking: true,
    });
  });

  afterEach(() => {
    processor.cleanup();
  });

  describe('Task Management', () => {
    it('should add tasks to queue', () => {
      const taskId = processor.addTask({
        type: 'document_indexing',
        priority: 'high',
        data: { documentId: 'test-doc', chunks: [] },
      });

      expect(taskId).toBeDefined();
      expect(taskId).toMatch(/^task_\d+_[a-z0-9]+$/);
    });

    it('should prioritize high priority tasks', () => {
      const lowPriorityId = processor.addTask({
        type: 'document_indexing',
        priority: 'low',
        data: { documentId: 'low-doc', chunks: [] },
      });

      const highPriorityId = processor.addTask({
        type: 'document_indexing',
        priority: 'high',
        data: { documentId: 'high-doc', chunks: [] },
      });

      const state = processor.getState();
      expect(state.queuedTasks[0].id).toBe(highPriorityId);
      expect(state.queuedTasks[1].id).toBe(lowPriorityId);
    });

    it('should cancel queued tasks', () => {
      const taskId = processor.addTask({
        type: 'document_indexing',
        priority: 'medium',
        data: { documentId: 'test-doc', chunks: [] },
      });

      const cancelled = processor.cancelTask(taskId);
      expect(cancelled).toBe(true);

      const state = processor.getState();
      expect(state.queuedTasks).toHaveLength(0);
    });
  });

  describe('Processing Control', () => {
    it('should start and stop processing', () => {
      processor.start();
      let state = processor.getState();
      expect(state.isRunning).toBe(true);
      expect(state.isPaused).toBe(false);

      processor.stop();
      state = processor.getState();
      expect(state.isRunning).toBe(false);
    });

    it('should pause and resume processing', () => {
      processor.start();
      processor.pause();
      
      let state = processor.getState();
      expect(state.isPaused).toBe(true);

      processor.resume();
      state = processor.getState();
      expect(state.isPaused).toBe(false);
    });
  });

  describe('Memory Management', () => {
    it('should monitor memory usage', async () => {
      // Add multiple tasks to increase memory usage
      for (let i = 0; i < 5; i++) {
        processor.addTask({
          type: 'embedding_generation',
          priority: 'medium',
          data: { chunks: new Array(1000).fill('test'), modelId: 'test-model' },
        });
      }

      const state = processor.getState();
      expect(state.totalMemoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Progress Tracking', () => {
    it('should track task progress', (done) => {
      const taskId = processor.addTask({
        type: 'document_indexing',
        priority: 'high',
        data: { documentId: 'test-doc', chunks: [1, 2, 3] },
      });

      let progressUpdates = 0;
      processor.onProgress(taskId, (progress) => {
        progressUpdates++;
        expect(progress.current).toBeGreaterThanOrEqual(0);
        expect(progress.total).toBeGreaterThan(0);
        expect(progress.percentage).toBeGreaterThanOrEqual(0);
        
        if (progress.percentage === 100) {
          expect(progressUpdates).toBeGreaterThan(1);
          done();
        }
      });

      processor.start();
    });
  });

  describe('Error Handling', () => {
    it('should handle task execution errors', async () => {
      const taskId = processor.addTask({
        type: 'document_indexing',
        priority: 'high',
        data: { documentId: 'invalid-doc', chunks: null }, // Invalid data
      });

      processor.start();

      // Wait for task to fail
      await new Promise(resolve => setTimeout(resolve, 1000));

      const state = processor.getState();
      expect(state.failedTasks).toHaveLength(1);
      expect(state.failedTasks[0].taskId).toBe(taskId);
      expect(state.failedTasks[0].error).toBeInstanceOf(RAGError);
    });

    it('should handle task timeouts', async () => {
      const processor = new BackgroundProcessor({
        maxProcessingTime: 100, // Very short timeout
      });

      const taskId = processor.addTask({
        type: 'document_indexing',
        priority: 'high',
        data: { documentId: 'slow-doc', chunks: new Array(1000).fill('test') },
      });

      processor.start();

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 200));

      const state = processor.getState();
      expect(state.failedTasks).toHaveLength(1);
      expect(state.failedTasks[0].error.code).toBe('TASK_TIMEOUT');

      processor.cleanup();
    });
  });

  describe('Concurrent Processing', () => {
    it('should respect max concurrent tasks limit', () => {
      // Add more tasks than the limit
      for (let i = 0; i < 5; i++) {
        processor.addTask({
          type: 'document_indexing',
          priority: 'medium',
          data: { documentId: `doc-${i}`, chunks: [] },
        });
      }

      processor.start();

      const state = processor.getState();
      expect(state.currentTasks.length).toBeLessThanOrEqual(2); // maxConcurrentTasks = 2
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', () => {
      processor.addTask({
        type: 'document_indexing',
        priority: 'medium',
        data: { documentId: 'test-doc', chunks: [] },
      });

      processor.start();
      processor.cleanup();

      const state = processor.getState();
      expect(state.isRunning).toBe(false);
      expect(state.queuedTasks).toHaveLength(0);
    });
  });
});