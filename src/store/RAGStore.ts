import {makeAutoObservable, runInAction} from 'mobx';
import {makePersistable} from 'mobx-persist-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {database} from '../database';
import {RAGSettings, RAGSettingsConfig, DEFAULT_RAG_SETTINGS} from '../database/models/RAGSettings';
import {ragModelManager, RAGModelConfig} from '../services/rag/RAGModelManager';

// Settings version for migration tracking
const CURRENT_SETTINGS_VERSION = 1;
const SETTINGS_VERSION_KEY = 'rag_settings_version';

export class RAGStore {
  // Current settings configuration
  settings: RAGSettingsConfig = {...DEFAULT_RAG_SETTINGS};
  
  // Model configuration
  modelConfig: RAGModelConfig = {
    embeddingModelId: 'unsloth/medgemma-4b-it-GGUF/medgemma-4b-it-IQ4_NL.gguf',
    autoLoadEmbeddingModel: true,
    concurrentModelUsage: true,
  };
  
  // Loading states
  isLoading = false;
  isInitialized = false;
  isModelManagerInitialized = false;
  
  // Error state
  error: string | null = null;
  
  // Migration state
  migrationCompleted = false;

  constructor() {
    makeAutoObservable(this);
    makePersistable(this, {
      name: 'RAGStore',
      properties: ['settings', 'modelConfig', 'migrationCompleted'],
      storage: AsyncStorage,
    });
  }

