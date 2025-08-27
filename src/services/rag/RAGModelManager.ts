import {makeAutoObservable, runInAction} from 'mobx';
import {Model, ModelOrigin} from '../../utils/types';
import {modelStore} from '../../store';
import {EmbeddingGenerator} from './EmbeddingGenerator';
import {RAGError, RAGErrorCategory, EmbeddingErrorCodes} from './types';

export interface RAGModelConfig {
  embeddingModelId: string;
  chatModelId?: string;
  autoLoadEmbeddingModel: boolean;
  concurrentModelUsage: boolean;
}

export interface ModelCompatibilityResult {
  isCompatible: boolean;
  reason?: string;
  recommendations?: string[];
}

export class RAGModelManager {
  // Current configuration
  config: RAGModelConfig = {
    embeddingModelId: 'unsloth/medgemma-4b-it-GGUF/medgemma-4b-it-IQ4_NL.gguf',
    autoLoadEmbeddingModel: true,
    concurrentModelUsage: true,
  };

  // Model states
  embeddingModel: Model | null = null;
  chatModel: Model | null = null;
  embeddingGenerator: EmbeddingGenerator | null = null;
  
  // Loading states
  isLoadingEmbeddingModel = false;
  isEmbeddingModelLoaded = false;
  isConcurrentModeActive = false;
  
  // Error states
  lastError: RAGError | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Initialize the RAG model manager
   */
  async initialize(): Promise<void> {
    try {
      // Find the embedding model
      const embeddingModel = this.findEmbeddingModel();
      if (!embeddingModel) {
        throw new RAGError(
          'MedGemma embedding model not found in model list',
          EmbeddingErrorCodes.MODEL_NOT_LOADED,
          RAGErrorCategory.MODEL_MANAGEMENT,
          {operation: 'initialize'}
        );
      }

      runInAction(() => {
        this.embeddingModel = embeddingModel;
      });

      // Auto-load embedding model if configured
      if (this.config.autoLoadEmbeddingModel) {
        await this.loadEmbeddingModel();
      }
    } catch (error) {
      const ragError = error instanceof RAGError 
        ? error 
        : new RAGError(
            'Failed to initialize RAG model manager',
            EmbeddingErrorCodes.MODEL_LOADING_FAILED,
            RAGErrorCategory.MODEL_MANAGEMENT,
            {operation: 'initialize'},
            error instanceof Error ? error : undefined
          );
      
      runInAction(() => {
        this.lastError = ragError;
      });
      
      throw ragError;
    }
  }

  /**
   * Find the MedGemma embedding model in the model store
   */
  private findEmbeddingModel(): Model | null {
    return modelStore.models.find(
      model => model.id === this.config.embeddingModelId
    ) || null;
  }

  /**
   * Check if the MedGemma model is available and downloaded
   */
  isEmbeddingModelAvailable(): boolean {
    const model = this.findEmbeddingModel();
    return model ? model.isDownloaded : false;
  }

