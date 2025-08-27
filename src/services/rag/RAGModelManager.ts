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
      // Ensure the MedGemma model is available in the model store
      const embeddingModel = await this.ensureEmbeddingModelAvailable();

      runInAction(() => {
        this.embeddingModel = embeddingModel;
      });

      console.log(`MedGemma model found: ${embeddingModel.name}, Downloaded: ${embeddingModel.isDownloaded}`);

      // Auto-load embedding model if configured
      if (this.config.autoLoadEmbeddingModel) {
        if (embeddingModel.isDownloaded) {
          console.log('Auto-loading MedGemma model...');
          await this.loadEmbeddingModel();
        } else {
          console.log('MedGemma model not downloaded. Auto-downloading...');
          try {
            await this.downloadEmbeddingModel();
            await this.loadEmbeddingModel();
          } catch (downloadError) {
            console.warn('Auto-download failed, user will need to manually download:', downloadError);
            runInAction(() => {
              this.lastError = new RAGError(
                `Embedding model '${this.config.embeddingModelId}' is not downloaded. Please download it manually to enable RAG functionality.`,
                EmbeddingErrorCodes.MODEL_NOT_LOADED,
                RAGErrorCategory.MODEL_MANAGEMENT,
                {operation: 'initialize'}
              );
            });
          }
        }
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
      
      // Log the error but don't throw it to avoid breaking the app
      console.error('RAG model manager initialization failed:', ragError);
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
   * Ensure the MedGemma model is available in the model store
   */
  async ensureEmbeddingModelAvailable(): Promise<Model> {
    let model = this.findEmbeddingModel();
    
    if (!model) {
      console.log('MedGemma model not found in model store, adding it...');
      
      // Add the MedGemma model to the store if it's not there
      const medgemmaModelConfig = {
        id: 'unsloth/medgemma-4b-it-GGUF/medgemma-4b-it-IQ4_NL.gguf',
        author: 'unsloth',
        name: 'MedGemma-4B-IT (IQ4_NL)',
        type: 'Gemma',
        capabilities: ['questionAnswering', 'medical'],
        params: 4000000000,
        isDownloaded: false,
        downloadUrl: 'https://huggingface.co/unsloth/medgemma-4b-it-GGUF/resolve/main/medgemma-4b-it-IQ4_NL.gguf',
        hfUrl: 'https://huggingface.co/unsloth/medgemma-4b-it-GGUF',
        progress: 0,
        filename: 'medgemma-4b-it-IQ4_NL.gguf',
        isLocal: false,
        origin: ModelOrigin.PRESET,
        size: 2800000000,
        stopWords: ['<end_of_turn>'],
        hfModelFile: {
          rfilename: 'medgemma-4b-it-IQ4_NL.gguf',
          url: 'https://huggingface.co/unsloth/medgemma-4b-it-GGUF/resolve/main/medgemma-4b-it-IQ4_NL.gguf',
          size: 2800000000,
          oid: 'placeholder_oid_for_medgemma',
        },
      };

      // Add to model store
      runInAction(() => {
        modelStore.models.push(medgemmaModelConfig as any);
      });
      
      // Try to find it again
      model = this.findEmbeddingModel();
      
      if (!model) {
        throw new RAGError(
          'Failed to add MedGemma model to model store',
          EmbeddingErrorCodes.MODEL_NOT_LOADED,
          RAGErrorCategory.MODEL_MANAGEMENT,
          {operation: 'ensure_model_available'}
        );
      }
      
      console.log('MedGemma model added to model store successfully');
    }

    return model;
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
      console.log('MedGemma model already downloaded');
      return; // Already downloaded
    }

    try {
      console.log(`Downloading MedGemma model: ${model.name}`);
      await modelStore.checkSpaceAndDownload(model.id);
      
      // Wait for download to complete
      await this.waitForModelDownload(model.id);
      
      console.log('MedGemma model download completed');
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
   * Wait for model download to complete
   */
  private async waitForModelDownload(modelId: string, maxWaitTime = 300000): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 2000; // Check every 2 seconds

    while (Date.now() - startTime < maxWaitTime) {
      const model = modelStore.models.find(m => m.id === modelId);
      
      if (model?.isDownloaded) {
        return; // Download completed
      }

      if (model?.progress !== undefined) {
        console.log(`Download progress: ${model.progress}%`);
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw new Error('Model download timeout');
  }

  /**
   * Load the embedding model for RAG operations
   */
  async loadEmbeddingModel(): Promise<void> {
    if (this.isEmbeddingModelLoaded && this.embeddingGenerator) {
      console.log('Embedding model already loaded');
      return; // Already loaded
    }

    const model = await this.ensureEmbeddingModelAvailable();

    if (!model.isDownloaded) {
      console.log('Embedding model not downloaded, attempting download...');
      await this.downloadEmbeddingModel();
    }

    runInAction(() => {
      this.isLoadingEmbeddingModel = true;
      this.lastError = null;
    });

    try {
      console.log(`Loading embedding model: ${model.name} (${model.id})`);

      // Create embedding generator with MedGemma-optimized configuration
      this.embeddingGenerator = new EmbeddingGenerator({
        model,
        config: {
          batchSize: 3, // Conservative batch size for mobile devices
          maxTokens: 512, // MedGemma can handle up to 512 tokens efficiently
          normalize: true, // Normalize embeddings for better similarity search
        },
        onProgress: (progress) => {
          console.log(`Embedding progress: ${progress.processed}/${progress.total}`);
        },
        onError: (error) => {
          console.error('Embedding generation error:', error);
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

      // Validate the model setup
      const validation = await this.embeddingGenerator.validateModelForEmbedding();
      if (!validation.isValid) {
        console.warn('Embedding model validation issues:', validation.issues);
        console.warn('Recommendations:', validation.recommendations);
        
        // Don't throw an error for validation issues, just log warnings
        // The model might still work despite minor issues
      }

      runInAction(() => {
        this.isEmbeddingModelLoaded = true;
        this.embeddingModel = model;
      });

      console.log(`Successfully loaded embedding model: ${model.name}`);
    } catch (error) {
      const ragError = error instanceof RAGError 
        ? error 
        : new RAGError(
            `Failed to load MedGemma embedding model: ${error instanceof Error ? error.message : 'Unknown error'}`,
            EmbeddingErrorCodes.MODEL_LOADING_FAILED,
            RAGErrorCategory.MODEL_MANAGEMENT,
            {operation: 'load'},
            error instanceof Error ? error : undefined
          );
      
      console.error('Failed to load embedding model:', ragError);
      
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
   * Check MedGemma model setup and provide detailed status
   */
  async checkMedGemmaSetup(): Promise<{
    status: 'ready' | 'not_found' | 'not_downloaded' | 'loading_failed' | 'validation_failed';
    message: string;
    details: string[];
    actions: string[];
  }> {
    const model = this.findEmbeddingModel();
    
    if (!model) {
      return {
        status: 'not_found',
        message: `MedGemma model '${this.config.embeddingModelId}' not found`,
        details: [
          'The MedGemma embedding model is not in your model list',
          'This model is required for RAG functionality',
        ],
        actions: [
          'Go to Models screen',
          'Look for MedGemma-4B-IT (IQ4_NL) in the available models',
          'Download the model',
          'Return to enable RAG',
        ],
      };
    }

    if (!model.isDownloaded) {
      return {
        status: 'not_downloaded',
        message: `MedGemma model found but not downloaded`,
        details: [
          `Model: ${model.name}`,
          `Size: ~2.8GB`,
          `Status: Available for download`,
        ],
        actions: [
          'Go to Models screen',
          'Find the MedGemma-4B-IT model',
          'Tap download to install the model',
          'Wait for download to complete',
        ],
      };
    }

    // Try to load and validate the model
    try {
      if (!this.isEmbeddingModelLoaded) {
        await this.loadEmbeddingModel();
      }

      if (this.embeddingGenerator) {
        const validation = await this.embeddingGenerator.validateModelForEmbedding();
        
        if (!validation.isValid) {
          return {
            status: 'validation_failed',
            message: 'MedGemma model loaded but validation failed',
            details: validation.issues,
            actions: validation.recommendations,
          };
        }
      }

      return {
        status: 'ready',
        message: 'MedGemma model is ready for RAG operations',
        details: [
          `Model: ${model.name}`,
          `Status: Loaded and validated`,
          `Embedding dimensions: 4096`,
        ],
        actions: [],
      };
    } catch (error) {
      return {
        status: 'loading_failed',
        message: 'Failed to load MedGemma model',
        details: [
          error instanceof Error ? error.message : 'Unknown error',
          'The model file may be corrupted or incompatible',
        ],
        actions: [
          'Try restarting the app',
          'Re-download the model if the issue persists',
          'Check available storage space',
          'Contact support if the problem continues',
        ],
      };
    }
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