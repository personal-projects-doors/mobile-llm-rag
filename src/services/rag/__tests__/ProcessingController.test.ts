import { ProcessingController } from '../ProcessingController';
import { RAGError, RAGErrorCategory } from '../types';

describe('ProcessingController', () => {
  let controller: ProcessingController;

  beforeEach(() => {
    controller = new ProcessingController({
      maxConcurrentTasks: 2,
      enablePersistence: false, // Disable for testing
      maxRetries: 2,
      retryDelay: 100,
    });
  });

  afterEach(async () => {
    await controller.shutdown();
  });

  describe('Task Creation', () => {
    it('should create tasks with unique IDs', () => {
      const taskId1 = controller.createTask('Test Task 1', 'document_processing');
      const taskId2 = controller.createTask('Test Task 2', 'embedding_generation');

      expect(taskId1).toBeDefined();
      expect(taskId2).toBeDefined();
      expect(taskId1).not.toBe(taskId2);

      const task1 = controller.getTask(taskId1);
      const task2 = controller.getTask(taskId2);

      expect(task1?.name).toBe('Test Task 1');
      expect(task1?.type).toBe('document_processing');
      expect(task2?.name).toBe('Test Task 2');
      expect(task2?.type).toBe('embedding_generation');
    });

    it('should initialize tasks with correct default values', () => {
      const taskId = controller.createTask('Test Task', 'indexing', { test: 'data' });
      const task = controller.getTask(taskId);

      expect(task?.status).toBe('pending');
      expect(task?.progress.current).toBe(0);
      expect(task?.progress.total).toBe(100);
      expect(task?.progress.percentage).toBe(0);
      expect(task?.progress.canCancel).toBe(true);
      expect(task?.progress.canPause).toBe(true);
      expect(task?.progress.isPaused).toBe(false);
      expect(task?.metadata).toEqual({ test: 'data' });
    });
  });

  describe('Task Execution', () => {
    it('should execute tasks successfully', async () => {
      const taskId = controller.createTask('Success Task', 'document_processing');
      
      let progressUpdates = 0;
      controller.onProgress(taskId, (progress) => {
        progressUpdates++;
      });

      const result = await controller.executeTask(taskId, async (cancellationToken, pauseToken, progressCallback) => {
        // Simulate work with progress updates
        for (let i = 0; i <= 100; i += 25) {
          cancellationToken.throwIfCancelled();
          await pauseToken.waitIfPaused();
          
          progressCallback({
            current: i,
            total: 100,
            percentage: i,
          });
          
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        return 'success';
      });

      expect(result).toBe('success');
      expect(progressUpdates).toBeGreaterThan(0);

      const task = controller.getTask(taskId);
      expect(task?.status).toBe('completed');
      expect(task?.progress.percentage).toBe(100);
    });

    it('should handle task failures', async () => {
      const taskId = controller.createTask('Failing Task', 'document_processing');

      await expect(
        controller.executeTask(taskId, async () => {
          throw new Error('Task failed');
        })
      ).rejects.toThrow('Task failed');

      const task = controller.getTask(taskId);
      expect(task?.status).toBe('failed');
      expect(task?.error).toBeDefined();
    });

    it('should retry failed tasks', async () => {
      const taskId = controller.createTask('Retry Task', 'document_processing');
      
      let attempts = 0;
      
      const result = await controller.executeTask(taskId, async () => {
        attempts++;
        if (attempts < 3) {
          throw new RAGError(
            'Temporary failure',
            'TEMPORARY_FAILURE',
            RAGErrorCategory.SYSTEM
          );
        }
        return 'success after retries';
      });

      expect(result).toBe('success after retries');
      expect(attempts).toBe(3); // Initial attempt + 2 retries
    });

    it('should not retry non-retryable errors', async () => {
      const taskId = controller.createTask('Non-retryable Task', 'document_processing');
      
      let attempts = 0;
      
      await expect(
        controller.executeTask(taskId, async () => {
          attempts++;
          throw new RAGError(
            'File not found',
            'FILE_NOT_FOUND',
            RAGErrorCategory.DOCUMENT_PROCESSING
          );
        })
      ).rejects.toThrow('File not found');

      expect(attempts).toBe(1); // Should not retry
    });

    it('should respect max concurrent tasks limit', async () => {
      const taskId1 = controller.createTask('Long Task 1', 'document_processing');
      const taskId2 = controller.createTask('Long Task 2', 'document_processing');
      const taskId3 = controller.createTask('Long Task 3', 'document_processing');

      const longRunningExecutor = async (cancellationToken: any) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        cancellationToken.throwIfCancelled();
        return 'completed';
      };

      // Start first two tasks (should reach limit)
      const promise1 = controller.executeTask(taskId1, longRunningExecutor);
      const promise2 = controller.executeTask(taskId2, longRunningExecutor);

      // Third task should be rejected due to limit
      await expect(
        controller.executeTask(taskId3, longRunningExecutor)
      ).rejects.toThrow('Maximum concurrent tasks limit reached');

      // Wait for first two to complete
      await Promise.all([promise1, promise2]);
    });
  });

  describe('Task Cancellation', () => {
    it('should cancel tasks', async () => {
      const taskId = controller.createTask('Cancellable Task', 'document_processing');

      const executionPromise = controller.executeTask(taskId, async (cancellationToken) => {
        // Simulate long-running work
        for (let i = 0; i < 100; i++) {
          cancellationToken.throwIfCancelled();
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        return 'completed';
      });

      // Cancel after a short delay
      setTimeout(() => {
        controller.cancelTask(taskId, 'User requested cancellation');
      }, 50);

      await expect(executionPromise).rejects.toThrow('Task was cancelled');

      const task = controller.getTask(taskId);
      expect(task?.status).toBe('cancelled');
      expect(task?.error?.code).toBe('TASK_CANCELLED');
    });

    it('should cancel all tasks', async () => {
      const taskId1 = controller.createTask('Task 1', 'document_processing');
      const taskId2 = controller.createTask('Task 2', 'embedding_generation');

      const longExecutor = async (cancellationToken: any) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        cancellationToken.throwIfCancelled();
        return 'completed';
      };

      const promise1 = controller.executeTask(taskId1, longExecutor);
      const promise2 = controller.executeTask(taskId2, longExecutor);

      // Cancel all tasks
      setTimeout(() => {
        controller.cancelAllTasks('Shutdown requested');
      }, 50);

      await expect(promise1).rejects.toThrow('Task was cancelled');
      await expect(promise2).rejects.toThrow('Task was cancelled');

      const task1 = controller.getTask(taskId1);
      const task2 = controller.getTask(taskId2);
      
      expect(task1?.status).toBe('cancelled');
      expect(task2?.status).toBe('cancelled');
    });
  });

  describe('Task Pausing and Resuming', () => {
    it('should pause and resume tasks', async () => {
      const taskId = controller.createTask('Pausable Task', 'document_processing');
      
      let workDone = 0;
      let pauseDetected = false;

      const executionPromise = controller.executeTask(taskId, async (cancellationToken, pauseToken, progressCallback) => {
        for (let i = 0; i < 10; i++) {
          cancellationToken.throwIfCancelled();
          
          if (pauseToken.isPaused) {
            pauseDetected = true;
          }
          
          await pauseToken.waitIfPaused();
          
          workDone++;
          progressCallback({ current: i + 1, total: 10 });
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        return 'completed';
      });

      // Pause after a short delay
      setTimeout(() => {
        controller.pauseTask(taskId);
      }, 50);

      // Resume after pause
      setTimeout(() => {
        controller.resumeTask(taskId);
      }, 150);

      const result = await executionPromise;
      
      expect(result).toBe('completed');
      expect(workDone).toBe(10);
      expect(pauseDetected).toBe(true);

      const task = controller.getTask(taskId);
      expect(task?.status).toBe('completed');
    });

    it('should pause and resume all tasks', async () => {
      const taskId1 = controller.createTask('Task 1', 'document_processing');
      const taskId2 = controller.createTask('Task 2', 'embedding_generation');

      let task1Paused = false;
      let task2Paused = false;

      const pausableExecutor = (taskNum: number) => async (cancellationToken: any, pauseToken: any) => {
        for (let i = 0; i < 10; i++) {
          cancellationToken.throwIfCancelled();
          
          if (pauseToken.isPaused) {
            if (taskNum === 1) task1Paused = true;
            if (taskNum === 2) task2Paused = true;
          }
          
          await pauseToken.waitIfPaused();
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        return `task${taskNum}-completed`;
      };

      const promise1 = controller.executeTask(taskId1, pausableExecutor(1));
      const promise2 = controller.executeTask(taskId2, pausableExecutor(2));

      // Pause all tasks
      setTimeout(() => {
        controller.pauseAllTasks();
      }, 50);

      // Resume all tasks
      setTimeout(() => {
        controller.resumeAllTasks();
      }, 150);

      const results = await Promise.all([promise1, promise2]);
      
      expect(results).toEqual(['task1-completed', 'task2-completed']);
      expect(task1Paused).toBe(true);
      expect(task2Paused).toBe(true);
    });
  });

  describe('Task Management', () => {
    it('should get tasks by status', () => {
      const taskId1 = controller.createTask('Pending Task', 'document_processing');
      const taskId2 = controller.createTask('Another Pending Task', 'embedding_generation');

      const pendingTasks = controller.getTasksByStatus('pending');
      expect(pendingTasks).toHaveLength(2);
      expect(pendingTasks.map(t => t.id)).toContain(taskId1);
      expect(pendingTasks.map(t => t.id)).toContain(taskId2);

      const runningTasks = controller.getTasksByStatus('running');
      expect(runningTasks).toHaveLength(0);
    });

    it('should remove completed tasks', async () => {
      const taskId = controller.createTask('Removable Task', 'document_processing');

      await controller.executeTask(taskId, async () => 'completed');

      const removed = controller.removeTask(taskId);
      expect(removed).toBe(true);

      const task = controller.getTask(taskId);
      expect(task).toBeNull();
    });

    it('should not remove running tasks', async () => {
      const taskId = controller.createTask('Running Task', 'document_processing');

      const executionPromise = controller.executeTask(taskId, async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'completed';
      });

      // Try to remove while running
      const removed = controller.removeTask(taskId);
      expect(removed).toBe(false);

      await executionPromise;
    });

    it('should clear completed tasks', async () => {
      const taskId1 = controller.createTask('Task 1', 'document_processing');
      const taskId2 = controller.createTask('Task 2', 'embedding_generation');
      const taskId3 = controller.createTask('Task 3', 'indexing');

      // Complete first two tasks
      await controller.executeTask(taskId1, async () => 'completed');
      await controller.executeTask(taskId2, async () => 'completed');

      // Fail third task
      try {
        await controller.executeTask(taskId3, async () => {
          throw new Error('Failed');
        });
      } catch (error) {
        // Expected to fail
      }

      const clearedCount = controller.clearCompletedTasks();
      expect(clearedCount).toBe(3); // 2 completed + 1 failed

      const allTasks = controller.getAllTasks();
      expect(allTasks).toHaveLength(0);
    });
  });

  describe('Statistics', () => {
    it('should provide task statistics', async () => {
      const taskId1 = controller.createTask('Task 1', 'document_processing');
      const taskId2 = controller.createTask('Task 2', 'embedding_generation');
      const taskId3 = controller.createTask('Task 3', 'indexing');

      let stats = controller.getStatistics();
      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(3);
      expect(stats.running).toBe(0);
      expect(stats.completed).toBe(0);

      // Complete one task
      await controller.executeTask(taskId1, async () => 'completed');

      // Fail one task
      try {
        await controller.executeTask(taskId2, async () => {
          throw new Error('Failed');
        });
      } catch (error) {
        // Expected to fail
      }

      stats = controller.getStatistics();
      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
    });
  });

  describe('Progress Callbacks', () => {
    it('should handle progress callbacks', async () => {
      const taskId = controller.createTask('Progress Task', 'document_processing');
      
      const progressUpdates: any[] = [];
      controller.onProgress(taskId, (progress) => {
        progressUpdates.push({ ...progress });
      });

      await controller.executeTask(taskId, async (cancellationToken, pauseToken, progressCallback) => {
        for (let i = 0; i <= 100; i += 20) {
          progressCallback({
            current: i,
            total: 100,
            percentage: i,
            currentItem: `Step ${i}`,
          });
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        return 'completed';
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].current).toBe(0);
      expect(progressUpdates[progressUpdates.length - 1].current).toBe(100);
    });

    it('should remove progress callbacks', () => {
      const taskId = controller.createTask('Callback Task', 'document_processing');
      
      const callback = jest.fn();
      controller.onProgress(taskId, callback);
      controller.removeProgressCallback(taskId);

      // Callback should not be called after removal
      const task = controller.getTask(taskId);
      expect(task).toBeDefined();
    });
  });
});