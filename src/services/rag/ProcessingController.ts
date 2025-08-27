import { RAGError, RAGErrorCategory, ProcessingProgress } from './types';

export interface ProcessingTask {
  id: string;
  name: string;
  type: 'document_processing' | 'embedding_generation' | 'indexing' | 'search';
  status: 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
  progress: ProcessingProgress;
  startTime?: Date;
  endTime?: Date;
  error?: RAGError;
  metadata?: any;
}

export interface ProcessingControllerConfig {
  maxConcurrentTasks: number;
  enablePersistence: boolean;
  autoSaveInterval: number; // milliseconds
  maxRetries: number;
  retryDelay: number; // milliseconds
}

export interface CancellationToken {
  isCancelled: boolean;
  reason?: string;
  cancel(reason?: string): void;
  throwIfCancelled(): void;
}

export interface PauseToken {
  isPaused: boolean;
  pause(): void;
  resume(): void;
  waitIfPaused(): Promise<void>;
}

export class ProcessingController {
  private config: ProcessingControllerConfig;
  private tasks: Map<string, ProcessingTask> = new Map();
  private cancellationTokens: Map<string, CancellationToken> = new Map();
  private pauseTokens: Map<string, PauseToken> = new Map();
  private progressCallbacks: Map<string, (progress: ProcessingProgress) => void> = new Map();
  private taskExecutors: Map<string, Promise<void>> = new Map();
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private isShuttingDown: boolean = false;

  constructor(config: Partial<ProcessingControllerConfig> = {}) {
    this.config = {
      maxConcurrentTasks: 3,
      enablePersistence: true,
      autoSaveInterval: 5000, // 5 seconds
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      ...config,
    };

    if (this.config.enablePersistence) {
      this.startAutoSave();
    }
  }

