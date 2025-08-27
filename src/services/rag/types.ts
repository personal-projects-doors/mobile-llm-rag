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