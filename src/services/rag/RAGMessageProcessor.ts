import {Database} from '@nozbe/watermelondb';
import {RetrievalSystem} from './RetrievalSystem';
import {EmbeddingGenerator} from './EmbeddingGenerator';
import {MessageType} from '../../utils/types';
import {
  SearchResult,
  RetrievalContext,
  AssembledContext,
} from './types';

export interface RAGProcessingOptions {
  maxResults?: number;
  minSimilarity?: number;
  maxTokens?: number;
  documentIds?: string[];
}

export interface RAGProcessingResult {
  enhancedPrompt: string;
  citations: MessageType.RAGCitation[];
  retrievalContext: RetrievalContext;
  originalQuery: string;
}

export class RAGMessageProcessor {
  private database: Database;
  private retrievalSystem: RetrievalSystem;
  private embeddingGenerator: EmbeddingGenerator;

  constructor(database: Database, embeddingGenerator: EmbeddingGenerator) {
    this.database = database;
    this.embeddingGenerator = embeddingGenerator;
    this.retrievalSystem = new RetrievalSystem(database, embeddingGenerator);
  }

  /**
   * Process a user message with RAG enhancement
   */
  async processMessage(
    message: string,
    options?: RAGProcessingOptions
  ): Promise<RAGProcessingResult> {
    // Retrieve relevant context
    const {context, assembled} = await this.retrievalSystem.retrieveAndAssemble(
      message,
      {
        maxResults: options?.maxResults || 5,
        minSimilarity: options?.minSimilarity || 0.7,
        documentIds: options?.documentIds,
        maxTokens: options?.maxTokens || 2000,
      }
    );

    // Create enhanced prompt with context
    const enhancedPrompt = this.createEnhancedPrompt(message, assembled);

    // Convert search results to citations
    const citations = this.createCitations(context.results);

    return {
      enhancedPrompt,
      citations,
      retrievalContext: context,
      originalQuery: message,
    };
  }

  /**
   * Create an enhanced prompt with retrieved context
   */
  private createEnhancedPrompt(
    originalMessage: string,
    assembledContext: AssembledContext
  ): string {
    if (assembledContext.sources.length === 0) {
      return originalMessage;
    }

    const contextText = assembledContext.text;
    
    return `Context from documents:
${contextText}

Based on the above context, please answer the following question:
${originalMessage}

Please cite specific information from the context when relevant.`;
  }

  /**
   * Convert search results to citation format
   */
  private createCitations(results: SearchResult[]): MessageType.RAGCitation[] {
    return results.map(result => ({
      documentId: result.documentId,
      documentName: result.documentName,
      pageNumber: result.pageNumber,
      chunkText: result.text,
      similarity: result.similarity,
      startChar: result.startChar,
      endChar: result.endChar,
    }));
  }

  /**
   * Check if RAG processing should be applied
   */
  async shouldProcessWithRAG(
    ragEnabled: boolean,
    documentIds: string[]
  ): Promise<boolean> {
    if (!ragEnabled || documentIds.length === 0) {
      return false;
    }

    // Check if documents exist and have processed chunks
    const documentsCollection = this.database.get('rag_documents');
    
    for (const docId of documentIds) {
      try {
        const document = await documentsCollection.find(docId);
        const docData = document as any;
        
        if (!docData.isProcessed || docData.chunkCount === 0) {
          return false;
        }
      } catch (error) {
        // Document not found
        return false;
      }
    }

    return true;
  }

  /**
   * Get available documents for RAG
   */
  async getAvailableDocuments(): Promise<Array<{
    id: string;
    name: string;
    isProcessed: boolean;
    chunkCount: number;
  }>> {
    const documentsCollection = this.database.get('rag_documents');
    const documents = await documentsCollection.query().fetch();

    return documents.map((doc: any) => ({
      id: doc.id,
      name: doc.name,
      isProcessed: doc.isProcessed,
      chunkCount: doc.chunkCount,
    }));
  }
}