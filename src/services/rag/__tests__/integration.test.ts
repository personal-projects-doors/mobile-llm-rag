import {SimilaritySearch} from '../SimilaritySearch';
import {ContextAssembler} from '../ContextAssembler';
import {SearchResult} from '../types';

describe('RAG Integration Tests', () => {
  describe('SimilaritySearch + ContextAssembler Integration', () => {
    it('should work together to process search results', () => {
      // Mock search results
      const mockResults: SearchResult[] = [
        {
          chunkId: 'chunk1',
          documentId: 'doc1',
          documentName: 'Medical Textbook',
          text: 'The heart is a muscular organ that pumps blood throughout the body.',
          pageNumber: 45,
          chunkIndex: 0,
          similarity: 0.95,
          startChar: 0,
          endChar: 67,
          tokenCount: 15,
        },
        {
          chunkId: 'chunk2',
          documentId: 'doc1',
          documentName: 'Medical Textbook',
          text: 'Blood circulation is essential for delivering oxygen and nutrients to tissues.',
          pageNumber: 46,
          chunkIndex: 1,
          similarity: 0.87,
          startChar: 68,
          endChar: 143,
          tokenCount: 14,
        },
        {
          chunkId: 'chunk3',
          documentId: 'doc2',
          documentName: 'Anatomy Reference',
          text: 'The cardiovascular system consists of the heart, blood vessels, and blood.',
          pageNumber: 12,
          chunkIndex: 0,
          similarity: 0.82,
          startChar: 0,
          endChar: 73,
          tokenCount: 13,
        },
      ];

      // Test context assembly
      const contextAssembler = new ContextAssembler({
        maxTokens: 100,
        includeMetadata: true,
        addSeparators: true,
      });

      const assembled = contextAssembler.assembleContext('heart function', mockResults);

      expect(assembled.sources).toHaveLength(3);
      expect(assembled.text).toContain('Medical Textbook');
      expect(assembled.text).toContain('heart');
      expect(assembled.text).toContain('---'); // Separator
      expect(assembled.totalTokens).toBeGreaterThan(0);
      expect(assembled.truncated).toBe(false);

      // Test retrieval context creation
      const retrievalContext = contextAssembler.createRetrievalContext(
        'heart function',
        mockResults,
        150
      );

      expect(retrievalContext.query).toBe('heart function');
      expect(retrievalContext.results).toEqual(mockResults);
      expect(retrievalContext.totalChunks).toBe(3);
      expect(retrievalContext.processingTime).toBe(150);
      expect(retrievalContext.averageSimilarity).toBeCloseTo(0.88, 2);
      expect(retrievalContext.maxSimilarity).toBe(0.95);
      expect(retrievalContext.minSimilarity).toBe(0.82);
    });

    it('should handle cosine similarity calculations correctly', () => {
      // Test various similarity scenarios
      const testCases = [
        {
          name: 'identical vectors',
          vectorA: [1, 0, 0, 0],
          vectorB: [1, 0, 0, 0],
          expected: 1.0,
        },
        {
          name: 'orthogonal vectors',
          vectorA: [1, 0, 0, 0],
          vectorB: [0, 1, 0, 0],
          expected: 0.0,
        },
        {
          name: 'opposite vectors',
          vectorA: [1, 0, 0, 0],
          vectorB: [-1, 0, 0, 0],
          expected: -1.0,
        },
        {
          name: 'similar vectors',
          vectorA: [0.8, 0.6, 0, 0],
          vectorB: [0.6, 0.8, 0, 0],
          expected: 0.96, // cos(θ) where θ is small
        },
      ];

      testCases.forEach(({ name, vectorA, vectorB, expected }) => {
        const similarity = SimilaritySearch.cosineSimilarity(vectorA, vectorB);
        expect(similarity).toBeCloseTo(expected, 2);
      });
    });

    it('should handle batch similarity calculations efficiently', () => {
      const queryVector = [1, 0, 0, 0];
      const documentVectors = [
        [1, 0, 0, 0], // identical
        [0.9, 0.1, 0, 0], // very similar
        [0.5, 0.5, 0, 0], // moderately similar
        [0, 1, 0, 0], // orthogonal
        [-1, 0, 0, 0], // opposite
      ];

      const similarities = SimilaritySearch.batchCosineSimilarity(queryVector, documentVectors);

      expect(similarities).toHaveLength(5);
      expect(similarities[0]).toBeCloseTo(1.0, 5); // identical
      expect(similarities[1]).toBeGreaterThan(0.9); // very similar
      expect(similarities[2]).toBeCloseTo(0.7071, 3); // moderately similar
      expect(similarities[3]).toBeCloseTo(0.0, 5); // orthogonal
      expect(similarities[4]).toBeCloseTo(-1.0, 5); // opposite

      // Verify they're sorted by similarity (descending)
      const sortedIndices = similarities
        .map((sim, idx) => ({ sim, idx }))
        .sort((a, b) => b.sim - a.sim)
        .map(item => item.idx);

      expect(sortedIndices[0]).toBe(0); // identical should be first
      expect(sortedIndices[1]).toBe(1); // very similar should be second
      expect(sortedIndices[sortedIndices.length - 1]).toBe(4); // opposite should be last
    });

    it('should handle token estimation and truncation correctly', () => {
      const longResults: SearchResult[] = Array.from({length: 10}, (_, i) => ({
        chunkId: `chunk${i}`,
        documentId: 'doc1',
        documentName: 'Long Document',
        text: `This is chunk ${i} with some content that takes up space. `.repeat(10),
        pageNumber: i + 1,
        chunkIndex: i,
        similarity: 0.9 - (i * 0.05),
        startChar: i * 100,
        endChar: (i + 1) * 100,
        tokenCount: 50,
      }));

      const contextAssembler = new ContextAssembler({
        maxTokens: 200, // Small limit to force truncation
        includeMetadata: true,
      });

      const assembled = contextAssembler.assembleContext('test query', longResults);

      expect(assembled.truncated).toBe(true);
      expect(assembled.totalTokens).toBeLessThanOrEqual(200);
      expect(assembled.sources.length).toBeLessThan(longResults.length);
      expect(assembled.sources.length).toBeGreaterThan(0);
    });

    it('should format citations correctly', () => {
      const results: SearchResult[] = [
        {
          chunkId: 'chunk1',
          documentId: 'doc1',
          documentName: 'Medical Reference',
          text: 'Sample medical text content.',
          pageNumber: 42,
          chunkIndex: 0,
          similarity: 0.95,
          startChar: 0,
          endChar: 27,
          tokenCount: 5,
        },
        {
          chunkId: 'chunk2',
          documentId: 'doc2',
          documentName: 'Anatomy Guide',
          text: 'Additional anatomical information.',
          pageNumber: 15,
          chunkIndex: 0,
          similarity: 0.88,
          startChar: 0,
          endChar: 33,
          tokenCount: 4,
        },
      ];

      const contextAssembler = new ContextAssembler({
        includeMetadata: true,
      });

      const assembled = contextAssembler.assembleContext('medical query', results);
      const formatted = contextAssembler.formatContextWithCitations(assembled);

      expect(formatted).toContain('Sources:');
      expect(formatted).toContain('[1] Medical Reference, Page 42');
      expect(formatted).toContain('[2] Anatomy Guide, Page 15');
      expect(formatted).toContain('Similarity: 95.0%');
      expect(formatted).toContain('Similarity: 88.0%');
    });
  });

  describe('Performance Tests', () => {
    it('should handle large-scale similarity calculations efficiently', () => {
      const dimension = 384; // Common embedding dimension
      const numVectors = 1000;

      // Generate random vectors
      const queryVector = Array.from({length: dimension}, () => Math.random() - 0.5);
      const documentVectors = Array.from({length: numVectors}, () =>
        Array.from({length: dimension}, () => Math.random() - 0.5)
      );

      const startTime = Date.now();
      const similarities = SimilaritySearch.batchCosineSimilarity(queryVector, documentVectors);
      const endTime = Date.now();

      expect(similarities).toHaveLength(numVectors);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds

      // Verify all similarities are valid
      similarities.forEach(sim => {
        expect(sim).toBeGreaterThanOrEqual(-1);
        expect(sim).toBeLessThanOrEqual(1);
        expect(typeof sim).toBe('number');
        expect(isNaN(sim)).toBe(false);
      });
    });

    it('should handle context assembly for many results efficiently', () => {
      const manyResults: SearchResult[] = Array.from({length: 500}, (_, i) => ({
        chunkId: `chunk${i}`,
        documentId: `doc${Math.floor(i / 10)}`,
        documentName: `Document ${Math.floor(i / 10)}`,
        text: `Content for chunk ${i} with relevant information about the topic.`,
        pageNumber: (i % 20) + 1,
        chunkIndex: i,
        similarity: 0.95 - (i * 0.001),
        startChar: i * 50,
        endChar: (i + 1) * 50,
        tokenCount: 12,
      }));

      const contextAssembler = new ContextAssembler({
        maxTokens: 2000,
        deduplicateContent: true,
      });

      const startTime = Date.now();
      const assembled = contextAssembler.assembleContext('test query', manyResults);
      const endTime = Date.now();

      expect(assembled.sources.length).toBeGreaterThan(0);
      expect(assembled.totalTokens).toBeLessThanOrEqual(2000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});