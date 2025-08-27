import {Database} from '@nozbe/watermelondb';
import {RetrievalSystem} from '../RetrievalSystem';
import {EmbeddingGenerator} from '../EmbeddingGenerator';
import {SimilaritySearchError} from '../types';

// Mock dependencies
jest.mock('@nozbe/watermelondb');
jest.mock('../EmbeddingGenerator');
jest.mock('../SimilaritySearch');
jest.mock('../ContextAssembler');

describe('RetrievalSystem', () => {
  let mockDatabase: jest.Mocked<Database>;
  let mockEmbeddingGenerator: jest.Mocked<EmbeddingGenerator>;
  let retrievalSystem: RetrievalSystem;

  beforeEach(() => {
    mockDatabase = {
      get: jest.fn(),
    } as any;

    mockEmbeddingGenerator = {
      generateEmbedding: jest.fn(),
    } as any;

    // Mock successful embedding generation
    mockEmbeddingGenerator.generateEmbedding.mockResolvedValue({
      embedding: [0.1, 0.2, 0.3],
      tokenCount: 5,
      processingTime: 100,
    });

    retrievalSystem = new RetrievalSystem(mockDatabase, mockEmbeddingGenerator);
  });

  describe('retrieve', () => {
    it('should perform end-to-end retrieval successfully', async () => {
      const queryText = 'test query';
      const options = {
        maxResults: 5,
        minSimilarity: 0.7,
      };

      // Mock the internal search method
      const mockSearch = jest.fn().mockResolvedValue([
        {
          chunkId: 'chunk1',
          documentId: 'doc1',
          documentName: 'Test Document',
          text: 'Sample text',
          pageNumber: 1,
          chunkIndex: 0,
          similarity: 0.95,
          startChar: 0,
          endChar: 11,
          tokenCount: 3,
        },
      ]);

      // Mock the context assembler
      const mockCreateContext = jest.fn().mockReturnValue({
        query: queryText,
        results: [
          {
            chunkId: 'chunk1',
            documentId: 'doc1',
            documentName: 'Test Document',
            text: 'Sample text',
            pageNumber: 1,
            chunkIndex: 0,
            similarity: 0.95,
            startChar: 0,
            endChar: 11,
            tokenCount: 3,
          },
        ],
        totalChunks: 1,
        processingTime: 100,
        averageSimilarity: 0.95,
        maxSimilarity: 0.95,
        minSimilarity: 0.95,
      });

      // Replace the search method and context assembler
      (retrievalSystem as any).similaritySearch = { search: mockSearch };
      (retrievalSystem as any).contextAssembler = { createRetrievalContext: mockCreateContext };

      const context = await retrievalSystem.retrieve(queryText, options);

      expect(mockEmbeddingGenerator.generateEmbedding).toHaveBeenCalledWith(queryText);
      expect(mockSearch).toHaveBeenCalledWith({
        text: queryText,
        embedding: [0.1, 0.2, 0.3],
        maxResults: 5,
        minSimilarity: 0.7,
        documentIds: undefined,
      });

      expect(context.query).toBe(queryText);
      expect(context.results).toHaveLength(1);
      expect(context.totalChunks).toBe(1);
      expect(context.processingTime).toBeGreaterThan(0);
    });

    it('should handle embedding generation failure', async () => {
      mockEmbeddingGenerator.generateEmbedding.mockRejectedValue(
        new Error('Embedding generation failed')
      );

      await expect(retrievalSystem.retrieve('test query')).rejects.toThrow(
        SimilaritySearchError
      );
    });

    it('should use default options when not provided', async () => {
      const mockSearch = jest.fn().mockResolvedValue([]);
      (retrievalSystem as any).similaritySearch = { search: mockSearch };

      await retrievalSystem.retrieve('test query');

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          maxResults: 5,
          minSimilarity: 0.7,
        })
      );
    });
  });

  describe('retrieveAndAssemble', () => {
    it('should retrieve and assemble context', async () => {
      const mockResults = [
        {
          chunkId: 'chunk1',
          documentId: 'doc1',
          documentName: 'Test Document',
          text: 'Sample text',
          pageNumber: 1,
          chunkIndex: 0,
          similarity: 0.95,
          startChar: 0,
          endChar: 11,
          tokenCount: 3,
        },
      ];

      const mockSearch = jest.fn().mockResolvedValue(mockResults);
      const mockAssemble = jest.fn().mockReturnValue({
        text: 'Assembled context',
        sources: mockResults,
        totalTokens: 50,
        truncated: false,
        assemblyTime: 10,
      });

      (retrievalSystem as any).similaritySearch = { search: mockSearch };
      (retrievalSystem as any).contextAssembler = { 
        assembleContext: mockAssemble,
        createRetrievalContext: jest.fn().mockReturnValue({
          query: 'test query',
          results: mockResults,
          totalChunks: 1,
          processingTime: 100,
          averageSimilarity: 0.95,
          maxSimilarity: 0.95,
          minSimilarity: 0.95,
        }),
      };

      const result = await retrievalSystem.retrieveAndAssemble('test query');

      expect(result.context).toBeDefined();
      expect(result.assembled).toBeDefined();
      expect(result.assembled.text).toBe('Assembled context');
      expect(mockAssemble).toHaveBeenCalledWith('test query', mockResults);
    });
  });

  describe('searchWithEmbedding', () => {
    it('should search with pre-computed embedding', async () => {
      const queryEmbedding = [0.1, 0.2, 0.3];
      const mockResults = [
        {
          chunkId: 'chunk1',
          documentId: 'doc1',
          documentName: 'Test Document',
          text: 'Sample text',
          pageNumber: 1,
          chunkIndex: 0,
          similarity: 0.95,
          startChar: 0,
          endChar: 11,
          tokenCount: 3,
        },
      ];

      const mockSearch = jest.fn().mockResolvedValue(mockResults);
      (retrievalSystem as any).similaritySearch = { search: mockSearch };

      const results = await retrievalSystem.searchWithEmbedding(queryEmbedding);

      expect(mockSearch).toHaveBeenCalledWith({
        text: '',
        embedding: queryEmbedding,
        maxResults: 5,
        minSimilarity: 0.7,
        documentIds: undefined,
      });
      expect(results).toEqual(mockResults);
    });
  });

  describe('getSimilarDocuments', () => {
    it('should group results by document', async () => {
      const mockResults = [
        {
          chunkId: 'chunk1',
          documentId: 'doc1',
          documentName: 'Document 1',
          text: 'Sample text 1',
          pageNumber: 1,
          chunkIndex: 0,
          similarity: 0.95,
          startChar: 0,
          endChar: 13,
          tokenCount: 3,
        },
        {
          chunkId: 'chunk2',
          documentId: 'doc1',
          documentName: 'Document 1',
          text: 'Sample text 2',
          pageNumber: 1,
          chunkIndex: 1,
          similarity: 0.85,
          startChar: 14,
          endChar: 27,
          tokenCount: 3,
        },
        {
          chunkId: 'chunk3',
          documentId: 'doc2',
          documentName: 'Document 2',
          text: 'Sample text 3',
          pageNumber: 1,
          chunkIndex: 0,
          similarity: 0.75,
          startChar: 0,
          endChar: 13,
          tokenCount: 3,
        },
      ];

      const mockSearch = jest.fn().mockResolvedValue(mockResults);
      const mockCreateContext = jest.fn().mockReturnValue({
        query: 'test query',
        results: mockResults,
        totalChunks: 3,
        processingTime: 100,
        averageSimilarity: 0.85,
        maxSimilarity: 0.95,
        minSimilarity: 0.75,
      });

      (retrievalSystem as any).similaritySearch = { search: mockSearch };
      (retrievalSystem as any).contextAssembler = { createRetrievalContext: mockCreateContext };

      const documents = await retrievalSystem.getSimilarDocuments('test query');

      expect(documents).toHaveLength(2);
      expect(documents[0].documentId).toBe('doc1');
      expect(documents[0].chunks).toHaveLength(2);
      expect(documents[0].averageSimilarity).toBeCloseTo(0.9, 1);
      expect(documents[1].documentId).toBe('doc2');
      expect(documents[1].chunks).toHaveLength(1);
    });

    it('should sort documents by average similarity', async () => {
      const mockResults = [
        {
          chunkId: 'chunk1',
          documentId: 'doc1',
          documentName: 'Document 1',
          text: 'Sample text 1',
          pageNumber: 1,
          chunkIndex: 0,
          similarity: 0.7, // Lower similarity
          startChar: 0,
          endChar: 13,
          tokenCount: 3,
        },
        {
          chunkId: 'chunk2',
          documentId: 'doc2',
          documentName: 'Document 2',
          text: 'Sample text 2',
          pageNumber: 1,
          chunkIndex: 0,
          similarity: 0.9, // Higher similarity
          startChar: 0,
          endChar: 13,
          tokenCount: 3,
        },
      ];

      const mockSearch = jest.fn().mockResolvedValue(mockResults);
      const mockCreateContext = jest.fn().mockReturnValue({
        query: 'test query',
        results: mockResults,
        totalChunks: 2,
        processingTime: 100,
        averageSimilarity: 0.8,
        maxSimilarity: 0.9,
        minSimilarity: 0.7,
      });

      (retrievalSystem as any).similaritySearch = { search: mockSearch };
      (retrievalSystem as any).contextAssembler = { createRetrievalContext: mockCreateContext };

      const documents = await retrievalSystem.getSimilarDocuments('test query');

      expect(documents[0].documentId).toBe('doc2'); // Higher similarity should be first
      expect(documents[1].documentId).toBe('doc1');
    });
  });

  describe('configuration', () => {
    it('should update system configuration', () => {
      const config = {
        similarity: { maxResults: 10 },
        assembly: { maxTokens: 1000 },
      };

      const mockUpdateSimilarity = jest.fn();
      const mockUpdateAssembly = jest.fn();

      (retrievalSystem as any).similaritySearch = { updateConfig: mockUpdateSimilarity };
      (retrievalSystem as any).contextAssembler = { updateConfig: mockUpdateAssembly };

      retrievalSystem.updateConfig(config);

      expect(mockUpdateSimilarity).toHaveBeenCalledWith({ maxResults: 10 });
      expect(mockUpdateAssembly).toHaveBeenCalledWith({ maxTokens: 1000 });
    });

    it('should get current configuration', () => {
      const mockSimilarityConfig = { maxResults: 5, minSimilarity: 0.7 };
      const mockAssemblyConfig = { maxTokens: 2000, preserveOrder: true };

      (retrievalSystem as any).similaritySearch = { getConfig: () => mockSimilarityConfig };
      (retrievalSystem as any).contextAssembler = { getConfig: () => mockAssemblyConfig };

      const config = retrievalSystem.getConfig();

      expect(config.similarity).toEqual(mockSimilarityConfig);
      expect(config.assembly).toEqual(mockAssemblyConfig);
    });
  });

  describe('getStatistics', () => {
    it('should return system statistics', async () => {
      const mockDocumentsCollection = {
        query: () => ({ fetchCount: () => Promise.resolve(5) }),
      };
      const mockChunksCollection = {
        query: jest.fn().mockImplementation((filter) => ({
          fetchCount: () => {
            // Return different counts based on filter
            if (filter && filter.column === 'embedding') {
              return Promise.resolve(45); // Chunks with embeddings
            }
            return Promise.resolve(50); // Total chunks
          },
        })),
      };

      mockDatabase.get.mockImplementation((tableName: string) => {
        if (tableName === 'rag_documents') return mockDocumentsCollection;
        if (tableName === 'rag_chunks') return mockChunksCollection;
        return null;
      });

      const stats = await retrievalSystem.getStatistics();

      expect(stats.totalDocuments).toBe(5);
      expect(stats.totalChunks).toBe(50);
      expect(stats.chunksWithEmbeddings).toBe(45);
      expect(stats.averageChunksPerDocument).toBe(10);
    });

    it('should handle zero documents', async () => {
      const mockDocumentsCollection = {
        query: () => ({ fetchCount: () => Promise.resolve(0) }),
      };
      const mockChunksCollection = {
        query: () => ({ fetchCount: () => Promise.resolve(0) }),
      };

      mockDatabase.get.mockImplementation((tableName: string) => {
        if (tableName === 'rag_documents') return mockDocumentsCollection;
        if (tableName === 'rag_chunks') return mockChunksCollection;
        return null;
      });

      const stats = await retrievalSystem.getStatistics();

      expect(stats.totalDocuments).toBe(0);
      expect(stats.averageChunksPerDocument).toBe(0);
    });
  });
});