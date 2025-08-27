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