  private startAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    this.autoSaveInterval = setInterval(() => {
      this.saveState();
    }, this.config.autoSaveInterval);
  }

  private async saveState(): Promise<void> {
    try {
      // In a real implementation, this would save to persistent storage
      const state = {
        tasks: Array.from(this.tasks.entries()),
        timestamp: new Date().toISOString(),
      };
      
      // For now, just log the state
      console.log('Saving processing state:', state.tasks.length, 'tasks');
    } catch (error) {
      console.error('Failed to save processing state:', error);
    }
  }

  private async loadState(): Promise<void> {
    try {
      // In a real implementation, this would load from persistent storage
      // For now, just initialize empty state
      console.log('Loading processing state...');
    } catch (error) {
      console.error('Failed to load processing state:', error);
    }
  }

  public createTask(
    name: string,
    type: ProcessingTask['type'],
    metadata?: any
  ): string {
    const taskId = this.generateTaskId();
    
    const task: ProcessingTask = {
      id: taskId,
      name,
      type,
      status: 'pending',
      progress: {
        current: 0,
        total: 100,
        percentage: 0,
        canCancel: true,
        canPause: true,
        isPaused: false,
      },
      metadata,
    };

    this.tasks.set(taskId, task);
    this.createCancellationToken(taskId);
    this.createPauseToken(taskId);

    return taskId;
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createCancellationToken(taskId: string): CancellationToken {
    const token: CancellationToken = {
      isCancelled: false,
      reason: undefined,
      cancel: (reason?: string) => {
        token.isCancelled = true;
        token.reason = reason;
        this.handleTaskCancellation(taskId, reason);
      },
      throwIfCancelled: () => {
        if (token.isCancelled) {
          throw new RAGError(
            `Task was cancelled: ${token.reason || 'No reason provided'}`,
            'TASK_CANCELLED',
            RAGErrorCategory.SYSTEM,
            { operation: 'task_execution', additionalInfo: { taskId } }
          );
        }
      },
    };

    this.cancellationTokens.set(taskId, token);
    return token;
  }

  private createPauseToken(taskId: string): PauseToken {
    const token: PauseToken = {
      isPaused: false,
      pause: () => {
        token.isPaused = true;
        this.handleTaskPause(taskId);
      },
      resume: () => {
        token.isPaused = false;
        this.handleTaskResume(taskId);
      },
      waitIfPaused: async () => {
        while (token.isPaused && !this.cancellationTokens.get(taskId)?.isCancelled) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      },
    };

    this.pauseTokens.set(taskId, token);
    return token;
  }

  public async executeTask<T>(
    taskId: string,
    executor: (
      cancellationToken: CancellationToken,
      pauseToken: PauseToken,
      progressCallback: (progress: Partial<ProcessingProgress>) => void
    ) => Promise<T>
  ): Promise<T> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new RAGError(
        `Task ${taskId} not found`,
        'TASK_NOT_FOUND',
        RAGErrorCategory.SYSTEM,
        { operation: 'execute_task', additionalInfo: { taskId } }
      );
    }

    if (task.status !== 'pending') {
      throw new RAGError(
        `Task ${taskId} is not in pending state`,
        'INVALID_TASK_STATE',
        RAGErrorCategory.SYSTEM,
        { operation: 'execute_task', additionalInfo: { taskId, currentStatus: task.status } }
      );
    }

    // Check if we can start more tasks
    const runningTasks = Array.from(this.tasks.values()).filter(t => t.status === 'running');
    if (runningTasks.length >= this.config.maxConcurrentTasks) {
      throw new RAGError(
        'Maximum concurrent tasks limit reached',
        'MAX_CONCURRENT_TASKS_REACHED',
        RAGErrorCategory.SYSTEM,
        { operation: 'execute_task', additionalInfo: { maxTasks: this.config.maxConcurrentTasks } }
      );
    }

    const cancellationToken = this.cancellationTokens.get(taskId)!;
    const pauseToken = this.pauseTokens.get(taskId)!;

    // Progress callback
    const progressCallback = (progress: Partial<ProcessingProgress>) => {
      this.updateTaskProgress(taskId, progress);
    };

    // Start task execution
    task.status = 'running';
    task.startTime = new Date();
    
    const executionPromise = this.executeWithRetry(
      taskId,
      executor,
      cancellationToken,
      pauseToken,
      progressCallback
    );
    
    this.taskExecutors.set(taskId, executionPromise.then(() => {}).catch(() => {}));

    try {
      const result = await executionPromise;
      
      task.status = 'completed';
      task.endTime = new Date();
      task.progress.percentage = 100;
      task.progress.current = task.progress.total;

      return result;

    } catch (error) {
      task.status = cancellationToken.isCancelled ? 'cancelled' : 'failed';
      task.endTime = new Date();
      task.error = error instanceof RAGError ? error : new RAGError(
        error instanceof Error ? error.message : String(error),
        'TASK_EXECUTION_FAILED',
        RAGErrorCategory.SYSTEM,
        { operation: 'execute_task', additionalInfo: { taskId } },
        error instanceof Error ? error : undefined
      );

      throw task.error;

    } finally {
      this.taskExecutors.delete(taskId);
    }
  }

  private async executeWithRetry<T>(
    taskId: string,
    executor: (
      cancellationToken: CancellationToken,
      pauseToken: PauseToken,
      progressCallback: (progress: Partial<ProcessingProgress>) => void
    ) => Promise<T>,
    cancellationToken: CancellationToken,
    pauseToken: PauseToken,
    progressCallback: (progress: Partial<ProcessingProgress>) => void
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Check for cancellation before each attempt
        cancellationToken.throwIfCancelled();
        
        // Wait if paused
        await pauseToken.waitIfPaused();
        
        return await executor(cancellationToken, pauseToken, progressCallback);
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry if cancelled or if it's the last attempt
        if (cancellationToken.isCancelled || attempt === this.config.maxRetries) {
          throw lastError;
        }
        
        // Don't retry certain types of errors
        if (error instanceof RAGError && !this.shouldRetry(error)) {
          throw error;
        }
        
        console.warn(`Task ${taskId} attempt ${attempt} failed, retrying...`, lastError.message);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
      }
    }
    
    throw lastError;
  }

  private shouldRetry(error: RAGError): boolean {
    // Don't retry certain error types
    const nonRetryableCodes = [
      'TASK_CANCELLED',
      'FILE_NOT_FOUND',
      'INVALID_CONFIG',
      'CORRUPTED_FILE',
    ];
    
    // Retry temporary failures and other retryable errors
    const retryableCodes = [
      'TEMPORARY_FAILURE',
      'TIMEOUT',
      'MEMORY_ERROR',
      'DATABASE_ERROR',
    ];
    
    return retryableCodes.includes(error.code) || !nonRetryableCodes.includes(error.code);
  }

  private updateTaskProgress(taskId: string, progress: Partial<ProcessingProgress>): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    // Update task progress
    Object.assign(task.progress, progress);
    
    // Calculate percentage if not provided
    if (progress.current !== undefined && progress.total !== undefined) {
      task.progress.percentage = (progress.current / progress.total) * 100;
    }

    // Notify progress callback
    const callback = this.progressCallbacks.get(taskId);
    if (callback) {
      callback(task.progress);
    }
  }

  private handleTaskCancellation(taskId: string, reason?: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    if (task.status === 'running') {
      task.status = 'cancelled';
      task.endTime = new Date();
      task.error = new RAGError(
        `Task cancelled: ${reason || 'No reason provided'}`,
        'TASK_CANCELLED',
        RAGErrorCategory.SYSTEM,
        { operation: 'task_cancellation', additionalInfo: { taskId, reason } }
      );
    }
  }

  private handleTaskPause(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    if (task.status === 'running') {
      task.status = 'paused';
      task.progress.isPaused = true;
    }
  }

  private handleTaskResume(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    if (task.status === 'paused') {
      task.status = 'running';
      task.progress.isPaused = false;
    }
  }

  // Public API methods
  public cancelTask(taskId: string, reason?: string): boolean {
    const cancellationToken = this.cancellationTokens.get(taskId);
    if (cancellationToken) {
      cancellationToken.cancel(reason);
      return true;
    }
    return false;
  }

  public pauseTask(taskId: string): boolean {
    const pauseToken = this.pauseTokens.get(taskId);
    if (pauseToken) {
      pauseToken.pause();
      return true;
    }
    return false;
  }

  public resumeTask(taskId: string): boolean {
    const pauseToken = this.pauseTokens.get(taskId);
    if (pauseToken) {
      pauseToken.resume();
      return true;
    }
    return false;
  }

  public getTask(taskId: string): ProcessingTask | null {
    return this.tasks.get(taskId) || null;
  }

  public getAllTasks(): ProcessingTask[] {
    return Array.from(this.tasks.values());
  }

  public getTasksByStatus(status: ProcessingTask['status']): ProcessingTask[] {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  public getRunningTasks(): ProcessingTask[] {
    return this.getTasksByStatus('running');
  }

  public onProgress(taskId: string, callback: (progress: ProcessingProgress) => void): void {
    this.progressCallbacks.set(taskId, callback);
  }

  public removeProgressCallback(taskId: string): void {
    this.progressCallbacks.delete(taskId);
  }

  public async cancelAllTasks(reason?: string): Promise<void> {
    const runningTasks = this.getTasksByStatus('running');
    const pausedTasks = this.getTasksByStatus('paused');
    
    const tasksToCancel = [...runningTasks, ...pausedTasks];
    
    for (const task of tasksToCancel) {
      this.cancelTask(task.id, reason);
    }
    
    // Wait for all tasks to complete cancellation
    const executionPromises = Array.from(this.taskExecutors.values());
    await Promise.allSettled(executionPromises);
  }

  public async pauseAllTasks(): Promise<void> {
    const runningTasks = this.getTasksByStatus('running');
    
    for (const task of runningTasks) {
      this.pauseTask(task.id);
    }
  }

  public async resumeAllTasks(): Promise<void> {
    const pausedTasks = this.getTasksByStatus('paused');
    
    for (const task of pausedTasks) {
      this.resumeTask(task.id);
    }
  }

  public removeTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // Can only remove completed, cancelled, or failed tasks
    if (['completed', 'cancelled', 'failed'].includes(task.status)) {
      this.tasks.delete(taskId);
      this.cancellationTokens.delete(taskId);
      this.pauseTokens.delete(taskId);
      this.progressCallbacks.delete(taskId);
      return true;
    }
    
    return false;
  }

  public clearCompletedTasks(): number {
    const completedTasks = this.getTasksByStatus('completed');
    const cancelledTasks = this.getTasksByStatus('cancelled');
    const failedTasks = this.getTasksByStatus('failed');
    
    const tasksToRemove = [...completedTasks, ...cancelledTasks, ...failedTasks];
    
    for (const task of tasksToRemove) {
      this.removeTask(task.id);
    }
    
    return tasksToRemove.length;
  }

  public getStatistics(): {
    total: number;
    pending: number;
    running: number;
    paused: number;
    completed: number;
    cancelled: number;
    failed: number;
  } {
    const tasks = Array.from(this.tasks.values());
    
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      running: tasks.filter(t => t.status === 'running').length,
      paused: tasks.filter(t => t.status === 'paused').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length,
      failed: tasks.filter(t => t.status === 'failed').length,
    };
  }

  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    
    try {
      // Cancel all running tasks
      await this.cancelAllTasks('System shutdown');
      
      // Save final state
      if (this.config.enablePersistence) {
        await this.saveState();
      }
      
      // Clear intervals
      if (this.autoSaveInterval) {
        clearInterval(this.autoSaveInterval);
      }
      
      // Clear all data
      this.tasks.clear();
      this.cancellationTokens.clear();
      this.pauseTokens.clear();
      this.progressCallbacks.clear();
      this.taskExecutors.clear();
      
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }
}