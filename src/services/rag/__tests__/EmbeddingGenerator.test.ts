import { EmbeddingGenerator } from '../EmbeddingGenerator';
import {
  EmbeddingConfig,
  EmbeddingResult,
  BatchEmbeddingResult,
  EmbeddingProgress,
  EmbeddingError,
  EmbeddingErrorCodes,
  DocumentChunk,
} from '../types';
import { Model, ModelOrigin } from '../../../utils/types';
import { chatTemplates } from '../../../utils/chat';
import { defaultCompletionParams } from '../../../utils/completionSettingsVersions';

// Mock LlamaContext
jest.mock('@pocketpalai/llama.rn', () => ({
  LlamaContext: jest.fn().mockImplementation(() => ({
    loadSession: jest.fn().mockResolvedValue(undefined),
    tokenize: jest.fn().mockResolvedValue([1, 2, 3, 4, 5]), // Mock 5 tokens
    getEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
    release: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('EmbeddingGenerator', () => {
  let mockModel: Model;
  let generator: EmbeddingGenerator;
  let mockProgressCallback: jest.Mock;
  let mockErrorCallback: jest.Mock;

  beforeEach(() => {
    mockModel = {
      id: 'unsloth/medgemma-4b-it-GGUF/medgemma-4b-it-IQ4_NL.gguf',
      author: 'unsloth',
      name: 'MedGemma-4B-IT (IQ4_NL)',
      type: 'Gemma',
      capabilities: ['questionAnswering'],
      size: 2800000000,
      params: 4000000000,
      isDownloaded: true,
      downloadUrl: 'https://huggingface.co/unsloth/medgemma-4b-it-GGUF/resolve/main/medgemma-4b-it-IQ4_NL.gguf',
      hfUrl: 'https://huggingface.co/unsloth/medgemma-4b-it-GGUF',
      progress: 100,
      filename: 'medgemma-4b-it-IQ4_NL.gguf',
      fullPath: '/path/to/medgemma-4b-it-IQ4_NL.gguf',
      isLocal: false,
      origin: ModelOrigin.PRESET,
      defaultChatTemplate: chatTemplates.gemmaIt,
      chatTemplate: chatTemplates.gemmaIt,
      defaultCompletionSettings: defaultCompletionParams,
      completionSettings: defaultCompletionParams,
      defaultStopWords: ['<end_of_turn>'],
      stopWords: ['<end_of_turn>'],
    };

    mockProgressCallback = jest.fn();
    mockErrorCallback = jest.fn();

    generator = new EmbeddingGenerator({
      model: mockModel,
      onProgress: mockProgressCallback,
      onError: mockErrorCallback,
    });
  });

  afterEach(async () => {
    await generator.dispose();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const config = generator.getConfig();
      expect(config.modelId).toBe(mockModel.id);
      expect(config.batchSize).toBe(10);
      expect(config.maxTokens).toBe(512);
      expect(config.normalize).toBe(true);
    });

    it('should accept custom config', () => {
      const customGenerator = new EmbeddingGenerator({
        model: mockModel,
        config: {
          batchSize: 5,
          maxTokens: 256,
          normalize: false,
        },
      });

      const config = customGenerator.getConfig();
      expect(config.batchSize).toBe(5);
      expect(config.maxTokens).toBe(256);
      expect(config.normalize).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with downloaded model', async () => {
      await expect(generator.initialize()).resolves.not.toThrow();
    });

    it('should throw error if model is not downloaded', async () => {
      const undownloadedModel = { ...mockModel, isDownloaded: false };
      const undownloadedGenerator = new EmbeddingGenerator({
        model: undownloadedModel,
      });

      await expect(undownloadedGenerator.initialize()).rejects.toThrow(
        EmbeddingError
      );
      await expect(undownloadedGenerator.initialize()).rejects.toThrow(
        'Model is not downloaded'
      );
    });

    it('should not reinitialize if already loaded', async () => {
      await generator.initialize();
      const { LlamaContext } = require('@pocketpalai/llama.rn');
      const mockConstructor = LlamaContext as jest.Mock;
      const initialCallCount = mockConstructor.mock.calls.length;

      await generator.initialize();
      expect(mockConstructor.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('generateEmbedding', () => {
    beforeEach(async () => {
      await generator.initialize();
    });

    it('should generate embedding for valid text', async () => {
      const text = 'This is a test text for embedding generation.';
      const result = await generator.generateEmbedding(text, 'chunk-1');

      expect(result).toMatchObject({
        embedding: expect.any(Array),
        tokenCount: 5,
        processingTime: expect.any(Number),
        chunkId: 'chunk-1',
      });
      expect(result.embedding).toHaveLength(5);
    });

    it('should normalize embeddings when configured', async () => {
      const text = 'Test text';
      const result = await generator.generateEmbedding(text);

      // Check if embedding is normalized (magnitude should be close to 1)
      const magnitude = Math.sqrt(
        result.embedding.reduce((sum, val) => sum + val * val, 0)
      );
      expect(magnitude).toBeCloseTo(1, 5);
    });

    it('should not normalize embeddings when disabled', async () => {
      generator.updateConfig({ normalize: false });
      const text = 'Test text';
      const result = await generator.generateEmbedding(text);

      // Should return original embedding values
      expect(result.embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    });

    it('should throw error for empty text', async () => {
      await expect(generator.generateEmbedding('')).rejects.toThrow(
        EmbeddingError
      );
      await expect(generator.generateEmbedding('   ')).rejects.toThrow(
        'Invalid input text'
      );
    });

    it('should throw error if model not loaded', async () => {
      const uninitializedGenerator = new EmbeddingGenerator({
        model: mockModel,
      });

      await expect(
        uninitializedGenerator.generateEmbedding('test')
      ).rejects.toThrow(EmbeddingError);
      await expect(
        uninitializedGenerator.generateEmbedding('test')
      ).rejects.toThrow('Model not loaded');
    });

    it('should throw error for text exceeding max tokens', async () => {
      const { LlamaContext } = require('@pocketpalai/llama.rn');
      const mockContext = LlamaContext.mock.results[0].value;
      
      // Reset the mock to ensure clean state
      mockContext.tokenize.mockReset();
      mockContext.tokenize.mockResolvedValueOnce(new Array(600).fill(1)); // 600 tokens

      await expect(
        generator.generateEmbedding('very long text')
      ).rejects.toThrow(EmbeddingError);
    });
  });

  describe('generateBatchEmbeddings', () => {
    let mockChunks: DocumentChunk[];

    beforeEach(async () => {
      await generator.initialize();
      
      mockChunks = [
        {
          id: 'chunk-1',
          text: 'First chunk text',
          metadata: {
            chunkIndex: 0,
            startChar: 0,
            endChar: 16,
            startToken: 0,
            endToken: 3,
            tokenCount: 3,
            pageNumber: 1,
            sentenceCount: 1,
            hasCompleteSentences: true,
          },
        },
        {
          id: 'chunk-2',
          text: 'Second chunk text',
          metadata: {
            chunkIndex: 1,
            startChar: 17,
            endChar: 34,
            startToken: 4,
            endToken: 7,
            tokenCount: 3,
            pageNumber: 1,
            sentenceCount: 1,
            hasCompleteSentences: true,
          },
        },
        {
          id: 'chunk-3',
          text: 'Third chunk text',
          metadata: {
            chunkIndex: 2,
            startChar: 35,
            endChar: 51,
            startToken: 8,
            endToken: 11,
            tokenCount: 3,
            pageNumber: 1,
            sentenceCount: 1,
            hasCompleteSentences: true,
          },
        },
      ];
    });

    it('should process all chunks successfully', async () => {
      const result = await generator.generateBatchEmbeddings(mockChunks);

      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
      expect(result.totalProcessingTime).toBeGreaterThan(0);
    });

    it('should call progress callback during processing', async () => {
      await generator.generateBatchEmbeddings(mockChunks);

      expect(mockProgressCallback).toHaveBeenCalled();
      
      // Check that final progress is called
      const finalCall = mockProgressCallback.mock.calls[mockProgressCallback.mock.calls.length - 1][0];
      expect(finalCall.processed).toBe(3);
      expect(finalCall.total).toBe(3);
      expect(finalCall.cancelled).toBe(false);
    });

    it('should handle partial failures gracefully', async () => {
      const { LlamaContext } = require('@pocketpalai/llama.rn');
      const mockContext = LlamaContext.mock.results[0].value;
      
      // Make second chunk fail
      mockContext.getEmbedding
        .mockResolvedValueOnce([0.1, 0.2, 0.3, 0.4, 0.5]) // chunk-1 success
        .mockRejectedValueOnce(new Error('Processing failed')) // chunk-2 failure
        .mockResolvedValueOnce([0.1, 0.2, 0.3, 0.4, 0.5]); // chunk-3 success

      const result = await generator.generateBatchEmbeddings(mockChunks);

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
      expect(result.results).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].chunkId).toBe('chunk-2');
    });

    it('should respect batch size configuration', async () => {
      generator.updateConfig({ batchSize: 2 });
      
      await generator.generateBatchEmbeddings(mockChunks);

      // Should process in 2 batches: [chunk-1, chunk-2] and [chunk-3]
      expect(mockProgressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          processed: 0,
          total: 3,
        })
      );
      expect(mockProgressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          processed: 2,
          total: 3,
        })
      );
    });

    it('should handle cancellation', async () => {
      // Cancel immediately before processing
      generator.cancel();

      await expect(
        generator.generateBatchEmbeddings(mockChunks)
      ).rejects.toThrow(EmbeddingError);
    });
  });

  describe('configuration management', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        batchSize: 15,
        maxTokens: 1024,
        normalize: false,
      };

      generator.updateConfig(newConfig);
      const config = generator.getConfig();

      expect(config.batchSize).toBe(15);
      expect(config.maxTokens).toBe(1024);
      expect(config.normalize).toBe(false);
      expect(config.modelId).toBe(mockModel.id); // Should preserve existing values
    });

    it('should return copy of config to prevent external modification', () => {
      const config1 = generator.getConfig();
      const config2 = generator.getConfig();

      expect(config1).not.toBe(config2); // Different objects
      expect(config1).toEqual(config2); // Same values
    });
  });

  describe('resource management', () => {
    it('should track processing state correctly', async () => {
      await generator.initialize();
      expect(generator.isCurrentlyProcessing()).toBe(false);

      const singleChunk = {
        id: 'test-chunk',
        text: 'Test text',
        metadata: {
          chunkIndex: 0,
          startChar: 0,
          endChar: 9,
          startToken: 0,
          endToken: 2,
          tokenCount: 2,
          pageNumber: 1,
          sentenceCount: 1,
          hasCompleteSentences: true,
        },
      };

      const processingPromise = generator.generateBatchEmbeddings([singleChunk]);
      expect(generator.isCurrentlyProcessing()).toBe(true);

      await processingPromise;
      expect(generator.isCurrentlyProcessing()).toBe(false);
    });

    it('should dispose resources properly', async () => {
      await generator.initialize();
      const { LlamaContext } = require('@pocketpalai/llama.rn');
      const mockContext = LlamaContext.mock.results[0].value;

      await generator.dispose();

      expect(mockContext.release).toHaveBeenCalled();
      expect(generator.isCurrentlyProcessing()).toBe(false);
    });

    it('should handle disposal errors gracefully', async () => {
      await generator.initialize();
      const { LlamaContext } = require('@pocketpalai/llama.rn');
      const mockContext = LlamaContext.mock.results[0].value;
      mockContext.release.mockRejectedValueOnce(new Error('Release failed'));

      // Should not throw
      await expect(generator.dispose()).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should call error callback on failures', async () => {
      await generator.initialize();
      const { LlamaContext } = require('@pocketpalai/llama.rn');
      const mockContext = LlamaContext.mock.results[0].value;
      mockContext.getEmbedding.mockRejectedValueOnce(new Error('Model error'));

      try {
        await generator.generateEmbedding('test text');
      } catch (error) {
        // Expected to throw
      }

      expect(mockErrorCallback).toHaveBeenCalledWith(
        expect.any(EmbeddingError)
      );
    });

    it('should create proper EmbeddingError instances', async () => {
      const uninitializedGenerator = new EmbeddingGenerator({
        model: mockModel,
      });

      try {
        await uninitializedGenerator.generateEmbedding('test');
      } catch (error) {
        expect(error).toBeInstanceOf(EmbeddingError);
        expect((error as EmbeddingError).code).toBe(
          EmbeddingErrorCodes.MODEL_NOT_LOADED
        );
      }
    });
  });

  describe('vector normalization', () => {
    it('should normalize vectors correctly', async () => {
      await generator.initialize();
      
      const text = 'Test normalization';
      const result = await generator.generateEmbedding(text);

      // Calculate magnitude
      const magnitude = Math.sqrt(
        result.embedding.reduce((sum, val) => sum + val * val, 0)
      );

      expect(magnitude).toBeCloseTo(1.0, 5);
    });

    it('should handle zero vectors in normalization', async () => {
      await generator.initialize();
      const { LlamaContext } = require('@pocketpalai/llama.rn');
      const mockContext = LlamaContext.mock.results[0].value;
      mockContext.getEmbedding.mockResolvedValueOnce([0, 0, 0, 0, 0]);

      const result = await generator.generateEmbedding('test');

      // Should return original zero vector
      expect(result.embedding).toEqual([0, 0, 0, 0, 0]);
    });
  });
});