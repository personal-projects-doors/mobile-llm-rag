import { PDFProcessingError, PDFErrorCodes } from '../types';

describe('RAG Types', () => {
  describe('PDFProcessingError', () => {
    it('should create error with message and code', () => {
      const error = new PDFProcessingError('Test error', PDFErrorCodes.FILE_NOT_FOUND);
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(PDFErrorCodes.FILE_NOT_FOUND);
      expect(error.name).toBe('PDFProcessingError');
    });

    it('should create error with original error', () => {
      const originalError = new Error('Original error');
      const error = new PDFProcessingError(
        'Wrapped error',
        PDFErrorCodes.PROCESSING_FAILED,
        originalError
      );
      
      expect(error.originalError).toBe(originalError);
    });

    it('should be instance of Error', () => {
      const error = new PDFProcessingError('Test', PDFErrorCodes.INVALID_PDF);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PDFProcessingError);
    });
  });

  describe('PDFErrorCodes', () => {
    it('should have all expected error codes', () => {
      expect(PDFErrorCodes.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND');
      expect(PDFErrorCodes.INVALID_PDF).toBe('INVALID_PDF');
      expect(PDFErrorCodes.CORRUPTED_FILE).toBe('CORRUPTED_FILE');
      expect(PDFErrorCodes.PASSWORD_REQUIRED).toBe('PASSWORD_REQUIRED');
      expect(PDFErrorCodes.UNSUPPORTED_FORMAT).toBe('UNSUPPORTED_FORMAT');
      expect(PDFErrorCodes.PROCESSING_FAILED).toBe('PROCESSING_FAILED');
      expect(PDFErrorCodes.MEMORY_ERROR).toBe('MEMORY_ERROR');
      expect(PDFErrorCodes.PERMISSION_DENIED).toBe('PERMISSION_DENIED');
    });
  });
});