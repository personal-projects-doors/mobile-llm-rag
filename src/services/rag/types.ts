export interface PDFProcessingResult {
  success: boolean;
  text?: string;
  pageCount?: number;
  error?: string;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
  };
}

export interface PDFProcessingOptions {
  startPage?: number;
  endPage?: number;
  password?: string;
}

export interface TextCleaningOptions {
  removeExtraWhitespace: boolean;
  normalizeLineBreaks: boolean;
  removeSpecialCharacters: boolean;
  preserveFormatting: boolean;
}

export interface ProcessedText {
  cleanedText: string;
  originalLength: number;
  cleanedLength: number;
  removedCharacters: number;
}

export class PDFProcessingError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'PDFProcessingError';
  }
}

export enum PDFErrorCodes {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  INVALID_PDF = 'INVALID_PDF',
  CORRUPTED_FILE = 'CORRUPTED_FILE',
  PASSWORD_REQUIRED = 'PASSWORD_REQUIRED',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  MEMORY_ERROR = 'MEMORY_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED'
}

// Chunking-related types
export interface ChunkingConfig {
  chunkSize: number;
  overlap: number;
  preserveSentences: boolean;
  minChunkSize: number;
  maxChunkSize: number;
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

export class ChunkingError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ChunkingError';
  }
}

export enum ChunkingErrorCodes {
  INVALID_CONFIG = 'INVALID_CONFIG',
  EMPTY_TEXT = 'EMPTY_TEXT',
  TEXT_TOO_LARGE = 'TEXT_TOO_LARGE',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  INVALID_BOUNDARIES = 'INVALID_BOUNDARIES'
}

// Embedding-related types
export interface EmbeddingConfig {
  modelId: string;
  batchSize: number;
  maxTokens: number;
  normalize: boolean;
}

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
  processingTime: number;
  chunkId?: string;
}

export interface BatchEmbeddingResult {
  results: EmbeddingResult[];
  totalProcessingTime: number;
  successCount: number;
  failureCount: number;
  errors: EmbeddingError[];
}

export interface EmbeddingProgress {
  processed: number;
  total: number;
  currentChunk?: string;
  estimatedTimeRemaining?: number;
  cancelled: boolean;
}

export class EmbeddingError extends Error {
  constructor(
    message: string,
    public code: string,
    public chunkId?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

export enum EmbeddingErrorCodes {
  MODEL_NOT_LOADED = 'MODEL_NOT_LOADED',
  MODEL_LOADING_FAILED = 'MODEL_LOADING_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  MEMORY_ERROR = 'MEMORY_ERROR',
  TIMEOUT = 'TIMEOUT',
  CANCELLED = 'CANCELLED',
  BATCH_SIZE_EXCEEDED = 'BATCH_SIZE_EXCEEDED'
}

// Similarity search and retrieval types
export interface SearchQuery {
  text: string;
  embedding?: number[];
  maxResults: number;
  minSimilarity: number;
  documentIds?: string[];
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  text: string;
  pageNumber: number;
  chunkIndex: number;
  similarity: number;
  startChar: number;
  endChar: number;
  tokenCount: number;
}

export interface RetrievalContext {
  query: string;
  results: SearchResult[];
  totalChunks: number;
  processingTime: number;
  averageSimilarity: number;
  maxSimilarity: number;
  minSimilarity: number;
}

export interface SimilaritySearchConfig {
  maxResults: number;
  minSimilarity: number;
  enableRanking: boolean;
  rankingWeights: {
    similarity: number;
    recency: number;
    tokenCount: number;
  };
}

export interface ContextAssemblyConfig {
  maxTokens: number;
  preserveOrder: boolean;
  addSeparators: boolean;
  includeMetadata: boolean;
  deduplicateContent: boolean;
}

export interface AssembledContext {
  text: string;
  sources: SearchResult[];
  totalTokens: number;
  truncated: boolean;
  assemblyTime: number;
}

export class SimilaritySearchError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'SimilaritySearchError';
  }
}

