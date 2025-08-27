import { TextProcessor } from './TextProcessor';

export interface ChunkingConfig {
  chunkSize: number; // Target chunk size in tokens
  overlap: number; // Overlap between chunks in tokens
  preserveSentences: boolean; // Whether to preserve sentence boundaries
  minChunkSize: number; // Minimum chunk size in tokens
  maxChunkSize: number; // Maximum chunk size in tokens
}

export interface ChunkMetadata {
  chunkIndex: number;
  startChar: number;
  endChar: number;
  startToken: number;
  endToken: number;
  tokenCount: number;
  pageNumber?: number;
  sentenceCount: number;
  hasCompleteSentences: boolean;
}

export interface DocumentChunk {
  id: string;
  text: string;
  metadata: ChunkMetadata;
}

export interface ChunkingResult {
  chunks: DocumentChunk[];
  totalChunks: number;
  totalTokens: number;
  averageChunkSize: number;
  processingTime: number;
}

export interface SentenceBoundary {
  start: number;
  end: number;
  text: string;
}

export class TextChunker {
  private static readonly DEFAULT_CONFIG: ChunkingConfig = {
    chunkSize: 512,
    overlap: 50,
    preserveSentences: true,
    minChunkSize: 50,
    maxChunkSize: 1024,
  };

  private config: ChunkingConfig;

  constructor(config: Partial<ChunkingConfig> = {}) {
    this.config = { ...TextChunker.DEFAULT_CONFIG, ...config };
    this.validateConfig();
  }

  /**
   * Chunk text into manageable segments with metadata
   */
  public chunkText(
    text: string,
    documentId: string,
    pageNumbers?: number[]
  ): ChunkingResult {
    const startTime = Date.now();
    
    // Validate input
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    // Clean text first
    const cleanedResult = TextProcessor.cleanText(text, {
      removeExtraWhitespace: true,
      normalizeLineBreaks: true,
      removeSpecialCharacters: false,
      preserveFormatting: true,
    });

    const cleanedText = cleanedResult.cleanedText;
    const tokens = this.tokenize(cleanedText);
    const sentences = this.config.preserveSentences 
      ? this.findSentenceBoundaries(cleanedText)
      : [];

    const chunks: DocumentChunk[] = [];
    let currentPosition = 0;
    let chunkIndex = 0;

    while (currentPosition < tokens.length) {
      const chunk = this.createChunk(
        cleanedText,
        tokens,
        sentences,
        currentPosition,
        chunkIndex,
        documentId,
        pageNumbers
      );

      chunks.push(chunk);
      
      // Move to next position with overlap
      const nextPosition = currentPosition + chunk.metadata.tokenCount - this.config.overlap;
      currentPosition = Math.max(nextPosition, currentPosition + 1);
      chunkIndex++;

      // Safety check to prevent infinite loops
      if (chunkIndex > 10000) {
        throw new Error('Chunking process exceeded maximum iterations');
      }
    }

    const processingTime = Date.now() - startTime;
    const totalTokens = tokens.length;
    const averageChunkSize = chunks.length > 0 
      ? chunks.reduce((sum, chunk) => sum + chunk.metadata.tokenCount, 0) / chunks.length
      : 0;

    return {
      chunks,
      totalChunks: chunks.length,
      totalTokens,
      averageChunkSize,
      processingTime,
    };
  }