  /**
   * Download the MedGemma model if not already downloaded
   */
  async downloadEmbeddingModel(): Promise<void> {
    const model = this.findEmbeddingModel();
    if (!model) {
      throw new RAGError(
        'MedGemma embedding model not found',
        EmbeddingErrorCodes.MODEL_NOT_LOADED,
        RAGErrorCategory.MODEL_MANAGEMENT,
        {operation: 'download'}
      );
    }

    if (model.isDownloaded) {
      return; // Already downloaded
    }

    try {
      await modelStore.checkSpaceAndDownload(model.id);
    } catch (error) {
      throw new RAGError(
        'Failed to download MedGemma embedding model',
        EmbeddingErrorCodes.MODEL_LOADING_FAILED,
        RAGErrorCategory.MODEL_MANAGEMENT,
        {operation: 'download'},
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Load the embedding model for RAG operations
   */
  async loadEmbeddingModel(): Promise<void> {
    if (this.isEmbeddingModelLoaded && this.embeddingGenerator) {
      return; // Already loaded
    }

    const model = this.findEmbeddingModel();
    if (!model) {
      throw new RAGError(
        'MedGemma embedding model not found',
        EmbeddingErrorCodes.MODEL_NOT_LOADED,
        RAGErrorCategory.MODEL_MANAGEMENT,
        {operation: 'load'}
      );
    }

    if (!model.isDownloaded) {
      await this.downloadEmbeddingModel();
    }

    runInAction(() => {
      this.isLoadingEmbeddingModel = true;
      this.lastError = null;
    });

    try {
      // Create embedding generator
      this.embeddingGenerator = new EmbeddingGenerator({
        model,
        config: {
          batchSize: 5, // Smaller batch size for mobile devices
          maxTokens: 512,
          normalize: true,
        },
        onError: (error) => {
          runInAction(() => {
            this.lastError = new RAGError(
              error.message,
              error.code,
              RAGErrorCategory.EMBEDDING_GENERATION,
              {operation: 'embedding_generation', chunkId: error.chunkId},
              error
            );
          });
        },
      });

      // Initialize the embedding generator
      await this.embeddingGenerator.initialize();

      runInAction(() => {
        this.isEmbeddingModelLoaded = true;
        this.embeddingModel = model;
      });
    } catch (error) {
      const ragError = error instanceof RAGError 
        ? error 
        : new RAGError(
            'Failed to load MedGemma embedding model',
            EmbeddingErrorCodes.MODEL_LOADING_FAILED,
            RAGErrorCategory.MODEL_MANAGEMENT,
            {operation: 'load'},
            error instanceof Error ? error : undefined
          );
      
      runInAction(() => {
        this.lastError = ragError;
      });
      
      throw ragError;
    } finally {
      runInAction(() => {
        this.isLoadingEmbeddingModel = false;
      });
    }
  }

  /**
   * Enable concurrent model usage (RAG + chat models)
   */
  async enableConcurrentMode(chatModelId: string): Promise<void> {
    if (!this.isEmbeddingModelLoaded) {
      await this.loadEmbeddingModel();
    }

    const chatModel = modelStore.models.find(m => m.id === chatModelId);
    if (!chatModel) {
      throw new RAGError(
        `Chat model ${chatModelId} not found`,
        EmbeddingErrorCodes.MODEL_NOT_LOADED,
        RAGErrorCategory.MODEL_MANAGEMENT,
        {operation: 'enable_concurrent_mode'}
      );
    }

    // Check compatibility
    const compatibility = this.checkModelCompatibility(chatModel);
    if (!compatibility.isCompatible) {
      throw new RAGError(
        `Chat model ${chatModelId} is not compatible with RAG: ${compatibility.reason}`,
        EmbeddingErrorCodes.MODEL_NOT_LOADED,
        RAGErrorCategory.MODEL_MANAGEMENT,
        {operation: 'enable_concurrent_mode'}
      );
    }

    runInAction(() => {
      this.chatModel = chatModel;
      this.isConcurrentModeActive = true;
      this.config.chatModelId = chatModelId;
    });
  }

  /**
   * Disable concurrent mode and release embedding model if needed
   */
  async disableConcurrentMode(): Promise<void> {
    runInAction(() => {
      this.isConcurrentModeActive = false;
      this.chatModel = null;
      this.config.chatModelId = undefined;
    });

    // Optionally release embedding model to free memory
    if (!this.config.autoLoadEmbeddingModel) {
      await this.releaseEmbeddingModel();
    }
  }

  /**
   * Switch between embedding and chat generation contexts
   */
  async switchToEmbeddingMode(): Promise<void> {
    if (!this.isEmbeddingModelLoaded) {
      await this.loadEmbeddingModel();
    }
    
    // The embedding generator manages its own context
    // No need to switch the main model store context
  }

  /**
   * Switch to chat generation mode
   */
  async switchToChatMode(modelId?: string): Promise<void> {
    const targetModelId = modelId || this.config.chatModelId || modelStore.activeModelId;
    
    if (!targetModelId) {
      throw new RAGError(
        'No chat model specified for switching',
        EmbeddingErrorCodes.MODEL_NOT_LOADED,
        RAGErrorCategory.MODEL_MANAGEMENT,
        {operation: 'switch_to_chat_mode'}
      );
    }

    const model = modelStore.models.find(m => m.id === targetModelId);
    if (!model) {
      throw new RAGError(
        `Chat model ${targetModelId} not found`,
        EmbeddingErrorCodes.MODEL_NOT_LOADED,
        RAGErrorCategory.MODEL_MANAGEMENT,
        {operation: 'switch_to_chat_mode'}
      );
    }

    // Load the chat model if it's not already active
    if (modelStore.activeModelId !== targetModelId) {
      await modelStore.initContext(model);
    }
  }

  /**
   * Check if a model is compatible with RAG functionality
   */
  checkModelCompatibility(model: Model): ModelCompatibilityResult {
    // Check if model is downloaded
    if (!model.isDownloaded) {
      return {
        isCompatible: false,
        reason: 'Model is not downloaded',
        recommendations: ['Download the model first'],
      };
    }

    // Check model size for concurrent usage
    const totalSize = (this.embeddingModel?.size || 0) + model.size;
    const maxConcurrentSize = 6 * 1024 * 1024 * 1024; // 6GB limit for concurrent models
    
    if (this.config.concurrentModelUsage && totalSize > maxConcurrentSize) {
      return {
        isCompatible: false,
        reason: 'Combined model size exceeds device memory limits for concurrent usage',
        recommendations: [
          'Use a smaller chat model',
          'Disable concurrent model usage',
          'Use sequential model loading',
        ],
      };
    }

    // Check if model supports the required features
    if (model.origin === ModelOrigin.LOCAL && !model.chatTemplate) {
      return {
        isCompatible: false,
        reason: 'Local model lacks proper chat template configuration',
        recommendations: ['Configure chat template for the model'],
      };
    }

    return {
      isCompatible: true,
    };
  }

  /**
   * Get the embedding generator instance
   */
  getEmbeddingGenerator(): EmbeddingGenerator | null {
    return this.embeddingGenerator;
  }

  /**
   * Auto-load embedding model for RAG sessions
   */
  async autoLoadForRAGSession(): Promise<void> {
    if (!this.config.autoLoadEmbeddingModel) {
      return;
    }

    if (!this.isEmbeddingModelLoaded) {
      await this.loadEmbeddingModel();
    }
  }

  /**
   * Release embedding model to free memory
   */
  async releaseEmbeddingModel(): Promise<void> {
    if (this.embeddingGenerator) {
      await this.embeddingGenerator.dispose();
      this.embeddingGenerator = null;
    }

    runInAction(() => {
      this.isEmbeddingModelLoaded = false;
      this.embeddingModel = null;
    });
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RAGModelConfig>): void {
    runInAction(() => {
      this.config = {...this.config, ...newConfig};
    });
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      embeddingModelAvailable: this.isEmbeddingModelAvailable(),
      embeddingModelLoaded: this.isEmbeddingModelLoaded,
      concurrentModeActive: this.isConcurrentModeActive,
      currentEmbeddingModel: this.embeddingModel?.name,
      currentChatModel: this.chatModel?.name,
      isLoading: this.isLoadingEmbeddingModel,
      lastError: this.lastError,
    };
  }

  /**
   * Clear the last error
   */
  clearError(): void {
    runInAction(() => {
      this.lastError = null;
    });
  }

  /**
   * Dispose of all resources
   */
  async dispose(): Promise<void> {
    await this.releaseEmbeddingModel();
    
    runInAction(() => {
      this.isConcurrentModeActive = false;
      this.chatModel = null;
      this.lastError = null;
    });
  }
}

// Export singleton instance
export const ragModelManager = new RAGModelManager();