export enum SimilaritySearchErrorCodes {
  INVALID_QUERY = 'INVALID_QUERY',
  NO_EMBEDDINGS = 'NO_EMBEDDINGS',
  DATABASE_ERROR = 'DATABASE_ERROR',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  INVALID_SIMILARITY_THRESHOLD = 'INVALID_SIMILARITY_THRESHOLD',
  NO_RESULTS_FOUND = 'NO_RESULTS_FOUND'
}

// Comprehensive RAG Error System
export interface RAGErrorContext {
  operation: string;
  documentId?: string;
  chunkId?: string;
  userId?: string;
  timestamp: Date;
  additionalInfo?: Record<string, any>;
}

export interface RAGRecoveryAction {
  type: 'retry' | 'fallback' | 'skip' | 'manual';
  label: string;
  description: string;
  action: () => Promise<void> | void;
  priority: 'high' | 'medium' | 'low';
}

export class RAGError extends Error {
  public readonly timestamp: Date;
  public readonly context: RAGErrorContext;
  public readonly recoveryActions: RAGRecoveryAction[];
  public readonly isRecoverable: boolean;
  public readonly isTransient: boolean;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';

  constructor(
    message: string,
    public readonly code: string,
    public readonly category: RAGErrorCategory,
    context: Partial<RAGErrorContext> = {},
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'RAGError';
    this.timestamp = new Date();
    this.context = {
      operation: 'unknown',
      timestamp: this.timestamp,
      ...context,
    };
    
    // Determine error characteristics based on category and code
    const errorInfo = this.getErrorInfo(category, code);
    this.isRecoverable = errorInfo.recoverable;
    this.isTransient = errorInfo.transient;
    this.severity = errorInfo.severity;
    this.recoveryActions = errorInfo.recoveryActions;
  }

  private getErrorInfo(category: RAGErrorCategory, code: string): {
    recoverable: boolean;
    transient: boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
    recoveryActions: RAGRecoveryAction[];
  } {
    const errorMap: Record<string, any> = {
      // Document processing errors
      [PDFErrorCodes.FILE_NOT_FOUND]: {
        recoverable: false,
        transient: false,
        severity: 'medium',
        recoveryActions: [
          {
            type: 'manual',
            label: 'Select Different File',
            description: 'Choose a different PDF file to process',
            action: () => {},
            priority: 'high',
          },
        ],
      },
      [PDFErrorCodes.CORRUPTED_FILE]: {
        recoverable: false,
        transient: false,
        severity: 'medium',
        recoveryActions: [
          {
            type: 'manual',
            label: 'Try Different File',
            description: 'This file appears to be corrupted. Try a different PDF',
            action: () => {},
            priority: 'high',
          },
        ],
      },
      [PDFErrorCodes.MEMORY_ERROR]: {
        recoverable: true,
        transient: true,
        severity: 'high',
        recoveryActions: [
          {
            type: 'retry',
            label: 'Retry with Smaller Chunks',
            description: 'Process the document in smaller chunks to reduce memory usage',
            action: () => {},
            priority: 'high',
          },
          {
            type: 'fallback',
            label: 'Skip This Document',
            description: 'Continue without processing this document',
            action: () => {},
            priority: 'medium',
          },
        ],
      },
      
      // Embedding generation errors
      [EmbeddingErrorCodes.MODEL_NOT_LOADED]: {
        recoverable: true,
        transient: true,
        severity: 'high',
        recoveryActions: [
          {
            type: 'retry',
            label: 'Load Model',
            description: 'Attempt to load the embedding model',
            action: () => {},
            priority: 'high',
          },
          {
            type: 'fallback',
            label: 'Use Normal Chat',
            description: 'Continue with normal chat without RAG',
            action: () => {},
            priority: 'medium',
          },
        ],
      },
      [EmbeddingErrorCodes.TIMEOUT]: {
        recoverable: true,
        transient: true,
        severity: 'medium',
        recoveryActions: [
          {
            type: 'retry',
            label: 'Retry',
            description: 'Try processing again',
            action: () => {},
            priority: 'high',
          },
          {
            type: 'fallback',
            label: 'Reduce Batch Size',
            description: 'Process fewer chunks at once',
            action: () => {},
            priority: 'medium',
          },
        ],
      },
      
      // Similarity search errors
      [SimilaritySearchErrorCodes.DATABASE_ERROR]: {
        recoverable: true,
        transient: true,
        severity: 'high',
        recoveryActions: [
          {
            type: 'retry',
            label: 'Retry Search',
            description: 'Attempt the search again',
            action: () => {},
            priority: 'high',
          },
          {
            type: 'fallback',
            label: 'Use Normal Chat',
            description: 'Continue without document search',
            action: () => {},
            priority: 'medium',
          },
        ],
      },
      [SimilaritySearchErrorCodes.NO_RESULTS_FOUND]: {
        recoverable: false,
        transient: false,
        severity: 'low',
        recoveryActions: [
          {
            type: 'fallback',
            label: 'Continue Without Context',
            description: 'No relevant documents found, continue with normal response',
            action: () => {},
            priority: 'high',
          },
        ],
      },
    };

    return errorMap[code] || {
      recoverable: false,
      transient: false,
      severity: 'medium',
      recoveryActions: [],
    };
  }

