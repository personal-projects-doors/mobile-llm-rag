import {MessageType} from '../../utils/types';
import {SearchResult} from './types';

export interface CitationContext {
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkText: string;
  fullContext: string;
  startChar: number;
  endChar: number;
  similarity: number;
  chunkIndex: number;
}

export interface CitationGroup {
  documentId: string;
  documentName: string;
  citations: MessageType.RAGCitation[];
  totalReferences: number;
}

export interface CitationStats {
  totalCitations: number;
  uniqueDocuments: number;
  averageSimilarity: number;
  citationsByDocument: CitationGroup[];
}

/**
 * Manages citation creation, tracking, and formatting for RAG responses
 */
export class CitationManager {
  private citationCache = new Map<string, CitationContext>();

  /**
   * Convert search results to citation format
   */
  createCitations(results: SearchResult[]): MessageType.RAGCitation[] {
    return results.map((result, index) => {
      const citation: MessageType.RAGCitation = {
        documentId: result.documentId,
        documentName: result.documentName,
        pageNumber: result.pageNumber,
        chunkText: result.text,
        similarity: result.similarity,
        startChar: result.startChar,
        endChar: result.endChar,
      };

      // Cache citation context for later retrieval
      const cacheKey = this.getCitationKey(citation);
      this.citationCache.set(cacheKey, {
        ...citation,
        fullContext: this.expandContext(result),
        chunkIndex: result.chunkIndex,
      });

      return citation;
    });
  }

  /**
   * Get expanded context for a citation
   */
  getCitationContext(citation: MessageType.RAGCitation): CitationContext | null {
    const key = this.getCitationKey(citation);
    return this.citationCache.get(key) || null;
  }

  /**
   * Group citations by document
   */
  groupCitationsByDocument(citations: MessageType.RAGCitation[]): CitationGroup[] {
    const groups = new Map<string, CitationGroup>();

    citations.forEach(citation => {
      const existing = groups.get(citation.documentId);
      if (existing) {
        existing.citations.push(citation);
        existing.totalReferences++;
      } else {
        groups.set(citation.documentId, {
          documentId: citation.documentId,
          documentName: citation.documentName,
          citations: [citation],
          totalReferences: 1,
        });
      }
    });

    return Array.from(groups.values()).sort((a, b) => 
      b.totalReferences - a.totalReferences
    );
  }

  /**
   * Calculate citation statistics
   */
  getCitationStats(citations: MessageType.RAGCitation[]): CitationStats {
    const uniqueDocuments = new Set(citations.map(c => c.documentId)).size;
    const averageSimilarity = citations.reduce((sum, c) => sum + c.similarity, 0) / citations.length;
    const citationsByDocument = this.groupCitationsByDocument(citations);

    return {
      totalCitations: citations.length,
      uniqueDocuments,
      averageSimilarity,
      citationsByDocument,
    };
  }

  /**
   * Format citations for display in text
   */
  formatInlineCitations(citations: MessageType.RAGCitation[]): string {
    if (citations.length === 0) return '';

    const groups = this.groupCitationsByDocument(citations);
    const formatted = groups.map((group, index) => {
      const citationNumber = index + 1;
      return `[${citationNumber}] ${group.documentName}`;
    });

    return `\n\nSources: ${formatted.join(', ')}`;
  }

  /**
   * Format detailed citations for display
   */
  formatDetailedCitations(citations: MessageType.RAGCitation[]): string {
    if (citations.length === 0) return '';

    const groups = this.groupCitationsByDocument(citations);
    const formatted = groups.map((group, index) => {
      const citationNumber = index + 1;
      const pages = [...new Set(group.citations.map(c => c.pageNumber))].sort((a, b) => a - b);
      const pageText = pages.length === 1 ? `Page ${pages[0]}` : `Pages ${pages.join(', ')}`;
      const avgSimilarity = group.citations.reduce((sum, c) => sum + c.similarity, 0) / group.citations.length;
      
      return `[${citationNumber}] ${group.documentName}, ${pageText} (${Math.round(avgSimilarity * 100)}% relevance)`;
    });

    return `Sources:\n${formatted.join('\n')}`;
  }

  /**
   * Validate citation integrity
   */
  validateCitation(citation: MessageType.RAGCitation): boolean {
    return !!(
      citation.documentId &&
      citation.documentName &&
      citation.pageNumber > 0 &&
      citation.chunkText &&
      citation.similarity >= 0 &&
      citation.similarity <= 1 &&
      citation.startChar >= 0 &&
      citation.endChar > citation.startChar
    );
  }

  /**
   * Deduplicate citations based on content similarity
   */
  deduplicateCitations(citations: MessageType.RAGCitation[], threshold = 0.9): MessageType.RAGCitation[] {
    const deduplicated: MessageType.RAGCitation[] = [];
    
    for (const citation of citations) {
      const isDuplicate = deduplicated.some(existing => 
        existing.documentId === citation.documentId &&
        existing.pageNumber === citation.pageNumber &&
        this.calculateTextSimilarity(existing.chunkText, citation.chunkText) > threshold
      );
      
      if (!isDuplicate) {
        deduplicated.push(citation);
      }
    }
    
    return deduplicated;
  }

  /**
   * Clear citation cache
   */
  clearCache(): void {
    this.citationCache.clear();
  }

  private getCitationKey(citation: MessageType.RAGCitation): string {
    return `${citation.documentId}-${citation.pageNumber}-${citation.startChar}-${citation.endChar}`;
  }

  private expandContext(result: SearchResult): string {
    // For now, return the chunk text as full context
    // In a full implementation, this would fetch surrounding chunks
    return result.text;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity for text deduplication
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
}

// Singleton instance
export const citationManager = new CitationManager();