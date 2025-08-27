import { PDFProcessor } from '../PDFProcessor';
import { PDFErrorCodes } from '../types';

// Mock the external dependencies
jest.mock('@dr.pogodin/react-native-fs', () => ({
  exists: jest.fn(),
  stat: jest.fn(),
  readFile: jest.fn(),
  read: jest.fn(),
}));

import RNFS from '@dr.pogodin/react-native-fs';

const mockRNFS = RNFS as jest.Mocked<typeof RNFS>;

describe('PDFProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractText', () => {
    const mockFilePath = '/path/to/test.pdf';

    beforeEach(() => {
      mockRNFS.exists.mockResolvedValue(true);
      mockRNFS.stat.mockResolvedValue({ size: 1024 * 1024 } as any); // 1MB
    });

    it('should successfully extract text from a valid PDF', async () => {
      const result = await PDFProcessor.extractText(mockFilePath);

      expect(result.success).toBe(true);
      expect(result.text).toContain('placeholder text extraction');
      expect(result.text).toContain(mockFilePath);
      expect(result.pageCount).toBe(1);
    });

    it('should handle file not found error', async () => {
      mockRNFS.exists.mockResolvedValue(false);

      const result = await PDFProcessor.extractText(mockFilePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle large file error', async () => {
      mockRNFS.stat.mockResolvedValue({ size: 200 * 1024 * 1024 } as any); // 200MB

      const result = await PDFProcessor.extractText(mockFilePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('should handle page range options', async () => {
      const result = await PDFProcessor.extractText(mockFilePath, {
        startPage: 1,
        endPage: 1,
      });

      expect(result.success).toBe(true);
      expect(result.text).toContain('placeholder text extraction');
    });

    it('should extract text from specific page range', async () => {
      const result = await PDFProcessor.extractText(mockFilePath, {
        startPage: 1,
        endPage: 1,
      });

      expect(result.success).toBe(true);
      expect(result.text).toContain('placeholder text extraction');
    });

    it('should handle processing successfully', async () => {
      const result = await PDFProcessor.extractText(mockFilePath);

      expect(result.success).toBe(true);
      expect(result.text).toContain('placeholder text extraction');
      expect(result.pageCount).toBe(1);
    });
  });

  describe('isValidPDF', () => {
    it('should return true for valid PDF files', async () => {
      mockRNFS.exists.mockResolvedValue(true);
      mockRNFS.read.mockResolvedValue('%PDF');

      const result = await PDFProcessor.isValidPDF('/path/to/valid.pdf');

      expect(result).toBe(true);
    });

    it('should return false for non-existent files', async () => {
      mockRNFS.exists.mockResolvedValue(false);

      const result = await PDFProcessor.isValidPDF('/path/to/missing.pdf');

      expect(result).toBe(false);
    });

    it('should return false for files without PDF signature', async () => {
      mockRNFS.exists.mockResolvedValue(true);
      mockRNFS.read.mockResolvedValue('NOT_PDF');

      const result = await PDFProcessor.isValidPDF('/path/to/invalid.pdf');

      expect(result).toBe(false);
    });

    it('should handle read errors gracefully', async () => {
      mockRNFS.exists.mockResolvedValue(true);
      mockRNFS.read.mockRejectedValue(new Error('Read error'));

      const result = await PDFProcessor.isValidPDF('/path/to/error.pdf');

      expect(result).toBe(false);
    });
  });

  describe('getPDFInfo', () => {
    it('should return PDF information for valid files', async () => {
      mockRNFS.exists.mockResolvedValue(true);
      mockRNFS.read.mockResolvedValue('%PDF');
      mockRNFS.stat.mockResolvedValue({ size: 2 * 1024 * 1024 } as any); // 2MB

      const result = await PDFProcessor.getPDFInfo('/path/to/test.pdf');

      expect(result.isValid).toBe(true);
      expect(result.pageCount).toBe(1);
      expect(result.fileSizeMB).toBe(2);
    });

    it('should return error for invalid files', async () => {
      mockRNFS.exists.mockResolvedValue(true);
      mockRNFS.read.mockResolvedValue('NOT_PDF');

      const result = await PDFProcessor.getPDFInfo('/path/to/invalid.pdf');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid PDF file');
    });

    it('should handle processing errors', async () => {
      mockRNFS.exists.mockResolvedValue(true);
      mockRNFS.read.mockResolvedValue('%PDF');
      mockRNFS.stat.mockRejectedValue(new Error('Stat error'));

      const result = await PDFProcessor.getPDFInfo('/path/to/error.pdf');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Stat error');
    });
  });

  describe('extractTextWithProgress', () => {
    beforeEach(() => {
      mockRNFS.exists.mockResolvedValue(true);
      mockRNFS.read.mockResolvedValue('%PDF');
      mockRNFS.stat.mockResolvedValue({ size: 1024 * 1024 } as any);
    });

    it('should call progress callback during extraction', async () => {
      const progressCallback = jest.fn();

      const result = await PDFProcessor.extractTextWithProgress(
        '/path/to/test.pdf',
        { startPage: 1, endPage: 1 },
        progressCallback
      );

      expect(result.success).toBe(true);
      expect(progressCallback).toHaveBeenCalledTimes(1);
      expect(progressCallback).toHaveBeenCalledWith(expect.any(Number), 1, 1);
    });

    it('should work without progress callback', async () => {
      const result = await PDFProcessor.extractTextWithProgress('/path/to/test.pdf');

      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should map file not found errors correctly', async () => {
      mockRNFS.exists.mockRejectedValue(new Error('ENOENT: file not found'));

      const result = await PDFProcessor.extractText('/path/to/missing.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should map permission errors correctly', async () => {
      mockRNFS.exists.mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await PDFProcessor.extractText('/path/to/restricted.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });

    it('should handle processing errors', async () => {
      mockRNFS.exists.mockResolvedValue(true);
      mockRNFS.stat.mockRejectedValue(new Error('File access error'));

      const result = await PDFProcessor.extractText('/path/to/error.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle generic errors', async () => {
      mockRNFS.exists.mockRejectedValue(new Error('Unknown error'));

      const result = await PDFProcessor.extractText('/path/to/error.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to process PDF');
    });
  });
});