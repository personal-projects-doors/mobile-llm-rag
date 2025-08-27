import {Database} from '@nozbe/watermelondb';
import {SimilaritySearch} from '../SimilaritySearch';
import {
  SearchQuery,
  SimilaritySearchError,
  SimilaritySearchErrorCodes,
} from '../types';

// Mock WatermelonDB
jest.mock('@nozbe/watermelondb');

describe('SimilaritySearch', () => {
  let mockDatabase: jest.Mocked<Database>;
  let similaritySearch: SimilaritySearch;

  beforeEach(() => {
    mockDatabase = {
      get: jest.fn(),
    } as any;

    similaritySearch = new SimilaritySearch(mockDatabase);
  });

  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity correctly for identical vectors', () => {
      const vectorA = [1, 2, 3];
      const vectorB = [1, 2, 3];
      
      const similarity = SimilaritySearch.cosineSimilarity(vectorA, vectorB);
      
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should calculate cosine similarity correctly for orthogonal vectors', () => {
      const vectorA = [1, 0, 0];
      const vectorB = [0, 1, 0];
      
      const similarity = SimilaritySearch.cosineSimilarity(vectorA, vectorB);
      
      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should calculate cosine similarity correctly for opposite vectors', () => {
      const vectorA = [1, 2, 3];
      const vectorB = [-1, -2, -3];
      
      const similarity = SimilaritySearch.cosineSimilarity(vectorA, vectorB);
      
      expect(similarity).toBeCloseTo(-1.0, 5);
    });

    it('should handle zero vectors', () => {
      const vectorA = [0, 0, 0];
      const vectorB = [1, 2, 3];
      
      const similarity = SimilaritySearch.cosineSimilarity(vectorA, vectorB);
      
      expect(similarity).toBe(0);
    });

    it('should throw error for vectors of different lengths', () => {
      const vectorA = [1, 2, 3];
      const vectorB = [1, 2];
      
      expect(() => {
        SimilaritySearch.cosineSimilarity(vectorA, vectorB);
      }).toThrow('Vectors must have the same length');
    });

    it('should calculate similarity for real-world example', () => {
      const vectorA = [0.1, 0.2, 0.3, 0.4];
      const vectorB = [0.2, 0.1, 0.4, 0.3];
      
      const similarity = SimilaritySearch.cosineSimilarity(vectorA, vectorB);
      
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
      expect(similarity).toBeCloseTo(0.93, 1);
    });
  });

  describe('batchCosineSimilarity', () => {
    it('should calculate similarities for multiple vectors', () => {
      const queryVector = [1, 0, 0];
      const vectors = [
        [1, 0, 0], // identical
        [0, 1, 0], // orthogonal
        [-1, 0, 0], // opposite
        [0.5, 0.5, 0], // partial match
      ];
      
      const similarities = SimilaritySearch.batchCosineSimilarity(queryVector, vectors);
      
      expect(similarities).toHaveLength(4);
      expect(similarities[0]).toBeCloseTo(1.0, 5);
      expect(similarities[1]).toBeCloseTo(0.0, 5);
      expect(similarities[2]).toBeCloseTo(-1.0, 5);
      expect(similarities[3]).toBeCloseTo(0.7071, 3);
    });

    it('should handle empty vector array', () => {
      const queryVector = [1, 0, 0];
      const vectors: number[][] = [];
      
      const similarities = SimilaritySearch.batchCosineSimilarity(queryVector, vectors);
      
      expect(similarities).toHaveLength(0);
    });
  });

  describe('search', () => {
    let mockChunksCollection: any;
    let mockChunks: any[];

    beforeEach(() => {
      mockChunks = [
        {
          id: 'chunk1',
          documentId: 'doc1',
          text: 'Sample text 1',
          pageNumber: 1,
          chunkIndex: 0,
          startChar: 0,
          endChar: 13,
          tokenCount: 3,
          embeddingVector: [1, 0, 0],
        },
        {
          id: 'chunk2',
          documentId: 'doc1',
          text: 'Sample text 2',
          pageNumber: 1,
          chunkIndex: 1,
          startChar: 14,
          endChar: 27,
          tokenCount: 3,
          embeddingVector: [0, 1, 0],
        },
      ];

      mockChunksCollection = {
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue(mockChunks),
        }),
        find: jest.fn(),
      };

      const mockDocumentsCollection = {
        find: jest.fn().mockResolvedValue({
          id: 'doc1',
          name: 'Test Document',
        }),
      };

      mockDatabase.get.mockImplementation((tableName: string) => {
        if (tableName === 'rag_chunks') return mockChunksCollection;
        if (tableName === 'rag_documents') return mockDocumentsCollection;
        return null;
      });
    });

    it('should perform successful search', async () => {
      const query: SearchQuery = {
        text: 'test query',
        embedding: [1, 0, 0],
        maxResults: 5,
        minSimilarity: 0.5,
      };

      const results = await similaritySearch.search(query);

      expect(results).toHaveLength(1); // Only chunk1 should match with similarity 1.0
      expect(results[0].chunkId).toBe('chunk1');
      expect(results[0].similarity).toBeCloseTo(1.0, 5);
    });

    it('should filter by minimum similarity', async () => {
      const query: SearchQuery = {
        text: 'test query',
        embedding: [1, 0, 0],
        maxResults: 5,
        minSimilarity: 0.9, // High threshold
      };

      const results = await similaritySearch.search(query);

      expect(results).toHaveLength(1); // Only chunk1 should pass the threshold
      expect(results[0].similarity).toBeGreaterThanOrEqual(0.9);
    });

    it('should limit results by maxResults', async () => {
      // Add more chunks
      mockChunks.push({
        id: 'chunk3',
        documentId: 'doc1',
        text: 'Sample text 3',
        pageNumber: 2,
        chunkIndex: 2,
        startChar: 28,
        endChar: 41,
        tokenCount: 3,
        embeddingVector: [0.9, 0.1, 0],
      });

      const query: SearchQuery = {
        text: 'test query',
        embedding: [1, 0, 0],
        maxResults: 1,
        minSimilarity: 0.5,
      };

      const results = await similaritySearch.search(query);

      expect(results).toHaveLength(1);
    });

    it('should throw error for invalid query', async () => {
      const query: SearchQuery = {
        text: '',
        maxResults: 5,
        minSimilarity: 0.5,
      };

      await expect(similaritySearch.search(query)).rejects.toThrow(SimilaritySearchError);
    });

    it('should throw error when no embeddings found', async () => {
      mockChunksCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      const query: SearchQuery = {
        text: 'test query',
        embedding: [1, 0, 0],
        maxResults: 5,
        minSimilarity: 0.5,
      };

      await expect(similaritySearch.search(query)).rejects.toThrow(
        expect.objectContaining({
          code: SimilaritySearchErrorCodes.NO_EMBEDDINGS,
        })
      );
    });

    it('should validate similarity threshold', async () => {
      const query: SearchQuery = {
        text: 'test query',
        embedding: [1, 0, 0],
        maxResults: 5,
        minSimilarity: 1.5, // Invalid threshold
      };

      await expect(similaritySearch.search(query)).rejects.toThrow(
        expect.objectContaining({
          code: SimilaritySearchErrorCodes.INVALID_SIMILARITY_THRESHOLD,
        })
      );
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        maxResults: 10,
        minSimilarity: 0.8,
      };

      similaritySearch.updateConfig(newConfig);
      const config = similaritySearch.getConfig();

      expect(config.maxResults).toBe(10);
      expect(config.minSimilarity).toBe(0.8);
    });

    it('should return current configuration', () => {
      const config = similaritySearch.getConfig();

      expect(config).toHaveProperty('maxResults');
      expect(config).toHaveProperty('minSimilarity');
      expect(config).toHaveProperty('enableRanking');
      expect(config).toHaveProperty('rankingWeights');
    });
  });

  describe('performance', () => {
    it('should handle large number of vectors efficiently', () => {
      const queryVector = Array.from({length: 384}, () => Math.random());
      const vectors = Array.from({length: 1000}, () => 
        Array.from({length: 384}, () => Math.random())
      );

      const startTime = Date.now();
      const similarities = SimilaritySearch.batchCosineSimilarity(queryVector, vectors);
      const endTime = Date.now();

      expect(similarities).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle high-dimensional vectors', () => {
      const dimension = 1536; // Common embedding dimension
      const vectorA = Array.from({length: dimension}, () => Math.random());
      const vectorB = Array.from({length: dimension}, () => Math.random());

      const startTime = Date.now();
      const similarity = SimilaritySearch.cosineSimilarity(vectorA, vectorB);
      const endTime = Date.now();

      expect(typeof similarity).toBe('number');
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });
  });
});