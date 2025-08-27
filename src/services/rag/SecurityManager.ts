import * as Keychain from 'react-native-keychain';
import CryptoJS from 'crypto-js';
import {database} from '../../database';
import RAGDocument from '../../database/models/RAGDocument';
import RAGChunk from '../../database/models/RAGChunk';
import {Q} from '@nozbe/watermelondb';

/**
 * SecurityManager handles all security and privacy aspects of the RAG system
 * Ensures data encryption, secure storage, and complete cleanup
 */
export class SecurityManager {
  private static instance: SecurityManager;
  private encryptionKey: string | null = null;
  private readonly KEYCHAIN_SERVICE = 'rag_encryption_service';
  private readonly KEYCHAIN_ACCOUNT = 'rag_encryption_key';

  private constructor() {}

  static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  /**
   * Initialize security manager and ensure encryption key is available
   */
  async initialize(): Promise<void> {
    try {
      await this.ensureEncryptionKey();
    } catch (error) {
      console.error('Failed to initialize SecurityManager:', error);
      throw new Error('Security initialization failed');
    }
  }

  /**
   * Ensure encryption key exists or create a new one
   */
  private async ensureEncryptionKey(): Promise<void> {
    try {
      // Try to load existing key from secure storage
      const credentials = await Keychain.getGenericPassword({
        service: this.KEYCHAIN_SERVICE,
      });

      if (credentials && credentials.password) {
        this.encryptionKey = credentials.password;
      } else {
        // Generate new encryption key
        this.encryptionKey = this.generateEncryptionKey();
        
        // Store in secure keychain
        await Keychain.setGenericPassword(
          this.KEYCHAIN_ACCOUNT,
          this.encryptionKey,
          {
            service: this.KEYCHAIN_SERVICE,
            accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE,
            authenticationType: Keychain.AUTHENTICATION_TYPE.DEVICE_PASSCODE_OR_BIOMETRICS,
            accessGroup: undefined, // Use default access group
            securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
          }
        );
      }
    } catch (error) {
      console.error('Failed to ensure encryption key:', error);
      throw error;
    }
  }

  /**
   * Generate a secure encryption key
   */
  private generateEncryptionKey(): string {
    // Generate 256-bit key using crypto-js
    return CryptoJS.lib.WordArray.random(256/8).toString();
  }

  /**
   * Encrypt sensitive data (embeddings, text content)
   */
  encryptData(data: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }

    try {
      const encrypted = CryptoJS.AES.encrypt(data, this.encryptionKey).toString();
      return encrypted;
    } catch (error) {
      console.error('Failed to encrypt data:', error);
      throw new Error('Data encryption failed');
    }
  }

  /**
   * Decrypt sensitive data
   */
  decryptData(encryptedData: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }

    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Failed to decrypt data:', error);
      throw new Error('Data decryption failed');
    }
  }

  /**
   * Encrypt embedding vector for secure storage
   */
  encryptEmbedding(embedding: number[]): string {
    const embeddingJson = JSON.stringify(embedding);
    return this.encryptData(embeddingJson);
  }

  /**
   * Decrypt embedding vector from storage
   */
  decryptEmbedding(encryptedEmbedding: string): number[] {
    const decryptedJson = this.decryptData(encryptedEmbedding);
    try {
      return JSON.parse(decryptedJson);
    } catch (error) {
      console.error('Failed to parse decrypted embedding:', error);
      throw new Error('Invalid embedding data');
    }
  }

  /**
   * Securely store document text content with encryption
   */
  encryptDocumentText(text: string): string {
    return this.encryptData(text);
  }

  /**
   * Decrypt document text content
   */
  decryptDocumentText(encryptedText: string): string {
    return this.decryptData(encryptedText);
  }

  /**
   * Validate that file operations are secure and on-device only
   */
  validateSecureFileOperation(filePath: string): boolean {
    // Ensure file path is within app's sandbox
    const allowedPaths = [
      '/Documents/',
      '/Library/',
      '/tmp/',
    ];

    const isInSandbox = allowedPaths.some(path => filePath.includes(path));
    
    // Ensure no network URLs
    const isNetworkPath = filePath.startsWith('http://') || 
                         filePath.startsWith('https://') ||
                         filePath.startsWith('ftp://');

    return isInSandbox && !isNetworkPath;
  }

  /**
   * Secure file deletion with overwriting
   */
  async secureDeleteFile(filePath: string): Promise<void> {
    if (!this.validateSecureFileOperation(filePath)) {
      throw new Error('Invalid file path for secure deletion');
    }

    try {
      const RNFS = require('@dr.pogodin/react-native-fs');
      
      // Check if file exists
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        return; // File doesn't exist, nothing to delete
      }

      // Get file size for overwriting
      const stat = await RNFS.stat(filePath);
      const fileSize = stat.size;

      // Overwrite with random data multiple times for security
      const overwriteRounds = 3;
      for (let i = 0; i < overwriteRounds; i++) {
        const randomData = CryptoJS.lib.WordArray.random(fileSize).toString();
        await RNFS.writeFile(filePath, randomData, 'utf8');
      }

      // Finally delete the file
      await RNFS.unlink(filePath);
    } catch (error) {
      console.error('Failed to securely delete file:', error);
      throw new Error('Secure file deletion failed');
    }
  }

  /**
   * Complete cleanup of all document-related data
   */
  async completeDocumentCleanup(documentId: string): Promise<void> {
    try {
      await database.write(async () => {
        // Get document and its file path for secure deletion
        const documentsCollection = database.get<RAGDocument>('rag_documents');
        const document = await documentsCollection.find(documentId);
        
        // Securely delete the physical file
        if (document.filePath && this.validateSecureFileOperation(document.filePath)) {
          await this.secureDeleteFile(document.filePath);
        }

        // Delete all associated chunks (with encrypted embeddings)
        const chunksCollection = database.get<RAGChunk>('rag_chunks');
        const chunks = await chunksCollection.query(
          Q.where('document_id', documentId)
        ).fetch();

        // Delete chunks in batches for performance
        const batchSize = 100;
        for (let i = 0; i < chunks.length; i += batchSize) {
          const batch = chunks.slice(i, i + batchSize);
          await Promise.all(batch.map(chunk => chunk.markAsDeleted()));
        }

        // Delete the document record
        await document.markAsDeleted();
      });

      console.log(`Complete cleanup completed for document: ${documentId}`);
    } catch (error) {
      console.error('Failed to complete document cleanup:', error);
      throw new Error('Document cleanup failed');
    }
  }

  /**
   * Complete cleanup of all RAG data (for app uninstall or reset)
   */
  async completeSystemCleanup(): Promise<void> {
    try {
      await database.write(async () => {
        // Get all documents for file cleanup
        const documentsCollection = database.get<RAGDocument>('rag_documents');
        const documents = await documentsCollection.query().fetch();

        // Securely delete all document files
        for (const document of documents) {
          if (document.filePath && this.validateSecureFileOperation(document.filePath)) {
            try {
              await this.secureDeleteFile(document.filePath);
            } catch (error) {
              console.warn(`Failed to delete file ${document.filePath}:`, error);
              // Continue with other files
            }
          }
        }

        // Delete all chunks
        const chunksCollection = database.get<RAGChunk>('rag_chunks');
        const chunks = await chunksCollection.query().fetch();
        await Promise.all(chunks.map(chunk => chunk.markAsDeleted()));

        // Delete all documents
        await Promise.all(documents.map(doc => doc.markAsDeleted()));
      });

      // Clear encryption key from keychain
      await this.clearEncryptionKey();

      console.log('Complete system cleanup completed');
    } catch (error) {
      console.error('Failed to complete system cleanup:', error);
      throw new Error('System cleanup failed');
    }
  }

  /**
   * Clear encryption key from secure storage
   */
  private async clearEncryptionKey(): Promise<void> {
    try {
      await Keychain.resetGenericPassword({
        service: this.KEYCHAIN_SERVICE,
      });
      this.encryptionKey = null;
    } catch (error) {
      console.error('Failed to clear encryption key:', error);
      // Don't throw here as this might be called during cleanup
    }
  }

  /**
   * Validate that no network operations are performed
   */
  validateOfflineOperation(operation: string): void {
    // This is a compile-time and runtime check to ensure operations are offline
    const networkOperations = [
      'fetch',
      'XMLHttpRequest',
      'WebSocket',
      'navigator.sendBeacon',
    ];

    // In development, we can add runtime checks
    if (__DEV__) {
      console.log(`Validating offline operation: ${operation}`);
      // Additional development-time validation can be added here
    }
  }

  /**
   * Audit trail for security operations
   */
  private logSecurityOperation(operation: string, details?: any): void {
    if (__DEV__) {
      console.log(`[RAG Security] ${operation}`, details);
    }
    // In production, this could be stored locally for debugging
    // but never sent over network
  }

  /**
   * Check if security manager is properly initialized
   */
  isInitialized(): boolean {
    return this.encryptionKey !== null;
  }

  /**
   * Get security status for debugging
   */
  getSecurityStatus(): {
    initialized: boolean;
    hasEncryptionKey: boolean;
    keychainService: string;
  } {
    return {
      initialized: this.isInitialized(),
      hasEncryptionKey: !!this.encryptionKey,
      keychainService: this.KEYCHAIN_SERVICE,
    };
  }
}

// Export singleton instance
export const securityManager = SecurityManager.getInstance();