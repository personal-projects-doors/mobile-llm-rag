import {securityManager, SecurityManager} from '../src/services/rag/SecurityManager';
import {DataCleanupService} from '../src/services/rag/DataCleanupService';
import {SecureDocumentProcessor} from '../src/services/rag/SecureDocumentProcessor';
import RAGChunk from '../src/database/models/RAGChunk';
import RAGDocument from '../src/database/models/RAGDocument';
import {database} from '../src/database';

// Mock dependencies
jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn().mockResolvedValue(true),
  getGenericPassword: jest.fn().mockResolvedValue({
    username: 'rag_encryption_key',
    password: 'mock_encryption_key_12345',
  }),
  resetGenericPassword: jest.fn().mockResolvedValue(true),
  ACCESS_CONTROL: {
    BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE: 'BiometryCurrentSetOrDevicePasscode',
  },
  AUTHENTICATION_TYPE: {
    DEVICE_PASSCODE_OR_BIOMETRICS: 'DevicePasscodeOrBiometrics',
  },
  SECURITY_LEVEL: {
    SECURE_HARDWARE: 'SecureHardware',
  },
}));

jest.mock('crypto-js', () => ({
  AES: {
    encrypt: jest.fn().mockImplementation((data: string, key: string) => ({
      toString: () => `encrypted_${data}`,
    })),
    decrypt: jest.fn().mockImplementation((encryptedData: string, key: string) => ({
      toString: (encoding: any) => encryptedData.replace('encrypted_', ''),
    })),
  },
  lib: {
    WordArray: {
      random: jest.fn().mockImplementation((bytes: number) => ({
        toString: () => 'mock_random_key_12345',
      })),
    },
  },
  enc: {
    Utf8: 'utf8',
  },
}));

jest.mock('@dr.pogodin/react-native-fs', () => ({
  exists: jest.fn().mockResolvedValue(true),
  stat: jest.fn().mockResolvedValue({
    size: 1024 * 1024, // 1MB
  }),
  read: jest.fn().mockResolvedValue('%PDF-1.4'),
  writeFile: jest.fn().mockResolvedValue(true),
  unlink: jest.fn().mockResolvedValue(true),
}));

