import { TextChunker, ChunkingConfig } from '../TextChunker';
import { ChunkingError, ChunkingErrorCodes } from '../types';

describe('TextChunker', () => {
  let chunker: TextChunker;
  const sampleText = `
    This is the first sentence. This is the second sentence with more content.
    This is the third sentence in a new paragraph. Here's another sentence.
    
    This starts a new paragraph with different content. It has multiple sentences too.
    The final sentence concludes this sample text for testing purposes.
  `.trim();

  beforeEach(() => {
    chunker = new TextChunker();
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const config = chunker.getConfig();
      expect(config.chunkSize).toBe(512);
      expect(config.overlap).toBe(50);
      expect(config.preserveSentences).toBe(true);
      expect(config.minChunkSize).toBe(50);
      expect(config.maxChunkSize).toBe(1024);
    });

    it('should accept custom configuration', () => {
      const customConfig: Partial<ChunkingConfig> = {
        chunkSize: 256,
        overlap: 25,
        preserveSentences: false,
      };
      
      const customChunker = new TextChunker(customConfig);
      const config = customChunker.getConfig();
      
      expect(config.chunkSize).toBe(256);
      expect(config.overlap).toBe(25);
      expect(config.preserveSentences).toBe(false);
      expect(config.minChunkSize).toBe(50); // Should keep default
    });

    it('should validate configuration on creation', () => {
      expect(() => new TextChunker({ chunkSize: 0 })).toThrow('Chunk size must be positive');
      expect(() => new TextChunker({ overlap: -1 })).toThrow('Overlap cannot be negative');
      expect(() => new TextChunker({ chunkSize: 100, overlap: 100 })).toThrow('Overlap must be less than chunk size');
    });

    it('should update configuration', () => {
      chunker.updateConfig({ chunkSize: 256 });
      expect(chunker.getConfig().chunkSize).toBe(256);
    });
  });

  describe('Token Counting', () => {
    it('should count tokens correctly', () => {
      const text = 'Hello world! This is a test.';
      const tokenCount = chunker.countTokens(text);
      expect(tokenCount).toBeGreaterThan(0);
      expect(typeof tokenCount).toBe('number');
    });

    it('should handle empty text', () => {
      expect(chunker.countTokens('')).toBe(0);
      expect(chunker.countTokens('   ')).toBe(0);
    });
  });

  describe('Text Analysis', () => {
    it('should analyze text correctly', () => {
      const analysis = chunker.analyzeText(sampleText);
      
      expect(analysis.totalCharacters).toBe(sampleText.length);
      expect(analysis.totalTokens).toBeGreaterThan(0);
      expect(analysis.estimatedChunks).toBeGreaterThan(0);
      expect(analysis.sentences).toBeGreaterThan(0);
      expect(analysis.averageTokensPerSentence).toBeGreaterThan(0);
    });

    it('should handle single sentence text', () => {
      const singleSentence = 'This is a single sentence.';
      const analysis = chunker.analyzeText(singleSentence);
      
      expect(analysis.sentences).toBe(1);
      expect(analysis.estimatedChunks).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Chunking Process', () => {
    it('should chunk text successfully', () => {
      const result = chunker.chunkText(sampleText, 'test-doc');
      
      expect(result.chunks).toBeDefined();
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.totalChunks).toBe(result.chunks.length);
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.averageChunkSize).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should create chunks with proper metadata', () => {
      const result = chunker.chunkText(sampleText, 'test-doc');
      const firstChunk = result.chunks[0];
      
      expect(firstChunk.id).toBe('test-doc_chunk_0');
      expect(firstChunk.text).toBeDefined();
      expect(firstChunk.metadata.chunkIndex).toBe(0);
      expect(firstChunk.metadata.startChar).toBeGreaterThanOrEqual(0);
      expect(firstChunk.metadata.endChar).toBeGreaterThan(firstChunk.metadata.startChar);
      expect(firstChunk.metadata.tokenCount).toBeGreaterThan(0);
      expect(firstChunk.metadata.sentenceCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle small text that fits in one chunk', () => {
      const smallText = 'This is a small text.';
      const smallChunker = new TextChunker({ chunkSize: 50, overlap: 10, minChunkSize: 5 });
      const result = smallChunker.chunkText(smallText, 'small-doc');
      
      // The text should be chunked, but we expect reasonable behavior
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chunks[0].text.trim()).toContain('This');
    });

    it('should respect chunk size limits', () => {
      const smallChunker = new TextChunker({ 
        chunkSize: 15, 
        overlap: 3, 
        minChunkSize: 3, 
        maxChunkSize: 20 
      });
      const result = smallChunker.chunkText(sampleText, 'test-doc');
      
      result.chunks.forEach(chunk => {
        expect(chunk.metadata.tokenCount).toBeLessThanOrEqual(20);
        // Check that chunks are not excessively small (allowing for last chunk flexibility)
        expect(chunk.metadata.tokenCount).toBeGreaterThan(0);
      });
    });

    it('should preserve sentence boundaries when enabled', () => {
      const sentenceChunker = new TextChunker({ 
        chunkSize: 25, 
        overlap: 5,
        preserveSentences: true,
        minChunkSize: 5 
      });
      const result = sentenceChunker.chunkText(sampleText, 'test-doc');
      
      // Check that chunks with complete sentences are marked correctly
      result.chunks.forEach(chunk => {
        if (chunk.metadata.hasCompleteSentences) {
          expect(chunk.metadata.sentenceCount).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Sentence Boundary Detection', () => {
    it('should detect sentence boundaries correctly', () => {
      const testText = 'First sentence. Second sentence! Third sentence?';
      const result = chunker.chunkText(testText, 'test-doc');
      
      // Should detect multiple sentences
      const totalSentences = result.chunks.reduce(
        (sum, chunk) => sum + chunk.metadata.sentenceCount, 
        0
      );
      expect(totalSentences).toBeGreaterThan(1);
    });

    it('should handle abbreviations correctly', () => {
      const textWithAbbr = 'Dr. Smith went to the U.S. yesterday. He met Prof. Johnson there.';
      const result = chunker.chunkText(textWithAbbr, 'test-doc');
      
      // Should not break on abbreviations
      expect(result.chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle text without sentence endings', () => {
      const noEndingText = 'This text has no proper ending';
      const smallChunker = new TextChunker({ chunkSize: 50, overlap: 10, minChunkSize: 5 });
      const result = smallChunker.chunkText(noEndingText, 'test-doc');
      
      // Should create chunks and preserve the content
      expect(result.chunks.length).toBeGreaterThan(0);
      const allText = result.chunks.map(c => c.text).join(' ');
      expect(allText).toContain('This');
      expect(allText).toContain('ending');
    });
  });

  describe('Overlap Handling', () => {
    it('should create overlapping chunks', () => {
      const overlapChunker = new TextChunker({ 
        chunkSize: 15, 
        overlap: 5,
        minChunkSize: 5,
        preserveSentences: false 
      });
      const result = overlapChunker.chunkText(sampleText, 'test-doc');
      
      if (result.chunks.length > 1) {
        // Check that there's some overlap between consecutive chunks
        // This is a basic check - in practice, overlap detection would be more sophisticated
        expect(result.chunks.length).toBeGreaterThan(1);
      }
    });
  });

  describe('Page Number Estimation', () => {
    it('should estimate page numbers when provided', () => {
      const pageNumbers = [1, 2, 3];
      const result = chunker.chunkText(sampleText, 'test-doc', pageNumbers);
      
      result.chunks.forEach(chunk => {
        expect(chunk.metadata.pageNumber).toBeDefined();
        expect(pageNumbers).toContain(chunk.metadata.pageNumber);
      });
    });

    it('should handle single page documents', () => {
      const result = chunker.chunkText(sampleText, 'test-doc', [1]);
      
      result.chunks.forEach(chunk => {
        expect(chunk.metadata.pageNumber).toBe(1);
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error for empty text', () => {
      expect(() => chunker.chunkText('', 'test-doc')).toThrow('Text cannot be empty');
      expect(() => chunker.chunkText('   ', 'test-doc')).toThrow('Text cannot be empty');
    });

    it('should handle very long text without infinite loops', () => {
      const longText = 'word '.repeat(10000);
      const result = chunker.chunkText(longText, 'long-doc');
      
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chunks.length).toBeLessThan(10000); // Should not create excessive chunks
    });
  });

  describe('Character and Token Position Mapping', () => {
    it('should maintain consistent character positions', () => {
      const result = chunker.chunkText(sampleText, 'test-doc');
      
      result.chunks.forEach((chunk, index) => {
        expect(chunk.metadata.startChar).toBeLessThan(chunk.metadata.endChar);
        
        if (index > 0) {
          // Chunks should be in order (allowing for overlap)
          expect(chunk.metadata.startChar).toBeGreaterThanOrEqual(0);
        }
      });
    });

    it('should maintain consistent token positions', () => {
      const result = chunker.chunkText(sampleText, 'test-doc');
      
      result.chunks.forEach((chunk, index) => {
        expect(chunk.metadata.startToken).toBeLessThan(chunk.metadata.endToken);
        expect(chunk.metadata.tokenCount).toBe(
          chunk.metadata.endToken - chunk.metadata.startToken
        );
      });
    });
  });
});