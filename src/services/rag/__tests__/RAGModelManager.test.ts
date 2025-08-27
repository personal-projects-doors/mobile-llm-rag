import {RAGModelManager} from '../RAGModelManager';
import {modelStore} from '../../../store';
import {Model, ModelOrigin} from '../../../utils/types';
import {chatTemplates} from '../../../utils/chat';
import {defaultCompletionParams} from '../../../utils/completionSettingsVersions';

// Mock the model store
jest.mock('../../../store', () => ({
  modelStore: {
    models: [],
    checkSpaceAndDownload: jest.fn(),
    initContext: jest.fn(),
    activeModelId: null,
  },
}));

// Mock the embedding generator
jest.mock('../EmbeddingGenerator', () => ({
  EmbeddingGenerator: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('RAGModelManager', () => {
  let ragModelManager: RAGModelManager;
  
  const mockMedGemmaModel: Model = {
    id: 'unsloth/medgemma-4b-it-GGUF/medgemma-4b-it-IQ4_NL.gguf',
    author: 'unsloth',
    name: 'MedGemma-4B-IT (IQ4_NL)',
    type: 'Gemma',
    capabilities: ['questionAnswering'],
    size: 2400000000,
    params: 4000000000,
    isDownloaded: true,
    downloadUrl: 'https://huggingface.co/unsloth/medgemma-4b-it-GGUF/resolve/main/medgemma-4b-it-IQ4_NL.gguf',
    hfUrl: 'https://huggingface.co/unsloth/medgemma-4b-it-GGUF',
    progress: 0,
    filename: 'medgemma-4b-it-IQ4_NL.gguf',
    isLocal: false,
    origin: ModelOrigin.PRESET,
    defaultChatTemplate: {...chatTemplates.gemmaIt},
    chatTemplate: chatTemplates.gemmaIt,
    defaultCompletionSettings: {
      ...defaultCompletionParams,
      n_predict: 256,
      temperature: 0.0,
      penalty_repeat: 1.0,
    },
    completionSettings: {
      ...defaultCompletionParams,
      n_predict: 256,
      temperature: 0.0,
      penalty_repeat: 1.0,
    },
    defaultStopWords: ['<end_of_turn>'],
    stopWords: ['<end_of_turn>'],
  };

  const mockChatModel: Model = {
    id: 'test/chat-model',
    author: 'test',
    name: 'Test Chat Model',
    type: 'Test',
    capabilities: ['questionAnswering'],
    size: 1000000000, // 1GB
    params: 1000000000,
    isDownloaded: true,
    downloadUrl: 'https://example.com/model.gguf',
    hfUrl: 'https://example.com/model',
    progress: 0,
    filename: 'test-model.gguf',
    isLocal: false,
    origin: ModelOrigin.PRESET,
    defaultChatTemplate: {...chatTemplates.gemmaIt},
    chatTemplate: chatTemplates.gemmaIt,
    defaultCompletionSettings: defaultCompletionParams,
    completionSettings: defaultCompletionParams,
    defaultStopWords: ['<end>'],
    stopWords: ['<end>'],
  };

  beforeEach(() => {
    ragModelManager = new RAGModelManager();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup model store mock
    (modelStore as any).models = [mockMedGemmaModel, mockChatModel];
  });

  describe('initialization', () => {
    it('should initialize successfully when MedGemma model is available', async () => {
      await ragModelManager.initialize();
      
      expect(ragModelManager.embeddingModel?.id).toBe(mockMedGemmaModel.id);
      expect(ragModelManager.lastError).toBeNull();
    });

    it('should throw error when MedGemma model is not found', async () => {
      (modelStore as any).models = [mockChatModel]; // Remove MedGemma model
      
      await expect(ragModelManager.initialize()).rejects.toThrow(
        'MedGemma embedding model not found in model list'
      );
    });
  });

  describe('embedding model availability', () => {
    beforeEach(async () => {
      await ragModelManager.initialize();
    });

    it('should return true when MedGemma model is downloaded', () => {
      expect(ragModelManager.isEmbeddingModelAvailable()).toBe(true);
    });

    it('should return false when MedGemma model is not downloaded', () => {
      mockMedGemmaModel.isDownloaded = false;
      expect(ragModelManager.isEmbeddingModelAvailable()).toBe(false);
    });
  });

  describe('embedding model loading', () => {
    beforeEach(async () => {
      await ragModelManager.initialize();
    });

    it('should load embedding model successfully', async () => {
      await ragModelManager.loadEmbeddingModel();
      
      expect(ragModelManager.isEmbeddingModelLoaded).toBe(true);
      expect(ragModelManager.embeddingGenerator).toBeDefined();
    });

    it('should download model if not already downloaded', async () => {
      mockMedGemmaModel.isDownloaded = false;
      
      await ragModelManager.loadEmbeddingModel();
      
      expect(modelStore.checkSpaceAndDownload).toHaveBeenCalledWith(mockMedGemmaModel.id);
    });
  });

  describe('concurrent mode', () => {
    beforeEach(async () => {
      await ragModelManager.initialize();
      await ragModelManager.loadEmbeddingModel();
    });

    it('should enable concurrent mode with compatible chat model', async () => {
      await ragModelManager.enableConcurrentMode(mockChatModel.id);
      
      expect(ragModelManager.isConcurrentModeActive).toBe(true);
      expect(ragModelManager.chatModel?.id).toBe(mockChatModel.id);
    });

    it('should throw error for non-existent chat model', async () => {
      await expect(
        ragModelManager.enableConcurrentMode('non-existent-model')
      ).rejects.toThrow('Chat model non-existent-model not found');
    });

    it('should disable concurrent mode', async () => {
      await ragModelManager.enableConcurrentMode(mockChatModel.id);
      await ragModelManager.disableConcurrentMode();
      
      expect(ragModelManager.isConcurrentModeActive).toBe(false);
      expect(ragModelManager.chatModel).toBeNull();
    });
  });

  describe('model compatibility', () => {
    beforeEach(async () => {
      await ragModelManager.initialize();
    });

    it('should return compatible for downloaded model within memory limits', () => {
      const result = ragModelManager.checkModelCompatibility(mockChatModel);
      
      expect(result.isCompatible).toBe(true);
    });

    it('should return incompatible for non-downloaded model', () => {
      mockChatModel.isDownloaded = false;
      const result = ragModelManager.checkModelCompatibility(mockChatModel);
      
      expect(result.isCompatible).toBe(false);
      expect(result.reason).toBe('Model is not downloaded');
    });

    it('should return incompatible for model exceeding memory limits', () => {
      const largeChatModel = {
        ...mockChatModel,
        size: 8 * 1024 * 1024 * 1024, // 8GB
        isDownloaded: true, // Ensure it's downloaded to test memory limits
      };
      
      const result = ragModelManager.checkModelCompatibility(largeChatModel);
      
      expect(result.isCompatible).toBe(false);
      expect(result.reason).toContain('memory limits');
    });
  });

  describe('model switching', () => {
    beforeEach(async () => {
      await ragModelManager.initialize();
      await ragModelManager.loadEmbeddingModel();
    });

    it('should switch to embedding mode', async () => {
      await expect(ragModelManager.switchToEmbeddingMode()).resolves.not.toThrow();
    });

    it('should switch to chat mode with existing active model', async () => {
      (modelStore as any).activeModelId = mockChatModel.id;
      
      await expect(ragModelManager.switchToChatMode()).resolves.not.toThrow();
    });

    it('should switch to chat mode with specified model', async () => {
      await expect(ragModelManager.switchToChatMode(mockChatModel.id)).resolves.not.toThrow();
      
      expect(modelStore.initContext).toHaveBeenCalledWith(expect.objectContaining({
        id: mockChatModel.id
      }));
    });
  });

  describe('status and cleanup', () => {
    beforeEach(async () => {
      await ragModelManager.initialize();
    });

    it('should return correct status', () => {
      const status = ragModelManager.getStatus();
      
      expect(status.concurrentModeActive).toBe(false);
      expect(status.isLoading).toBe(false);
      expect(typeof status.embeddingModelAvailable).toBe('boolean');
      expect(typeof status.embeddingModelLoaded).toBe('boolean');
    });

    it('should dispose resources correctly', async () => {
      await ragModelManager.loadEmbeddingModel();
      await ragModelManager.dispose();
      
      expect(ragModelManager.isEmbeddingModelLoaded).toBe(false);
      expect(ragModelManager.embeddingGenerator).toBeNull();
      expect(ragModelManager.isConcurrentModeActive).toBe(false);
    });
  });
});