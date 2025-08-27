import {ContextAssembler} from '../ContextAssembler';
import {SearchResult} from '../types';

describe('ContextAssembler', () => {
  let contextAssembler: ContextAssembler;
  let mockResults: SearchResult[];

  beforeEach(() => {
    contextAssembler = new ContextAssembler();
    
    mockResults = [
      {
        chunkId: 'chunk1',
        documentId: 'doc1',
        documentName: 'Document 1',
        text: 'This is the first chunk of text with important information.',
        pageNumber: 1,
        chunkIndex: 0,
        similarity: 0.95,
        startChar: 0,
        endChar: 57,
        tokenCount: 12,
      },
      {
        chunkId: 'chunk2',
        documentId: 'doc1',
        documentName: 'Document 1',
        text: 'This is the second chunk with additional context.',
        pageNumber: 1,
        chunkIndex: 1,
        similarity: 0.87,
        startChar: 58,
        endChar: 106,
        tokenCount: 10,
      },
      {
        chunkId: 'chunk3',
        documentId: 'doc2',
        documentName: 'Document 2',
        text: 'This chunk is from a different document entirely.',
        pageNumber: 2,
        chunkIndex: 0,
        similarity: 0.82,
        startChar: 0,
        endChar: 48,
        tokenCount: 9,
      },
    ];
  });

  describe('assembleContext', () => {
    it('should assemble context from search results', () => {
      const query = 'test query';
      const assembled = contextAssembler.assembleContext(query, mockResults);

      expect(assembled.text).toContain('Document 1');
      expect(assembled.text).toContain('first chunk');
      expect(assembled.text).toContain('second chunk');
      expect(assembled.sources).toHaveLength(3);
      expect(assembled.totalTokens).toBeGreaterThan(0);
      expect(assembled.truncated).toBe(false);
      expect(assembled.assemblyTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty results', () => {
      const query = 'test query';
      const assembled = contextAssembler.assembleContext(query, []);

      expect(assembled.text).toBe('');
      expect(assembled.sources).toHaveLength(0);
      expect(assembled.totalTokens).toBe(0);
      expect(assembled.truncated).toBe(false);
    });

    it('should truncate when exceeding token limit', () => {
      const smallTokenLimit = 20;
      const assembler = new ContextAssembler({ maxTokens: smallTokenLimit });
      
      const assembled = assembler.assembleContext('test query', mockResults);

      expect(assembled.truncated).toBe(true);
      expect(assembled.totalTokens).toBeLessThanOrEqual(smallTokenLimit);
      expect(assembled.sources.length).toBeLessThan(mockResults.length);
    });

    it('should preserve order when configured', () => {
      const assembler = new ContextAssembler({ preserveOrder: true });
      const assembled = assembler.assembleContext('test query', mockResults);

      // Results should be sorted by similarity (highest first)
      expect(assembled.sources[0].similarity).toBeGreaterThanOrEqual(assembled.sources[1].similarity);
    });

    it('should add separators when configured', () => {
      const assembler = new ContextAssembler({ addSeparators: true });
      const assembled = assembler.assembleContext('test query', mockResults);

      expect(assembled.text).toContain('---');
    });

    it('should include metadata when configured', () => {
      const assembler = new ContextAssembler({ includeMetadata: true });
      const assembled = assembler.assembleContext('test query', mockResults);

      expect(assembled.text).toContain('[Document 1, Page 1]');
      expect(assembled.text).toContain('[Document 2, Page 2]');
    });

    it('should deduplicate content when configured', () => {
      const duplicateResults = [
        mockResults[0],
        { ...mockResults[0], chunkId: 'chunk1_duplicate' }, // Same text, different ID
        mockResults[1],
      ];

      const assembler = new ContextAssembler({ deduplicateContent: true });
      const assembled = assembler.assembleContext('test query', duplicateResults);

      expect(assembled.sources.length).toBeLessThan(duplicateResults.length);
    });
  });

  describe('createRetrievalContext', () => {
    it('should create retrieval context with metadata', () => {
      const query = 'test query';
      const processingTime = 150;
      
      const context = contextAssembler.createRetrievalContext(query, mockResults, processingTime);

      expect(context.query).toBe(query);
      expect(context.results).toEqual(mockResults);
      expect(context.totalChunks).toBe(mockResults.length);
      expect(context.processingTime).toBe(processingTime);
      expect(context.averageSimilarity).toBeCloseTo(0.88, 2);
      expect(context.maxSimilarity).toBe(0.95);
      expect(context.minSimilarity).toBe(0.82);
    });

    it('should handle empty results in retrieval context', () => {
      const query = 'test query';
      const processingTime = 50;
      
      const context = contextAssembler.createRetrievalContext(query, [], processingTime);

      expect(context.results).toHaveLength(0);
      expect(context.totalChunks).toBe(0);
      expect(context.averageSimilarity).toBe(0);
      expect(context.maxSimilarity).toBe(0);
      expect(context.minSimilarity).toBe(0);
    });
  });

  describe('formatContextWithCitations', () => {
    it('should format context with citations', () => {
      const assembled = contextAssembler.assembleContext('test query', mockResults);
      const formatted = contextAssembler.formatContextWithCitations(assembled);

      expect(formatted).toContain('Sources:');
      expect(formatted).toContain('[1] Document 1');
      expect(formatted).toContain('[2] Document 1');
      expect(formatted).toContain('[3] Document 2');
      expect(formatted).toContain('Similarity:');
    });

    it('should return original text when no sources', () => {
      const assembled = contextAssembler.assembleContext('test query', []);
      const formatted = contextAssembler.formatContextWithCitations(assembled);

      expect(formatted).toBe('');
    });

    it('should not include citations when metadata disabled', () => {
      const assembler = new ContextAssembler({ includeMetadata: false });
      const assembled = assembler.assembleContext('test query', mockResults);
      const formatted = assembler.formatContextWithCitations(assembled);

      expect(formatted).not.toContain('Sources:');
    });
  });

  describe('estimateTokenCount', () => {
    it('should estimate token count correctly', () => {
      const text = 'This is a sample text with multiple words.';
      const tokenCount = ContextAssembler.estimateTokenCount(text);

      expect(tokenCount).toBeGreaterThan(0);
      expect(tokenCount).toBeLessThan(text.length); // Should be less than character count
      expect(tokenCount).toBeCloseTo(11, 1); // Approximately 4 chars per token
    });

    it('should handle empty text', () => {
      const tokenCount = ContextAssembler.estimateTokenCount('');
      expect(tokenCount).toBe(0);
    });

    it('should handle very long text', () => {
      const longText = 'word '.repeat(1000);
      const tokenCount = ContextAssembler.estimateTokenCount(longText);

      expect(tokenCount).toBeGreaterThan(1000);
      expect(tokenCount).toBeLessThan(longText.length);
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        maxTokens: 1000,
        preserveOrder: false,
        addSeparators: false,
      };

      contextAssembler.updateConfig(newConfig);
      const config = contextAssembler.getConfig();

      expect(config.maxTokens).toBe(1000);
      expect(config.preserveOrder).toBe(false);
      expect(config.addSeparators).toBe(false);
    });

    it('should return current configuration', () => {
      const config = contextAssembler.getConfig();

      expect(config).toHaveProperty('maxTokens');
      expect(config).toHaveProperty('preserveOrder');
      expect(config).toHaveProperty('addSeparators');
      expect(config).toHaveProperty('includeMetadata');
      expect(config).toHaveProperty('deduplicateContent');
    });

    it('should merge partial configuration updates', () => {
      const originalConfig = contextAssembler.getConfig();
      
      contextAssembler.updateConfig({ maxTokens: 1500 });
      const updatedConfig = contextAssembler.getConfig();

      expect(updatedConfig.maxTokens).toBe(1500);
      expect(updatedConfig.preserveOrder).toBe(originalConfig.preserveOrder);
      expect(updatedConfig.addSeparators).toBe(originalConfig.addSeparators);
    });
  });

  describe('performance', () => {
    it('should handle large number of results efficiently', () => {
      const largeResults: SearchResult[] = Array.from({length: 100}, (_, i) => ({
        chunkId: `chunk${i}`,
        documentId: `doc${Math.floor(i / 10)}`,
        documentName: `Document ${Math.floor(i / 10)}`,
        text: `This is chunk ${i} with some sample text content.`,
        pageNumber: Math.floor(i / 5) + 1,
        chunkIndex: i,
        similarity: 0.9 - (i * 0.001),
        startChar: i * 50,
        endChar: (i + 1) * 50,
        tokenCount: 10,
      }));

      const startTime = Date.now();
      const assembled = contextAssembler.assembleContext('test query', largeResults);
      const endTime = Date.now();

      expect(assembled.sources.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle very long text chunks', () => {
      const longTextResults: SearchResult[] = [{
        chunkId: 'chunk1',
        documentId: 'doc1',
        documentName: 'Document 1',
        text: 'word '.repeat(10000), // Very long text
        pageNumber: 1,
        chunkIndex: 0,
        similarity: 0.95,
        startChar: 0,
        endChar: 50000,
        tokenCount: 10000,
      }];

      const startTime = Date.now();
      const assembled = contextAssembler.assembleContext('test query', longTextResults);
      const endTime = Date.now();

      expect(assembled.sources.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(500); // Should handle efficiently
    });
  });
});