describe('RAG Security Implementation', () => {
  beforeEach(async () => {
    // Reset security manager state
    jest.clearAllMocks();
  });

  describe('SecurityManager', () => {
    test('should initialize with encryption key', async () => {
      const manager = SecurityManager.getInstance();
      await manager.initialize();
      
      expect(manager.isInitialized()).toBe(true);
      
      const status = manager.getSecurityStatus();
      expect(status.initialized).toBe(true);
      expect(status.hasEncryptionKey).toBe(true);
    });

    test('should encrypt and decrypt data correctly', async () => {
      const manager = SecurityManager.getInstance();
      await manager.initialize();
      
      const testData = 'This is sensitive test data';
      const encrypted = manager.encryptData(testData);
      const decrypted = manager.decryptData(encrypted);
      
      expect(encrypted).not.toBe(testData);
      expect(decrypted).toBe(testData);
    });

    test('should encrypt and decrypt embeddings', async () => {
      const manager = SecurityManager.getInstance();
      await manager.initialize();
      
      const testEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const encrypted = manager.encryptEmbedding(testEmbedding);
      const decrypted = manager.decryptEmbedding(encrypted);
      
      expect(encrypted).toContain('encrypted_');
      expect(decrypted).toEqual(testEmbedding);
    });

    test('should validate secure file operations', async () => {
      const manager = SecurityManager.getInstance();
      
      // Valid paths (within app sandbox)
      expect(manager.validateSecureFileOperation('/Documents/test.pdf')).toBe(true);
      expect(manager.validateSecureFileOperation('/Library/test.pdf')).toBe(true);
      expect(manager.validateSecureFileOperation('/tmp/test.pdf')).toBe(true);
      
      // Invalid paths (network or outside sandbox)
      expect(manager.validateSecureFileOperation('http://example.com/test.pdf')).toBe(false);
      expect(manager.validateSecureFileOperation('https://example.com/test.pdf')).toBe(false);
      expect(manager.validateSecureFileOperation('ftp://example.com/test.pdf')).toBe(false);
      expect(manager.validateSecureFileOperation('/system/test.pdf')).toBe(false);
    });

    test('should validate offline operations', async () => {
      const manager = SecurityManager.getInstance();
      
      // Should not throw for valid operations
      expect(() => {
        manager.validateOfflineOperation('pdf_processing');
      }).not.toThrow();
      
      expect(() => {
        manager.validateOfflineOperation('embedding_generation');
      }).not.toThrow();
    });

    test('should securely delete files', async () => {
      const manager = SecurityManager.getInstance();
      await manager.initialize();
      
      const RNFS = require('@dr.pogodin/react-native-fs');
      const testFilePath = '/Documents/test.pdf';
      
      await manager.secureDeleteFile(testFilePath);
      
      // Verify file was overwritten multiple times before deletion
      expect(RNFS.writeFile).toHaveBeenCalledTimes(3); // 3 overwrite rounds
      expect(RNFS.unlink).toHaveBeenCalledWith(testFilePath);
    });
  });

  describe('RAGChunk Encryption', () => {
    test('should encrypt text content when setting', async () => {
      // Mock chunk creation
      const mockChunk = {
        text: '',
        embedding: '',
        setEncryptedText: jest.fn(),
        setEmbeddingVector: jest.fn(),
        get decryptedText() {
          return 'decrypted test text';
        },
        get embeddingVector() {
          return [0.1, 0.2, 0.3];
        },
      };

      await securityManager.initialize();
      
      const testText = 'This is test chunk text';
      const testEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      
      // Test text encryption
      const encryptedText = securityManager.encryptDocumentText(testText);
      expect(encryptedText).toContain('encrypted_');
      
      // Test embedding encryption
      const encryptedEmbedding = securityManager.encryptEmbedding(testEmbedding);
      expect(encryptedEmbedding).toContain('encrypted_');
    });
  });

  describe('DataCleanupService', () => {
    test('should provide cleanup statistics', async () => {
      const cleanupService = new DataCleanupService();
      
      // Mock database collections
      const mockDocuments = [
        { id: '1', size: 1024 },
        { id: '2', size: 2048 },
      ];
      const mockChunks = [
        { id: '1', documentId: '1' },
        { id: '2', documentId: '1' },
        { id: '3', documentId: '2' },
      ];
      
      // Mock database queries
      jest.spyOn(database, 'get').mockImplementation((tableName: string) => ({
        query: () => ({
          fetch: () => {
            if (tableName === 'rag_documents') return Promise.resolve(mockDocuments);
            if (tableName === 'rag_chunks') return Promise.resolve(mockChunks);
            return Promise.resolve([]);
          },
        }),
        create: jest.fn().mockImplementation((callback) => {
          const mockRecord = {
            id: 'mock_id',
            name: '',
            filePath: '',
            size: 0,
            pageCount: 0,
            isProcessed: false,
            chunkCount: 0,
            isEnabled: true,
          };
          callback(mockRecord);
          return Promise.resolve(mockRecord);
        }),
      }) as any);
      
      const stats = await cleanupService.getCleanupStatistics();
      
      expect(stats.totalDocuments).toBe(2);
      expect(stats.totalChunks).toBe(3);
      expect(stats.totalStorageUsed).toBe(3072); // 1024 + 2048
      expect(stats.orphanedChunks).toBe(0);
    });
  });

  describe('SecureDocumentProcessor', () => {
    test('should validate file security before processing', async () => {
      const mockPDFProcessor = {
        extractText: jest.fn().mockResolvedValue({
          text: 'Test PDF content',
          pageCount: 1,
          fileSize: 1024,
        }),
      };
      
      const mockTextChunker = {
        chunkText: jest.fn().mockReturnValue({
          chunks: [
            {
              id: 'chunk_1',
              text: 'Test chunk',
              metadata: {
                chunkIndex: 0,
                startChar: 0,
                endChar: 10,
                tokenCount: 2,
                pageNumber: 1,
              },
            },
          ],
        }),
      };
      
      const processor = new SecureDocumentProcessor(
        mockPDFProcessor as any,
        mockTextChunker as any
      );
      
      // Test with valid file path
      const validPath = '/Documents/test.pdf';
      const result = await processor.processDocument(validPath, 'test.pdf', {
        generateEmbeddings: false,
      });
      
      expect(result.success).toBe(true);
      expect(mockPDFProcessor.extractText).toHaveBeenCalledWith(validPath);
    });

    test('should reject invalid file paths', async () => {
      const mockPDFProcessor = {
        extractText: jest.fn(),
      };
      
      const mockTextChunker = {
        chunkText: jest.fn(),
      };
      
      const processor = new SecureDocumentProcessor(
        mockPDFProcessor as any,
        mockTextChunker as any
      );
      
      // Test with invalid network path
      const invalidPath = 'https://example.com/test.pdf';
      const result = await processor.processDocument(invalidPath, 'test.pdf');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not secure');
      expect(mockPDFProcessor.extractText).not.toHaveBeenCalled();
    });
  });

  describe('Privacy Compliance', () => {
    test('should ensure no network operations during processing', async () => {
      await securityManager.initialize();
      
      // Validate that offline operations are enforced
      expect(() => {
        securityManager.validateOfflineOperation('pdf_processing');
      }).not.toThrow();
      
      expect(() => {
        securityManager.validateOfflineOperation('embedding_generation');
      }).not.toThrow();
      
      expect(() => {
        securityManager.validateOfflineOperation('similarity_search');
      }).not.toThrow();
    });

    test('should encrypt all sensitive data before storage', async () => {
      await securityManager.initialize();
      
      const sensitiveText = 'This is sensitive document content';
      const sensitiveEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      
      const encryptedText = securityManager.encryptDocumentText(sensitiveText);
      const encryptedEmbedding = securityManager.encryptEmbedding(sensitiveEmbedding);
      
      // Verify data is encrypted (not in plain text)
      expect(encryptedText).not.toBe(sensitiveText);
      expect(encryptedEmbedding).not.toBe(JSON.stringify(sensitiveEmbedding));
      
      // Verify data can be decrypted correctly
      expect(securityManager.decryptDocumentText(encryptedText)).toBe(sensitiveText);
      expect(securityManager.decryptEmbedding(encryptedEmbedding)).toEqual(sensitiveEmbedding);
    });

    test('should provide complete data cleanup on deletion', async () => {
      const cleanupService = new DataCleanupService();
      
      // Mock successful cleanup
      jest.spyOn(database, 'write').mockImplementation((callback: any) => {
        return callback();
      });
      
      jest.spyOn(database, 'get').mockImplementation((tableName: string) => ({
        query: () => ({
          fetch: () => Promise.resolve([]),
        }),
        find: () => Promise.resolve({
          id: 'test_doc',
          filePath: '/Documents/test.pdf',
          markAsDeleted: jest.fn(),
        }),
      }) as any);
      
      const result = await cleanupService.completeSystemCleanup({
        includeSettings: true,
        secureFileDelete: true,
        validateCleanup: true,
      });
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle encryption failures gracefully', async () => {
      // Mock crypto failure
      const CryptoJS = require('crypto-js');
      CryptoJS.AES.encrypt.mockImplementationOnce(() => {
        throw new Error('Encryption failed');
      });
      
      await securityManager.initialize();
      
      expect(() => {
        securityManager.encryptData('test data');
      }).toThrow('Data encryption failed');
    });

    test('should handle decryption failures gracefully', async () => {
      // Mock crypto failure
      const CryptoJS = require('crypto-js');
      CryptoJS.AES.decrypt.mockImplementationOnce(() => {
        throw new Error('Decryption failed');
      });
      
      await securityManager.initialize();
      
      expect(() => {
        securityManager.decryptData('encrypted_data');
      }).toThrow('Data decryption failed');
    });

    test('should handle file deletion failures gracefully', async () => {
      const RNFS = require('@dr.pogodin/react-native-fs');
      RNFS.unlink.mockRejectedValueOnce(new Error('File deletion failed'));
      
      await securityManager.initialize();
      
      await expect(
        securityManager.secureDeleteFile('/Documents/test.pdf')
      ).rejects.toThrow('Secure file deletion failed');
    });
  });

  describe('Security Validation', () => {
    test('should validate file integrity', async () => {
      const RNFS = require('@dr.pogodin/react-native-fs');
      
      // Test valid PDF header
      RNFS.read.mockResolvedValueOnce('%PDF-1.4');
      
      const processor = new SecureDocumentProcessor({} as any, {} as any);
      
      // Should not throw for valid PDF
      await expect(
        (processor as any).validateFileIntegrity('/Documents/test.pdf')
      ).resolves.not.toThrow();
      
      // Test invalid header
      RNFS.read.mockResolvedValueOnce('INVALID');
      
      await expect(
        (processor as any).validateFileIntegrity('/Documents/invalid.pdf')
      ).rejects.toThrow('not a valid PDF');
    });

    test('should enforce file size limits', async () => {
      const RNFS = require('@dr.pogodin/react-native-fs');
      
      // Mock large file
      RNFS.stat.mockResolvedValueOnce({
        size: 200 * 1024 * 1024, // 200MB (over limit)
      });
      
      const processor = new SecureDocumentProcessor({} as any, {} as any);
      
      const result = await processor.processDocument(
        '/Documents/large.pdf',
        'large.pdf'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('File too large');
    });
  });
});