import { AppState, AppStateStatus } from 'react-native';
import { RAGError, RAGErrorCategory, ProcessingProgress, PartialProcessingResult } from './types';

export interface BackgroundTask {
  id: string;
  type: 'document_indexing' | 'embedding_generation' | 'similarity_indexing';
  priority: 'low' | 'medium' | 'high';
  data: any;
  createdAt: Date;
  estimatedDuration?: number;
}

export interface BackgroundProcessorConfig {
  maxConcurrentTasks: number;
  pauseOnBackground: boolean;
  lowMemoryThreshold: number; // MB
  maxProcessingTime: number; // milliseconds
  enableProgressTracking: boolean;
}

export interface ProcessorState {
  isRunning: boolean;
  isPaused: boolean;
  currentTasks: BackgroundTask[];
  queuedTasks: BackgroundTask[];
  completedTasks: string[];
  failedTasks: Array<{ taskId: string; error: RAGError }>;
  totalMemoryUsage: number;
  lastProcessingTime: Date | null;
}

export class BackgroundProcessor {
  private config: BackgroundProcessorConfig;
  private state: ProcessorState;
  private taskQueue: BackgroundTask[] = [];
  private activeTasks: Map<string, Promise<void>> = new Map();
  private progressCallbacks: Map<string, (progress: ProcessingProgress) => void> = new Map();
  private cancellationTokens: Map<string, boolean> = new Map();
  private appStateSubscription: any;
  private memoryCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<BackgroundProcessorConfig> = {}) {
    this.config = {
      maxConcurrentTasks: 2,
      pauseOnBackground: true,
      lowMemoryThreshold: 100, // 100MB
      maxProcessingTime: 300000, // 5 minutes
      enableProgressTracking: true,
      ...config,
    };

    this.state = {
      isRunning: false,
      isPaused: false,
      currentTasks: [],
      queuedTasks: [],
      completedTasks: [],
      failedTasks: [],
      totalMemoryUsage: 0,
      lastProcessingTime: null,
    };

    this.setupAppStateHandling();
    this.startMemoryMonitoring();
  }

  private setupAppStateHandling(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (this.config.pauseOnBackground) {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        this.pause();
      } else if (nextAppState === 'active') {
        this.resume();
      }
    }
  }

  private startMemoryMonitoring(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }

    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 5000); // Check every 5 seconds
  }

  private async checkMemoryUsage(): Promise<void> {
    try {
      // Estimate memory usage (this would need platform-specific implementation)
      const memoryUsage = await this.estimateMemoryUsage();
      this.state.totalMemoryUsage = memoryUsage;

      if (memoryUsage > this.config.lowMemoryThreshold) {
        console.warn(`High memory usage detected: ${memoryUsage}MB`);
        
        // Pause processing if memory is too high
        if (memoryUsage > this.config.lowMemoryThreshold * 1.5) {
          this.pause();
          
          // Trigger garbage collection if possible
          if (global.gc) {
            global.gc();
          }
        }
      }
    } catch (error) {
      console.error('Memory check failed:', error);
    }
  }

  private async estimateMemoryUsage(): Promise<number> {
    // This is a simplified estimation - in a real implementation,
    // you'd use platform-specific memory monitoring
    const taskMemoryEstimate = this.activeTasks.size * 20; // 20MB per active task
    const queueMemoryEstimate = this.taskQueue.length * 5; // 5MB per queued task
    
    return taskMemoryEstimate + queueMemoryEstimate;
  }

  public addTask(task: Omit<BackgroundTask, 'id' | 'createdAt'>): string {
    const fullTask: BackgroundTask = {
      ...task,
      id: this.generateTaskId(),
      createdAt: new Date(),
    };

    // Insert task based on priority
    const insertIndex = this.findInsertionIndex(fullTask);
    this.taskQueue.splice(insertIndex, 0, fullTask);
    this.state.queuedTasks = [...this.taskQueue];

    // Start processing if not already running
    if (!this.state.isRunning && !this.state.isPaused) {
      this.start();
    }

    return fullTask.id;
  }

  private findInsertionIndex(task: BackgroundTask): number {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const taskPriority = priorityOrder[task.priority];

    for (let i = 0; i < this.taskQueue.length; i++) {
      const queuedTaskPriority = priorityOrder[this.taskQueue[i].priority];
      if (taskPriority < queuedTaskPriority) {
        return i;
      }
    }

    return this.taskQueue.length;
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public start(): void {
    if (this.state.isRunning) return;

    this.state.isRunning = true;
    this.state.isPaused = false;
    this.processQueue();
  }

  public pause(): void {
    this.state.isPaused = true;
    
    // Set cancellation tokens for all active tasks
    this.activeTasks.forEach((_, taskId) => {
      this.cancellationTokens.set(taskId, true);
    });
  }

  public resume(): void {
    if (!this.state.isRunning) return;

    this.state.isPaused = false;
    
    // Clear cancellation tokens
    this.cancellationTokens.clear();
    
    // Resume processing
    this.processQueue();
  }

  public stop(): void {
    this.state.isRunning = false;
    this.state.isPaused = false;

    // Cancel all active tasks
    this.activeTasks.forEach((_, taskId) => {
      this.cancellationTokens.set(taskId, true);
    });

    // Clear the queue
    this.taskQueue = [];
    this.state.queuedTasks = [];
  }

  public cancelTask(taskId: string): boolean {
    // Remove from queue if not started
    const queueIndex = this.taskQueue.findIndex(task => task.id === taskId);
    if (queueIndex !== -1) {
      this.taskQueue.splice(queueIndex, 1);
      this.state.queuedTasks = [...this.taskQueue];
      return true;
    }

    // Cancel if currently running
    if (this.activeTasks.has(taskId)) {
      this.cancellationTokens.set(taskId, true);
      return true;
    }

    return false;
  }

  public getTaskProgress(taskId: string): ProcessingProgress | null {
    // This would be implemented based on the specific task type
    // For now, return a basic progress structure
    if (this.activeTasks.has(taskId)) {
      return {
        current: 0,
        total: 100,
        percentage: 0,
        canCancel: true,
        canPause: true,
        isPaused: this.state.isPaused,
      };
    }
    return null;
  }

  public onProgress(taskId: string, callback: (progress: ProcessingProgress) => void): void {
    this.progressCallbacks.set(taskId, callback);
  }

  private async processQueue(): Promise<void> {
    while (
      this.state.isRunning &&
      !this.state.isPaused &&
      this.taskQueue.length > 0 &&
      this.activeTasks.size < this.config.maxConcurrentTasks
    ) {
      const task = this.taskQueue.shift();
      if (!task) break;

      this.state.queuedTasks = [...this.taskQueue];
      this.state.currentTasks.push(task);

      const taskPromise = this.executeTask(task);
      this.activeTasks.set(task.id, taskPromise);

      // Don't await here to allow concurrent processing
      taskPromise
        .then(() => this.onTaskComplete(task.id))
        .catch((error) => this.onTaskError(task.id, error))
        .finally(() => {
          this.activeTasks.delete(task.id);
          this.state.currentTasks = this.state.currentTasks.filter(t => t.id !== task.id);
          
          // Continue processing queue
          if (this.state.isRunning && !this.state.isPaused) {
            this.processQueue();
          }
        });
    }
  }

  private async executeTask(task: BackgroundTask): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Check for cancellation before starting
      if (this.cancellationTokens.get(task.id)) {
        throw new RAGError(
          'Task was cancelled',
          'TASK_CANCELLED',
          RAGErrorCategory.SYSTEM,
          { operation: 'background_processing', additionalInfo: { taskId: task.id } }
        );
      }

      // Set timeout for the task
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new RAGError(
            'Task timeout exceeded',
            'TASK_TIMEOUT',
            RAGErrorCategory.SYSTEM,
            { operation: 'background_processing', additionalInfo: { taskId: task.id } }
          ));
        }, this.config.maxProcessingTime);
      });

      // Execute the actual task with timeout
      await Promise.race([
        this.executeTaskByType(task),
        timeoutPromise,
      ]);

      this.state.lastProcessingTime = new Date();
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`Task ${task.id} failed after ${processingTime}ms:`, error);
      throw error;
    }
  }

  private async executeTaskByType(task: BackgroundTask): Promise<void> {
    switch (task.type) {
      case 'document_indexing':
        await this.executeDocumentIndexing(task);
        break;
      case 'embedding_generation':
        await this.executeEmbeddingGeneration(task);
        break;
      case 'similarity_indexing':
        await this.executeSimilarityIndexing(task);
        break;
      default:
        throw new RAGError(
          `Unknown task type: ${task.type}`,
          'UNKNOWN_TASK_TYPE',
          RAGErrorCategory.SYSTEM,
          { operation: 'background_processing', additionalInfo: { taskId: task.id } }
        );
    }
  }

  private async executeDocumentIndexing(task: BackgroundTask): Promise<void> {
    // This would integrate with the existing document processing pipeline
    // For now, simulate the work
    const { documentId, chunks } = task.data;
    
    if (!chunks || !Array.isArray(chunks)) {
      throw new RAGError(
        'Invalid chunks data for document indexing',
        'INVALID_CHUNKS_DATA',
        RAGErrorCategory.DOCUMENT_PROCESSING,
        { operation: 'document_indexing', documentId }
      );
    }
    
    for (let i = 0; i < chunks.length; i++) {
      // Check for cancellation
      if (this.cancellationTokens.get(task.id)) {
        throw new RAGError(
          'Document indexing cancelled',
          'TASK_CANCELLED',
          RAGErrorCategory.SYSTEM,
          { operation: 'document_indexing', documentId }
        );
      }

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update progress
      const progress: ProcessingProgress = {
        current: i + 1,
        total: chunks.length,
        percentage: ((i + 1) / chunks.length) * 100,
        currentItem: `Chunk ${i + 1}`,
        canCancel: true,
        canPause: true,
        isPaused: this.state.isPaused,
      };

      const callback = this.progressCallbacks.get(task.id);
      if (callback) {
        callback(progress);
      }
    }
  }

  private async executeEmbeddingGeneration(task: BackgroundTask): Promise<void> {
    // This would integrate with the EmbeddingGenerator
    const { chunks, modelId } = task.data;
    
    if (!chunks || !Array.isArray(chunks)) {
      throw new RAGError(
        'Invalid chunks data for embedding generation',
        'INVALID_CHUNKS_DATA',
        RAGErrorCategory.EMBEDDING_GENERATION,
        { operation: 'embedding_generation' }
      );
    }
    
    for (let i = 0; i < chunks.length; i++) {
      if (this.cancellationTokens.get(task.id)) {
        throw new RAGError(
          'Embedding generation cancelled',
          'TASK_CANCELLED',
          RAGErrorCategory.EMBEDDING_GENERATION,
          { operation: 'embedding_generation' }
        );
      }

      // Simulate embedding generation
      await new Promise(resolve => setTimeout(resolve, 200));

      const progress: ProcessingProgress = {
        current: i + 1,
        total: chunks.length,
        percentage: ((i + 1) / chunks.length) * 100,
        currentItem: `Embedding ${i + 1}`,
        canCancel: true,
        canPause: true,
        isPaused: this.state.isPaused,
      };

      const callback = this.progressCallbacks.get(task.id);
      if (callback) {
        callback(progress);
      }
    }
  }

  private async executeSimilarityIndexing(task: BackgroundTask): Promise<void> {
    // This would integrate with database indexing
    const { embeddings } = task.data;
    
    // Simulate indexing work
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private onTaskComplete(taskId: string): void {
    this.state.completedTasks.push(taskId);
    this.progressCallbacks.delete(taskId);
    this.cancellationTokens.delete(taskId);
    
    console.log(`Task ${taskId} completed successfully`);
  }

  private onTaskError(taskId: string, error: Error): void {
    const ragError = error instanceof RAGError ? error : new RAGError(
      error.message,
      'TASK_EXECUTION_FAILED',
      RAGErrorCategory.SYSTEM,
      { operation: 'background_processing', additionalInfo: { taskId } },
      error
    );

    this.state.failedTasks.push({ taskId, error: ragError });
    this.progressCallbacks.delete(taskId);
    this.cancellationTokens.delete(taskId);
    
    console.error(`Task ${taskId} failed:`, ragError);
  }

  public getState(): ProcessorState {
    return { ...this.state };
  }

  public cleanup(): void {
    this.stop();
    
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }
    
    this.progressCallbacks.clear();
    this.cancellationTokens.clear();
  }
}