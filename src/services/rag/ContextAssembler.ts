import {
  SearchResult,
  RetrievalContext,
  ContextAssemblyConfig,
  AssembledContext,
  SimilaritySearchError,
  SimilaritySearchErrorCodes,
} from './types';

export class ContextAssembler {
  private config: ContextAssemblyConfig;

  constructor(config?: Partial<ContextAssemblyConfig>) {
    this.config = {
      maxTokens: 2000,
      preserveOrder: true,
      addSeparators: true,
      includeMetadata: true,
      deduplicateContent: false,
      ...config,
    };
  }

  /**
   * Assemble search results into coherent context
   */
  assembleContext(
    query: string,
    results: SearchResult[]
  ): AssembledContext {
    const startTime = Date.now();

    try {
      if (results.length === 0) {
        return {
          text: '',
          sources: [],
          totalTokens: 0,
          truncated: false,
          assemblyTime: Date.now() - startTime,
        };
      }

      // Deduplicate if enabled
      const processedResults = this.config.deduplicateContent
        ? this.deduplicateResults(results)
        : results;

      // Sort results if preserveOrder is enabled
      const sortedResults = this.config.preserveOrder
        ? this.sortResultsByRelevance(processedResults)
        : processedResults;

      // Assemble text with token limit
      const assembled = this.assembleText(sortedResults);

      return {
        text: assembled.text,
        sources: assembled.sources,
        totalTokens: assembled.totalTokens,
        truncated: assembled.truncated,
        assemblyTime: Date.now() - startTime,
      };
    } catch (error) {
      throw new SimilaritySearchError(
        `Context assembly failed: ${error.message}`,
        SimilaritySearchErrorCodes.PROCESSING_FAILED,
        error
      );
    }
  }

  /**
   * Create retrieval context with metadata
   */
  createRetrievalContext(
    query: string,
    results: SearchResult[],
    processingTime: number
  ): RetrievalContext {
    const similarities = results.map(r => r.similarity);
    
    return {
      query,
      results,
      totalChunks: results.length,
      processingTime,
      averageSimilarity: similarities.length > 0 
        ? similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length 
        : 0,
      maxSimilarity: similarities.length > 0 ? Math.max(...similarities) : 0,
      minSimilarity: similarities.length > 0 ? Math.min(...similarities) : 0,
    };
  }

  /**
   * Format context for display with citations
   */
  formatContextWithCitations(context: AssembledContext): string {
    if (!context.sources.length) {
      return context.text;
    }

    let formattedText = context.text;

    if (this.config.includeMetadata) {
      const citations = this.generateCitations(context.sources);
      formattedText += '\n\n' + citations;
    }

    return formattedText;
  }

  /**
   * Update assembly configuration
   */
  updateConfig(config: Partial<ContextAssemblyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ContextAssemblyConfig {
    return { ...this.config };
  }

  /**
   * Estimate token count for text (simple approximation)
   */
  public static estimateTokenCount(text: string): number {
    // Simple approximation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    const deduplicated: SearchResult[] = [];

    for (const result of results) {
      // Create a hash of the text content for deduplication
      const contentHash = this.hashText(result.text);
      
      if (!seen.has(contentHash)) {
        seen.add(contentHash);
        deduplicated.push(result);
      }
    }

    return deduplicated;
  }

  private sortResultsByRelevance(results: SearchResult[]): SearchResult[] {
    return [...results].sort((a, b) => {
      // Primary sort by similarity
      if (a.similarity !== b.similarity) {
        return b.similarity - a.similarity;
      }
      
      // Secondary sort by document and chunk order
      if (a.documentId !== b.documentId) {
        return a.documentName.localeCompare(b.documentName);
      }
      
      return a.chunkIndex - b.chunkIndex;
    });
  }

  private assembleText(results: SearchResult[]): {
    text: string;
    sources: SearchResult[];
    totalTokens: number;
    truncated: boolean;
  } {
    const textParts: string[] = [];
    const includedSources: SearchResult[] = [];
    let totalTokens = 0;
    let truncated = false;

    for (const result of results) {
      const chunkText = this.formatChunkText(result);
      const chunkTokens = ContextAssembler.estimateTokenCount(chunkText);

      // Check if adding this chunk would exceed the token limit
      if (totalTokens + chunkTokens > this.config.maxTokens && textParts.length > 0) {
        truncated = true;
        break;
      }

      textParts.push(chunkText);
      includedSources.push(result);
      totalTokens += chunkTokens;
    }

    const separator = this.config.addSeparators ? '\n\n---\n\n' : '\n\n';
    const assembledText = textParts.join(separator);

    return {
      text: assembledText,
      sources: includedSources,
      totalTokens,
      truncated,
    };
  }

  private formatChunkText(result: SearchResult): string {
    let text = result.text.trim();

    if (this.config.includeMetadata) {
      const metadata = `[${result.documentName}, Page ${result.pageNumber}]`;
      text = `${metadata}\n${text}`;
    }

    return text;
  }

  private generateCitations(sources: SearchResult[]): string {
    const citations = sources.map((source, index) => {
      const citationNumber = index + 1;
      return `[${citationNumber}] ${source.documentName}, Page ${source.pageNumber} (Similarity: ${(source.similarity * 100).toFixed(1)}%)`;
    });

    return `Sources:\n${citations.join('\n')}`;
  }

  private hashText(text: string): string {
    // Simple hash function for deduplication
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
}