  // Get user-friendly error message
  getUserMessage(): string {
    const messageMap: Record<string, string> = {
      [PDFErrorCodes.FILE_NOT_FOUND]: 'The selected PDF file could not be found. Please select a different file.',
      [PDFErrorCodes.CORRUPTED_FILE]: 'The PDF file appears to be corrupted or damaged. Please try a different file.',
      [PDFErrorCodes.MEMORY_ERROR]: 'Not enough memory to process this document. Try closing other apps or selecting a smaller document.',
      [PDFErrorCodes.PROCESSING_FAILED]: 'Failed to process the PDF document. The file may be password-protected or in an unsupported format.',
      
      [EmbeddingErrorCodes.MODEL_NOT_LOADED]: 'The AI model needed for document search is not loaded. Please wait while we load it.',
      [EmbeddingErrorCodes.TIMEOUT]: 'Document processing is taking longer than expected. This may be due to a large document or device performance.',
      [EmbeddingErrorCodes.MEMORY_ERROR]: 'Not enough memory to generate document embeddings. Try processing fewer documents at once.',
      
      [SimilaritySearchErrorCodes.DATABASE_ERROR]: 'There was an issue accessing the document database. Please try again.',
      [SimilaritySearchErrorCodes.NO_RESULTS_FOUND]: 'No relevant information found in your documents for this query.',
      [SimilaritySearchErrorCodes.NO_EMBEDDINGS]: 'No processed documents available for search. Please add and process some documents first.',
    };

    return messageMap[this.code] || this.message;
  }

  // Get technical details for debugging
  getTechnicalDetails(): string {
    return `${this.category}:${this.code} - ${this.message}${
      this.originalError ? ` (Original: ${this.originalError.message})` : ''
    }`;
  }
}

export enum RAGErrorCategory {
  DOCUMENT_PROCESSING = 'DOCUMENT_PROCESSING',
  EMBEDDING_GENERATION = 'EMBEDDING_GENERATION',
  SIMILARITY_SEARCH = 'SIMILARITY_SEARCH',
  CONTEXT_ASSEMBLY = 'CONTEXT_ASSEMBLY',
  MESSAGE_PROCESSING = 'MESSAGE_PROCESSING',
  DATABASE = 'DATABASE',
  MODEL_MANAGEMENT = 'MODEL_MANAGEMENT',
  SYSTEM = 'SYSTEM'
}

// Partial processing support
export interface PartialProcessingResult<T> {
  completed: T[];
  failed: Array<{
    item: any;
    error: RAGError;
  }>;
  totalItems: number;
  successCount: number;
  failureCount: number;
  canContinue: boolean;
  nextBatch?: any[];
}

export interface ProcessingProgress {
  current: number;
  total: number;
  percentage: number;
  currentItem?: string;
  estimatedTimeRemaining?: number;
  canCancel: boolean;
  canPause: boolean;
  isPaused: boolean;
}

// Retry configuration
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  retryableErrors: string[]; // error codes that should be retried
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    EmbeddingErrorCodes.TIMEOUT,
    EmbeddingErrorCodes.MODEL_NOT_LOADED,
    SimilaritySearchErrorCodes.DATABASE_ERROR,
    PDFErrorCodes.MEMORY_ERROR,
  ],
};