  /**
   * Create a single chunk with metadata
   */
  private createChunk(
    text: string,
    tokens: string[],
    sentences: SentenceBoundary[],
    startTokenIndex: number,
    chunkIndex: number,
    documentId: string,
    pageNumbers?: number[]
  ): DocumentChunk {
    let endTokenIndex = Math.min(
      startTokenIndex + this.config.chunkSize,
      tokens.length
    );

    // Adjust boundaries to preserve sentences if enabled
    if (this.config.preserveSentences && sentences.length > 0) {
      const adjustedBoundaries = this.adjustForSentenceBoundaries(
        text,
        tokens,
        sentences,
        startTokenIndex,
        endTokenIndex
      );
      endTokenIndex = adjustedBoundaries.endTokenIndex;
    }

    // Ensure minimum chunk size
    if (endTokenIndex - startTokenIndex < this.config.minChunkSize && 
        endTokenIndex < tokens.length) {
      endTokenIndex = Math.min(
        startTokenIndex + this.config.minChunkSize,
        tokens.length
      );
    }

    // Ensure maximum chunk size
    if (endTokenIndex - startTokenIndex > this.config.maxChunkSize) {
      endTokenIndex = startTokenIndex + this.config.maxChunkSize;
    }

    const chunkTokens = tokens.slice(startTokenIndex, endTokenIndex);
    const chunkText = chunkTokens.join(' ');
    
    // Find character positions
    const startChar = this.findCharacterPosition(text, tokens, startTokenIndex);
    const endChar = this.findCharacterPosition(text, tokens, endTokenIndex);
    
    // Count sentences in chunk
    const chunkSentences = sentences.filter(
      sentence => sentence.start >= startChar && sentence.end <= endChar
    );
    
    // Determine if chunk has complete sentences
    const hasCompleteSentences = chunkSentences.length > 0 && 
      chunkSentences.every(sentence => 
        sentence.start >= startChar && sentence.end <= endChar
      );

    // Estimate page number (simple heuristic)
    const pageNumber = pageNumbers && pageNumbers.length > 0
      ? this.estimatePageNumber(startChar, text.length, pageNumbers)
      : undefined;

    const metadata: ChunkMetadata = {
      chunkIndex,
      startChar,
      endChar,
      startToken: startTokenIndex,
      endToken: endTokenIndex,
      tokenCount: chunkTokens.length,
      pageNumber,
      sentenceCount: chunkSentences.length,
      hasCompleteSentences,
    };

    return {
      id: `${documentId}_chunk_${chunkIndex}`,
      text: chunkText.trim(),
      metadata,
    };
  }

  /**
   * Adjust chunk boundaries to preserve sentence boundaries
   */
  private adjustForSentenceBoundaries(
    text: string,
    tokens: string[],
    sentences: SentenceBoundary[],
    startTokenIndex: number,
    endTokenIndex: number
  ): { endTokenIndex: number } {
    const startChar = this.findCharacterPosition(text, tokens, startTokenIndex);
    const endChar = this.findCharacterPosition(text, tokens, endTokenIndex);

    // Find the last complete sentence that fits within the chunk
    let lastCompleteSentenceEnd = startChar;
    
    for (const sentence of sentences) {
      if (sentence.start >= startChar && sentence.end <= endChar) {
        lastCompleteSentenceEnd = sentence.end;
      } else if (sentence.start >= startChar && sentence.start < endChar) {
        // Sentence starts in chunk but doesn't end in it
        break;
      }
    }

    // If we found a complete sentence, adjust the end boundary
    if (lastCompleteSentenceEnd > startChar) {
      const adjustedEndTokenIndex = this.findTokenPosition(text, tokens, lastCompleteSentenceEnd);
      
      // Only adjust if it doesn't make the chunk too small
      if (adjustedEndTokenIndex - startTokenIndex >= this.config.minChunkSize) {
        return { endTokenIndex: adjustedEndTokenIndex };
      }
    }

    return { endTokenIndex };
  }

  /**
   * Find sentence boundaries in text
   */
  private findSentenceBoundaries(text: string): SentenceBoundary[] {
    const sentences: SentenceBoundary[] = [];
    
    // Enhanced sentence boundary detection
    const sentenceRegex = /[.!?]+(?:\s+|$)/g;
    let match;
    let lastEnd = 0;

    while ((match = sentenceRegex.exec(text)) !== null) {
      const end = match.index + match[0].length;
      
      // Skip if this looks like an abbreviation or decimal number
      if (this.isLikelyAbbreviation(text, match.index)) {
        continue;
      }

      const sentenceText = text.slice(lastEnd, end).trim();
      
      if (sentenceText.length > 0) {
        sentences.push({
          start: lastEnd,
          end: end,
          text: sentenceText,
        });
        lastEnd = end;
      }
    }

    // Add final sentence if text doesn't end with punctuation
    if (lastEnd < text.length) {
      const finalText = text.slice(lastEnd).trim();
      if (finalText.length > 0) {
        sentences.push({
          start: lastEnd,
          end: text.length,
          text: finalText,
        });
      }
    }

    return sentences;
  }

