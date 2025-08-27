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