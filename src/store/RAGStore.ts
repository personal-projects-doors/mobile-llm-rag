import { makeAutoObservable, runInAction } from 'mobx';
import { makePersistable } from 'mobx-persist-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { database } from '../database';
import { RAGSettings, RAGSettingsConfig, DEFAULT_RAG_SETTINGS } from '../database/models/RAGSettings';
import { ragModelManager, RAGModelConfig } from '../services/rag/RAGModelManager';
import { modelStore } from './ModelStore';

// Settings version for migration tracking
const CURRENT_SETTINGS_VERSION = 1;
const SETTINGS_VERSION_KEY = 'rag_settings_version';

export class RAGStore {
  // Current settings configuration
  settings: RAGSettingsConfig = { ...DEFAULT_RAG_SETTINGS };

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
      // Wait for database to be ready with retry logic
      await this.waitForDatabase();

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

      console.log('RAG model manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize RAG model manager:', error);
      // Don't throw here to avoid blocking the main RAG store initialization
      // The app should still work without RAG functionality
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to initialize RAG model manager';
        // Still mark as initialized to prevent repeated attempts
        this.isModelManagerInitialized = true;
      });
    }
  }

  // Create default settings in database
  private async createDefaultSettings() {
    try {
      await database.write(async () => {
        const settingsCollection = database.get<RAGSettings>('rag_settings');
        if (!settingsCollection || !settingsCollection.create) {
          throw new Error('RAG settings collection not available for creation');
        }
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
      const updatedSettings = { ...this.settings, ...newSettings };

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

  // Wait for database to be ready with retry logic
  private async waitForDatabase(maxRetries = 10, delay = 500): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Check if database exists and is properly initialized
        if (!database) {
          throw new Error('Database instance is null');
        }

        // Try to access the database to see if it's ready
        const settingsCollection = database.get<RAGSettings>('rag_settings');
        if (!settingsCollection) {
          throw new Error('RAG settings collection is null');
        }

        if (!settingsCollection.query) {
          throw new Error('RAG settings collection query method is null');
        }

        // Try a simple query to ensure the database is fully ready
        await settingsCollection.query().fetch();

        // Database is ready
        console.log('Database is ready for RAG operations');
        return;
      } catch (error) {
        console.log(`Database not ready, attempt ${i + 1}/${maxRetries}:`, error);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    throw new Error('Database failed to initialize after maximum retries');
  }

  // Check if RAG is fully available and ready to use
  get isRAGAvailable(): boolean {
    return this.isInitialized &&
      this.isModelManagerInitialized &&
      ragModelManager.isEmbeddingModelAvailable() &&
      !this.error;
  }

  // Check if RAG can be enabled (model exists but might not be loaded)
  get canEnableRAG(): boolean {
    return this.isInitialized &&
      this.isModelManagerInitialized &&
      ragModelManager.embeddingModel !== null;
  }

  // Get RAG status for UI display
  get ragStatus(): 'available' | 'model_not_found' | 'model_not_downloaded' | 'loading' | 'error' {
    if (!this.isInitialized || this.isLoading) return 'loading';
    if (this.error) return 'error';
    if (!ragModelManager.embeddingModel) return 'model_not_found';
    if (!ragModelManager.isEmbeddingModelAvailable()) return 'model_not_downloaded';
    return 'available';
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
    await this.updateSettings({ chunkSize: value });
  }

  async setOverlap(value: number) {
    await this.updateSettings({ overlap: value });
  }

  async setMaxResults(value: number) {
    await this.updateSettings({ maxResults: value });
  }

  async setMinSimilarity(value: number) {
    await this.updateSettings({ minSimilarity: value });
  }

  async setPreserveSentences(value: boolean) {
    await this.updateSettings({ preserveSentences: value });
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
      if (!settingsCollection || !settingsCollection.query) {
        throw new Error('RAG settings collection not available');
      }
      const existingSettings = await settingsCollection.query().fetch();

      if (existingSettings.length > 0) {
        const dbSettings = existingSettings[0];

        // Safely get current config with fallback
        let currentConfig: RAGSettingsConfig;
        try {
          currentConfig = dbSettings.config;
        } catch (configError) {
          console.warn('Could not read existing config, using defaults:', configError);
          currentConfig = { ...DEFAULT_RAG_SETTINGS };
        }

        // Check if any settings are missing or invalid and update them
        const needsUpdate =
          !dbSettings.isValidChunkSize ||
          !dbSettings.isValidOverlap ||
          !dbSettings.isValidMaxResults ||
          !dbSettings.isValidMinSimilarity ||
          typeof currentConfig.preserveSentences === 'undefined';

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
      } else {
        // No existing settings, create default ones
        await this.createDefaultSettings();
        console.log('Created default RAG settings during migration');
      }
    } catch (error) {
      console.error('Failed to migrate RAG settings to version 1:', error);
      // Don't throw here to avoid blocking initialization
      // Instead, try to create default settings
      try {
        await this.createDefaultSettings();
        console.log('Created default RAG settings after migration failure');
      } catch (fallbackError) {
        console.error('Failed to create default settings as fallback:', fallbackError);
        throw error; // Only throw if both migration and fallback fail
      }
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
      this.modelConfig = { ...this.modelConfig, ...newConfig };
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
    await this.updateModelConfig({ embeddingModelId: modelId });
  }

  async setAutoLoadEmbeddingModel(value: boolean) {
    await this.updateModelConfig({ autoLoadEmbeddingModel: value });
  }

  async setConcurrentModelUsage(value: boolean) {
    await this.updateModelConfig({ concurrentModelUsage: value });
  }

  /**
   * Get user-friendly status message for RAG availability
   */
  getRAGStatusMessage(): string {
    switch (this.ragStatus) {
      case 'available':
        return 'RAG is ready to use';
      case 'model_not_found':
        return `Embedding model '${this.embeddingModelId}' not found. Please add it to your models to enable RAG.`;
      case 'model_not_downloaded':
        return `Embedding model '${this.embeddingModelId}' found but not downloaded. Please download it to enable RAG.`;
      case 'loading':
        return 'RAG is initializing...';
      case 'error':
        return this.error || 'RAG initialization failed';
      default:
        return 'RAG status unknown';
    }
  }

  /**
   * Get recommendations for enabling RAG
   */
  getRAGRecommendations(): string[] {
    switch (this.ragStatus) {
      case 'model_not_found':
        return [
          'Go to Models screen',
          'Add the MedGemma embedding model',
          'Download the model',
          'Return to enable RAG'
        ];
      case 'model_not_downloaded':
        return [
          'Go to Models screen',
          'Find the MedGemma embedding model',
          'Download the model',
          'Return to enable RAG'
        ];
      case 'error':
        return [
          'Check device storage space',
          'Restart the app',
          'Contact support if issue persists'
        ];
      default:
        return [];
    }
  }

  /**
   * Get detailed MedGemma setup status and guidance
   */
  async getMedGemmaSetupStatus(): Promise<{
    status: 'ready' | 'not_found' | 'not_downloaded' | 'loading_failed' | 'validation_failed';
    message: string;
    details: string[];
    actions: string[];
  }> {
    if (!this.isModelManagerInitialized) {
      await this.initializeModelManager();
    }

    return await ragModelManager.checkMedGemmaSetup();
  }

  /**
   * Download and setup the MedGemma model for RAG
   */
  async downloadAndSetupMedGemmaModel(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      console.log('Starting MedGemma model download and setup...');

      if (!this.isModelManagerInitialized) {
        await this.initializeModelManager();
      }

      // Ensure model is available and download if needed
      const model = await ragModelManager.ensureEmbeddingModelAvailable();

      if (!model.isDownloaded) {
        console.log('Downloading MedGemma model...');
        await ragModelManager.downloadEmbeddingModel();
      }

      // Load the model
      console.log('Loading MedGemma model...');
      await ragModelManager.loadEmbeddingModel();

      return {
        success: true,
        message: 'MedGemma model downloaded and setup successfully',
        details: {
          modelName: model.name,
          modelSize: model.size,
          isLoaded: ragModelManager.isEmbeddingModelLoaded,
        },
      };
    } catch (error) {
      console.error('Failed to download and setup MedGemma model:', error);
      return {
        success: false,
        message: `Failed to setup MedGemma model: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error,
      };
    }
  }

  /**
   * Test RAG functionality with a simple embedding generation
   */
  async testRAGFunctionality(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      if (!this.isRAGAvailable) {
        // Try to setup the model first
        const setupResult = await this.downloadAndSetupMedGemmaModel();
        if (!setupResult.success) {
          return {
            success: false,
            message: 'RAG is not available and setup failed. Please check model setup.',
            details: setupResult,
          };
        }
      }

      const embeddingGenerator = ragModelManager.getEmbeddingGenerator();
      if (!embeddingGenerator) {
        return {
          success: false,
          message: 'Embedding generator not available',
        };
      }

      // Test with a simple text
      const testText = 'This is a test for RAG embedding generation.';
      console.log('Testing embedding generation...');
      const result = await embeddingGenerator.generateEmbedding(testText, 'test');

      return {
        success: true,
        message: 'RAG functionality test passed',
        details: {
          embeddingDimensions: result.embedding.length,
          tokenCount: result.tokenCount,
          processingTime: result.processingTime,
        },
      };
    } catch (error) {
      console.error('RAG test failed:', error);
      return {
        success: false,
        message: `RAG test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error,
      };
    }
  }
}

// Use lazy initialization to avoid issues with database not being ready
let _ragStore: RAGStore | null = null;

export const ragStore = (() => {
  if (!_ragStore) {
    _ragStore = new RAGStore();
  }
  return _ragStore;
})();

// Export a test function for easy access
export const testMedGemmaEmbedding = async () => {
  console.log('=== Testing MedGemma Embedding Model ===');

  try {
    // Initialize RAG store
    await ragStore.initialize();
    console.log('✓ RAG store initialized');

    // Download and setup MedGemma model
    const setupResult = await ragStore.downloadAndSetupMedGemmaModel();
    console.log('Setup result:', setupResult);

    if (!setupResult.success) {
      console.error('✗ Failed to setup MedGemma model:', setupResult.message);
      return setupResult;
    }

    console.log('✓ MedGemma model setup completed');

    // Test RAG functionality
    const testResult = await ragStore.testRAGFunctionality();
    console.log('Test result:', testResult);

    if (testResult.success) {
      console.log('✓ RAG functionality test passed!');
      console.log('Embedding dimensions:', testResult.details?.embeddingDimensions);
      console.log('Processing time:', testResult.details?.processingTime, 'ms');
    } else {
      console.error('✗ RAG functionality test failed:', testResult.message);
    }

    return testResult;
  } catch (error) {
    console.error('✗ Test failed with error:', error);
    return {
      success: false,
      message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error,
    };
  }
};