  /**
   * Check if a period is likely part of an abbreviation
   */
  private isLikelyAbbreviation(text: string, position: number): boolean {
    // Look for common abbreviation patterns
    const beforePeriod = text.slice(Math.max(0, position - 10), position);
    const afterPeriod = text.slice(position + 1, Math.min(text.length, position + 10));

    // Common abbreviations
    const abbreviations = [
      'Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Inc', 'Ltd', 'Corp', 'Co',
      'etc', 'vs', 'e.g', 'i.e', 'cf', 'et al', 'Ph.D', 'M.D',
      'U.S', 'U.K', 'N.Y', 'L.A'
    ];

    for (const abbr of abbreviations) {
      if (beforePeriod.toLowerCase().endsWith(abbr.toLowerCase())) {
        return true;
      }
    }

    // Check for decimal numbers
    if (/\d$/.test(beforePeriod) && /^\d/.test(afterPeriod)) {
      return true;
    }

    // Check for single letter abbreviations
    if (/\s[A-Z]$/.test(beforePeriod) && /^\s+[A-Z]/.test(afterPeriod)) {
      return true;
    }

    return false;
  }

  /**
   * Simple tokenization (split by whitespace and punctuation)
   */
  private tokenize(text: string): string[] {
    // Simple tokenization - split by whitespace and separate punctuation
    return text
      .replace(/([.!?;:,()[\]{}"])/g, ' $1 ')
      .split(/\s+/)
      .filter(token => token.length > 0);
  }

  /**
   * Count tokens in text
   */
  public countTokens(text: string): number {
    return this.tokenize(text).length;
  }

  /**
   * Find character position for a given token index
   */
  private findCharacterPosition(text: string, tokens: string[], tokenIndex: number): number {
    if (tokenIndex <= 0) return 0;
    if (tokenIndex >= tokens.length) return text.length;

    // Reconstruct text up to the token index to find character position
    const partialTokens = tokens.slice(0, tokenIndex);
    const partialText = partialTokens.join(' ');
    
    // Find this partial text in the original text
    const position = text.indexOf(partialText);
    return position >= 0 ? position : 0;
  }

  /**
   * Find token position for a given character index
   */
  private findTokenPosition(text: string, tokens: string[], charIndex: number): number {
    if (charIndex <= 0) return 0;
    if (charIndex >= text.length) return tokens.length;

    // Binary search for efficiency
    let left = 0;
    let right = tokens.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const midCharPos = this.findCharacterPosition(text, tokens, mid);

      if (midCharPos < charIndex) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    return left;
  }

  /**
   * Estimate page number based on character position
   */
  private estimatePageNumber(charPosition: number, totalChars: number, pageNumbers: number[]): number {
    if (pageNumbers.length === 0) return 1;
    if (pageNumbers.length === 1) return pageNumbers[0];

    // Simple linear interpolation
    const ratio = charPosition / totalChars;
    const pageIndex = Math.floor(ratio * pageNumbers.length);
    return pageNumbers[Math.min(pageIndex, pageNumbers.length - 1)];
  }

  /**
   * Validate chunking configuration
   */
  private validateConfig(): void {
    if (this.config.chunkSize <= 0) {
      throw new Error('Chunk size must be positive');
    }
    
    if (this.config.overlap < 0) {
      throw new Error('Overlap cannot be negative');
    }
    
    if (this.config.overlap >= this.config.chunkSize) {
      throw new Error('Overlap must be less than chunk size');
    }
    
    if (this.config.minChunkSize <= 0) {
      throw new Error('Minimum chunk size must be positive');
    }
    
    if (this.config.maxChunkSize < this.config.chunkSize) {
      throw new Error('Maximum chunk size must be at least equal to chunk size');
    }
    
    if (this.config.minChunkSize > this.config.chunkSize) {
      throw new Error('Minimum chunk size cannot be greater than chunk size');
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): ChunkingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<ChunkingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.validateConfig();
  }

  /**
   * Get statistics about a text before chunking
   */
  public analyzeText(text: string): {
    totalCharacters: number;
    totalTokens: number;
    estimatedChunks: number;
    sentences: number;
    averageTokensPerSentence: number;
  } {
    const tokens = this.tokenize(text);
    const sentences = this.findSentenceBoundaries(text);
    const estimatedChunks = Math.ceil(tokens.length / (this.config.chunkSize - this.config.overlap));
    
    return {
      totalCharacters: text.length,
      totalTokens: tokens.length,
      estimatedChunks,
      sentences: sentences.length,
      averageTokensPerSentence: sentences.length > 0 ? tokens.length / sentences.length : 0,
    };
  }
}