  // Initialize settings from database
  async initialize() {
    if (this.isInitialized) return;
    
    runInAction(() => {
      this.isLoading = true;
      this.error = null;
    });

    try {
      // Check if migration is needed
      await this.checkAndRunMigrations();
      
      const settingsCollection = database.get<RAGSettings>('rag_settings');
      const existingSettings = await settingsCollection.query().fetch();
      
      if (existingSettings.length > 0) {
        const dbSettings = existingSettings[0];
        runInAction(() => {
          this.settings = dbSettings.config;
        });
      } else {
        // Create default settings in database
        await this.createDefaultSettings();
      }

      // Initialize model manager
      await this.initializeModelManager();
      
      runInAction(() => {
        this.isInitialized = true;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to initialize RAG settings';
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  // Initialize the RAG model manager
  async initializeModelManager() {
    if (this.isModelManagerInitialized) return;

    try {
      // Update model manager configuration
      ragModelManager.updateConfig(this.modelConfig);
      
      // Initialize the model manager
      await ragModelManager.initialize();
      
      runInAction(() => {
        this.isModelManagerInitialized = true;
      });
    } catch (error) {
      console.error('Failed to initialize RAG model manager:', error);
      // Don't throw here to avoid blocking the main RAG store initialization
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to initialize RAG model manager';
      });
    }
  }

  // Create default settings in database
  private async createDefaultSettings() {
    try {
      await database.write(async () => {
        const settingsCollection = database.get<RAGSettings>('rag_settings');
        await settingsCollection.create(settings => {
          settings.chunkSize = DEFAULT_RAG_SETTINGS.chunkSize;
          settings.overlap = DEFAULT_RAG_SETTINGS.overlap;
          settings.maxResults = DEFAULT_RAG_SETTINGS.maxResults;
          settings.minSimilarity = DEFAULT_RAG_SETTINGS.minSimilarity;
          settings.preserveSentences = DEFAULT_RAG_SETTINGS.preserveSentences;
        });
      });
    } catch (error) {
      console.error('Failed to create default RAG settings:', error);
      throw error;
    }
  }

  // Update settings
  async updateSettings(newSettings: Partial<RAGSettingsConfig>) {
    runInAction(() => {
      this.isLoading = true;
      this.error = null;
    });

    try {
      const updatedSettings = {...this.settings, ...newSettings};
      
      // Validate settings
      const validationError = this.validateSettings(updatedSettings);
      if (validationError) {
        throw new Error(validationError);
      }

      // Update database
      await database.write(async () => {
        const settingsCollection = database.get<RAGSettings>('rag_settings');
        const existingSettings = await settingsCollection.query().fetch();
        
        if (existingSettings.length > 0) {
          const dbSettings = existingSettings[0];
          await dbSettings.update(settings => {
            settings.chunkSize = updatedSettings.chunkSize;
            settings.overlap = updatedSettings.overlap;
            settings.maxResults = updatedSettings.maxResults;
            settings.minSimilarity = updatedSettings.minSimilarity;
            settings.preserveSentences = updatedSettings.preserveSentences;
          });
        } else {
          await this.createDefaultSettings();
        }
      });

      runInAction(() => {
        this.settings = updatedSettings;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to update settings';
      });
      throw error;
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  // Reset to default settings
  async resetToDefaults() {
    await this.updateSettings(DEFAULT_RAG_SETTINGS);
  }

  // Validation methods
  validateSettings(settings: RAGSettingsConfig): string | null {
    if (settings.chunkSize < 100 || settings.chunkSize > 2000) {
      return 'Chunk size must be between 100 and 2000 tokens';
    }
    
    if (settings.overlap < 0 || settings.overlap >= settings.chunkSize) {
      return 'Overlap must be between 0 and chunk size';
    }
    
    if (settings.maxResults < 1 || settings.maxResults > 20) {
      return 'Max results must be between 1 and 20';
    }
    
    if (settings.minSimilarity < 0 || settings.minSimilarity > 1) {
      return 'Minimum similarity must be between 0 and 1';
    }
    
    return null;
  }

  // Performance impact calculation
  getPerformanceImpact(settings: RAGSettingsConfig = this.settings): 'low' | 'medium' | 'high' {
    const score = 
      (settings.chunkSize > 1000 ? 2 : settings.chunkSize > 500 ? 1 : 0) +
      (settings.maxResults > 10 ? 2 : settings.maxResults > 5 ? 1 : 0) +
      (settings.overlap > 100 ? 1 : 0);
    
    if (score >= 4) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  // Get performance impact description
  getPerformanceDescription(impact: 'low' | 'medium' | 'high'): string {
    switch (impact) {
      case 'low':
        return 'Minimal impact on processing speed and memory usage';
      case 'medium':
        return 'Moderate impact on processing speed and memory usage';
      case 'high':
        return 'Significant impact on processing speed and memory usage';
    }
  }

  // Clear error
  clearError() {
    runInAction(() => {
      this.error = null;
    });
  }

  // Getters for individual settings with validation
  get chunkSize() {
    return this.settings.chunkSize;
  }

  get overlap() {
    return this.settings.overlap;
  }

  get maxResults() {
    return this.settings.maxResults;
  }

  get minSimilarity() {
    return this.settings.minSimilarity;
  }

  get preserveSentences() {
    return this.settings.preserveSentences;
  }

  // Individual setting updates
  async setChunkSize(value: number) {
    await this.updateSettings({chunkSize: value});
  }

  async setOverlap(value: number) {
    await this.updateSettings({overlap: value});
  }

  async setMaxResults(value: number) {
    await this.updateSettings({maxResults: value});
  }

  async setMinSimilarity(value: number) {
    await this.updateSettings({minSimilarity: value});
  }

  async setPreserveSentences(value: boolean) {
    await this.updateSettings({preserveSentences: value});
  }

  // Migration system
  private async checkAndRunMigrations() {
    try {
      const currentVersion = await AsyncStorage.getItem(SETTINGS_VERSION_KEY);
      const version = currentVersion ? parseInt(currentVersion, 10) : 0;
      
      if (version < CURRENT_SETTINGS_VERSION) {
        await this.runMigrations(version);
        await AsyncStorage.setItem(SETTINGS_VERSION_KEY, CURRENT_SETTINGS_VERSION.toString());
        
        runInAction(() => {
          this.migrationCompleted = true;
        });
      }
    } catch (error) {
      console.error('Migration failed:', error);
      // Don't throw here to avoid blocking initialization
    }
  }

  private async runMigrations(fromVersion: number) {
    console.log(`Running RAG settings migrations from version ${fromVersion} to ${CURRENT_SETTINGS_VERSION}`);
    
    // Migration from version 0 to 1
    if (fromVersion < 1) {
      await this.migrateToVersion1();
    }
    
    // Future migrations can be added here
    // if (fromVersion < 2) {
    //   await this.migrateToVersion2();
    // }
  }

  private async migrateToVersion1() {
    try {
      // Version 1 migration: Ensure all settings have proper defaults
      const settingsCollection = database.get<RAGSettings>('rag_settings');
      const existingSettings = await settingsCollection.query().fetch();
      
      if (existingSettings.length > 0) {
        const dbSettings = existingSettings[0];
        
        // Check if any settings are missing or invalid and update them
        const currentConfig = dbSettings.config;
        const needsUpdate = 
          !dbSettings.isValidChunkSize ||
          !dbSettings.isValidOverlap ||
          !dbSettings.isValidMaxResults ||
          !dbSettings.isValidMinSimilarity;
        
        if (needsUpdate) {
          await database.write(async () => {
            await dbSettings.update(settings => {
              // Fix invalid values with defaults
              if (!dbSettings.isValidChunkSize) {
                settings.chunkSize = DEFAULT_RAG_SETTINGS.chunkSize;
              }
              if (!dbSettings.isValidOverlap) {
                settings.overlap = DEFAULT_RAG_SETTINGS.overlap;
              }
              if (!dbSettings.isValidMaxResults) {
                settings.maxResults = DEFAULT_RAG_SETTINGS.maxResults;
              }
              if (!dbSettings.isValidMinSimilarity) {
                settings.minSimilarity = DEFAULT_RAG_SETTINGS.minSimilarity;
              }
              // Ensure preserveSentences is set (new in v1)
              if (typeof currentConfig.preserveSentences === 'undefined') {
                settings.preserveSentences = DEFAULT_RAG_SETTINGS.preserveSentences;
              }
            });
          });
          
          console.log('RAG settings migrated to version 1 with corrected values');
        }
      }
    } catch (error) {
      console.error('Failed to migrate RAG settings to version 1:', error);
      throw error;
    }
  }

  // Get migration status for UI display
  get migrationStatus(): 'pending' | 'completed' | 'not_needed' {
    if (!this.isInitialized) return 'pending';
    return this.migrationCompleted ? 'completed' : 'not_needed';
  }

  // Model management methods
  
  /**
   * Check if the embedding model is available and ready
   */
  isEmbeddingModelReady(): boolean {
    return ragModelManager.isEmbeddingModelAvailable() && ragModelManager.isEmbeddingModelLoaded;
  }

  /**
   * Load the embedding model for RAG operations
   */
  async loadEmbeddingModel(): Promise<void> {
    if (!this.isModelManagerInitialized) {
      await this.initializeModelManager();
    }
    
    await ragModelManager.loadEmbeddingModel();
  }

  /**
   * Enable RAG mode with concurrent model usage
   */
  async enableRAGMode(chatModelId?: string): Promise<void> {
    if (!this.isModelManagerInitialized) {
      await this.initializeModelManager();
    }

    // Auto-load embedding model for RAG session
    await ragModelManager.autoLoadForRAGSession();

    // Enable concurrent mode if chat model is specified
    if (chatModelId && this.modelConfig.concurrentModelUsage) {
      await ragModelManager.enableConcurrentMode(chatModelId);
    }
  }

  /**
   * Disable RAG mode and clean up resources
   */
  async disableRAGMode(): Promise<void> {
    if (ragModelManager.isConcurrentModeActive) {
      await ragModelManager.disableConcurrentMode();
    }
  }

  /**
   * Switch to embedding generation mode
   */
  async switchToEmbeddingMode(): Promise<void> {
    await ragModelManager.switchToEmbeddingMode();
  }

  /**
   * Switch to chat generation mode
   */
  async switchToChatMode(modelId?: string): Promise<void> {
    await ragModelManager.switchToChatMode(modelId);
  }

  /**
   * Check if a model is compatible with RAG
   */
  checkModelCompatibility(modelId: string) {
    const model = ragModelManager.chatModel || 
      (typeof modelStore !== 'undefined' ? modelStore.models.find(m => m.id === modelId) : null);
    
    if (!model) {
      return {
        isCompatible: false,
        reason: 'Model not found',
      };
    }

    return ragModelManager.checkModelCompatibility(model);
  }

  /**
   * Update model configuration
   */
  async updateModelConfig(newConfig: Partial<RAGModelConfig>): Promise<void> {
    runInAction(() => {
      this.modelConfig = {...this.modelConfig, ...newConfig};
    });

    // Update the model manager configuration
    ragModelManager.updateConfig(this.modelConfig);
  }

  /**
   * Get embedding generator instance
   */
  getEmbeddingGenerator() {
    return ragModelManager.getEmbeddingGenerator();
  }

  /**
   * Get model manager status
   */
  getModelStatus() {
    return ragModelManager.getStatus();
  }

  /**
   * Clear model manager errors
   */
  clearModelError(): void {
    ragModelManager.clearError();
  }

  // Getters for model configuration
  get embeddingModelId() {
    return this.modelConfig.embeddingModelId;
  }

  get autoLoadEmbeddingModel() {
    return this.modelConfig.autoLoadEmbeddingModel;
  }

  get concurrentModelUsage() {
    return this.modelConfig.concurrentModelUsage;
  }

  // Individual model config updates
  async setEmbeddingModelId(modelId: string) {
    await this.updateModelConfig({embeddingModelId: modelId});
  }

  async setAutoLoadEmbeddingModel(value: boolean) {
    await this.updateModelConfig({autoLoadEmbeddingModel: value});
  }

  async setConcurrentModelUsage(value: boolean) {
    await this.updateModelConfig({concurrentModelUsage: value});
  }
}

export const ragStore = new RAGStore();