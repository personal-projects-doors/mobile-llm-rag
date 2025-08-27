import {database} from '../../database';
import RAGDocument from '../../database/models/RAGDocument';
import RAGChunk from '../../database/models/RAGChunk';
import RAGSettings from '../../database/models/RAGSettings';
import {securityManager} from './SecurityManager';
import {Q} from '@nozbe/watermelondb';

export interface CleanupOptions {
  includeSettings?: boolean;
  secureFileDelete?: boolean;
  validateCleanup?: boolean;
}

export interface CleanupResult {
  documentsDeleted: number;
  chunksDeleted: number;
  filesDeleted: number;
  settingsReset: boolean;
  success: boolean;
  errors: string[];
}

export interface CleanupProgress {
  stage: 'documents' | 'chunks' | 'files' | 'settings' | 'validation';
  progress: number; // 0-100
  message: string;
  itemsProcessed: number;
  totalItems: number;
}

/**
 * DataCleanupService handles privacy-compliant data cleanup and deletion
 */
export class DataCleanupService {
  private onProgress?: (progress: CleanupProgress) => void;

  constructor(onProgress?: (progress: CleanupProgress) => void) {
    this.onProgress = onProgress;
  }

  /**
   * Complete cleanup of all RAG data (for app uninstall or reset)
   */
  async completeSystemCleanup(options: CleanupOptions = {}): Promise<CleanupResult> {
    const result: CleanupResult = {
      documentsDeleted: 0,
      chunksDeleted: 0,
      filesDeleted: 0,
      settingsReset: false,
      success: false,
      errors: [],
    };

    try {
      // Ensure security manager is initialized
      if (!securityManager.isInitialized()) {
        await securityManager.initialize();
      }

      // Stage 1: Get all documents for file cleanup
      this.reportProgress({
        stage: 'documents',
        progress: 0,
        message: 'Identifying documents for cleanup',
        itemsProcessed: 0,
        totalItems: 0,
      });

      const documents = await this.getAllDocuments();
      const totalItems = documents.length;

      // Stage 2: Securely delete document files
      this.reportProgress({
        stage: 'files',
        progress: 10,
        message: 'Securely deleting document files',
        itemsProcessed: 0,
        totalItems,
      });

      if (options.secureFileDelete !== false) {
        for (let i = 0; i < documents.length; i++) {
          const document = documents[i];
          try {
            if (document.filePath && securityManager.validateSecureFileOperation(document.filePath)) {
              await securityManager.secureDeleteFile(document.filePath);
              result.filesDeleted++;
            }
          } catch (error) {
            const errorMsg = `Failed to delete file ${document.filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push(errorMsg);
            console.warn(errorMsg);
          }

          this.reportProgress({
            stage: 'files',
            progress: 10 + (i / totalItems) * 30,
            message: `Deleted file ${i + 1} of ${totalItems}`,
            itemsProcessed: i + 1,
            totalItems,
          });
        }
      }

      // Stage 3: Delete all chunks from database
      this.reportProgress({
        stage: 'chunks',
        progress: 40,
        message: 'Deleting encrypted chunks from database',
        itemsProcessed: 0,
        totalItems: 0,
      });

      const chunksDeleted = await this.deleteAllChunks();
      result.chunksDeleted = chunksDeleted;

      // Stage 4: Delete all documents from database
      this.reportProgress({
        stage: 'documents',
        progress: 60,
        message: 'Deleting document records',
        itemsProcessed: 0,
        totalItems: documents.length,
      });

      const documentsDeleted = await this.deleteAllDocuments();
      result.documentsDeleted = documentsDeleted;

      // Stage 5: Reset settings if requested
      if (options.includeSettings) {
        this.reportProgress({
          stage: 'settings',
          progress: 80,
          message: 'Resetting RAG settings',
          itemsProcessed: 0,
          totalItems: 1,
        });

        await this.resetSettings();
        result.settingsReset = true;
      }

      // Stage 6: Clear encryption keys
      this.reportProgress({
        stage: 'settings',
        progress: 90,
        message: 'Clearing encryption keys',
        itemsProcessed: 0,
        totalItems: 1,
      });

      await securityManager.completeSystemCleanup();

      // Stage 7: Validation
      if (options.validateCleanup !== false) {
        this.reportProgress({
          stage: 'validation',
          progress: 95,
          message: 'Validating cleanup completion',
          itemsProcessed: 0,
          totalItems: 1,
        });

        await this.validateCleanupCompletion();
      }

      this.reportProgress({
        stage: 'validation',
        progress: 100,
        message: 'System cleanup completed successfully',
        itemsProcessed: 1,
        totalItems: 1,
      });

      result.success = true;
      return result;

    } catch (error) {
      const errorMsg = `System cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      console.error(errorMsg);
      return result;
    }
  }

  /**
   * Clean up a specific document and all its data
   */
  async cleanupDocument(documentId: string, options: CleanupOptions = {}): Promise<CleanupResult> {
    const result: CleanupResult = {
      documentsDeleted: 0,
      chunksDeleted: 0,
      filesDeleted: 0,
      settingsReset: false,
      success: false,
      errors: [],
    };

    try {
      // Ensure security manager is initialized
      if (!securityManager.isInitialized()) {
        await securityManager.initialize();
      }

      // Get document info
      const document = await this.getDocument(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      // Stage 1: Securely delete file
      this.reportProgress({
        stage: 'files',
        progress: 0,
        message: 'Securely deleting document file',
        itemsProcessed: 0,
        totalItems: 1,
      });

      if (options.secureFileDelete !== false && document.filePath) {
        try {
          if (securityManager.validateSecureFileOperation(document.filePath)) {
            await securityManager.secureDeleteFile(document.filePath);
            result.filesDeleted = 1;
          }
        } catch (error) {
          const errorMsg = `Failed to delete file ${document.filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          console.warn(errorMsg);
        }
      }

      // Stage 2: Delete chunks
      this.reportProgress({
        stage: 'chunks',
        progress: 30,
        message: 'Deleting encrypted chunks',
        itemsProcessed: 0,
        totalItems: document.chunkCount,
      });

      const chunksDeleted = await this.deleteDocumentChunks(documentId);
      result.chunksDeleted = chunksDeleted;

      // Stage 3: Delete document record
      this.reportProgress({
        stage: 'documents',
        progress: 80,
        message: 'Deleting document record',
        itemsProcessed: 0,
        totalItems: 1,
      });

      await this.deleteDocument(documentId);
      result.documentsDeleted = 1;

      // Stage 4: Validation
      if (options.validateCleanup !== false) {
        this.reportProgress({
          stage: 'validation',
          progress: 95,
          message: 'Validating document cleanup',
          itemsProcessed: 0,
          totalItems: 1,
        });

        await this.validateDocumentCleanup(documentId);
      }

      this.reportProgress({
        stage: 'validation',
        progress: 100,
        message: 'Document cleanup completed successfully',
        itemsProcessed: 1,
        totalItems: 1,
      });

      result.success = true;
      return result;

    } catch (error) {
      const errorMsg = `Document cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      console.error(errorMsg);
      return result;
    }
  }

  /**
   * Clean up orphaned data (chunks without documents, etc.)
   */
  async cleanupOrphanedData(): Promise<CleanupResult> {
    const result: CleanupResult = {
      documentsDeleted: 0,
      chunksDeleted: 0,
      filesDeleted: 0,
      settingsReset: false,
      success: false,
      errors: [],
    };

    try {
      // Find orphaned chunks (chunks without corresponding documents)
      const orphanedChunks = await this.findOrphanedChunks();
      
      if (orphanedChunks.length > 0) {
        this.reportProgress({
          stage: 'chunks',
          progress: 0,
          message: `Cleaning up ${orphanedChunks.length} orphaned chunks`,
          itemsProcessed: 0,
          totalItems: orphanedChunks.length,
        });

        for (let i = 0; i < orphanedChunks.length; i++) {
          const chunk = orphanedChunks[i];
          try {
            await this.deleteChunk(chunk.id);
            result.chunksDeleted++;
          } catch (error) {
            const errorMsg = `Failed to delete orphaned chunk ${chunk.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push(errorMsg);
          }

          this.reportProgress({
            stage: 'chunks',
            progress: (i / orphanedChunks.length) * 100,
            message: `Deleted orphaned chunk ${i + 1} of ${orphanedChunks.length}`,
            itemsProcessed: i + 1,
            totalItems: orphanedChunks.length,
          });
        }
      }

      result.success = true;
      return result;

    } catch (error) {
      const errorMsg = `Orphaned data cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      console.error(errorMsg);
      return result;
    }
  }

  /**
   * Get all documents
   */
  private async getAllDocuments(): Promise<RAGDocument[]> {
    const documentsCollection = database.get<RAGDocument>('rag_documents');
    return await documentsCollection.query().fetch();
  }

  /**
   * Get a specific document
   */
  private async getDocument(documentId: string): Promise<RAGDocument | null> {
    try {
      const documentsCollection = database.get<RAGDocument>('rag_documents');
      return await documentsCollection.find(documentId);
    } catch (error) {
      return null;
    }
  }

  /**
   * Delete all chunks from database
   */
  private async deleteAllChunks(): Promise<number> {
    return await database.write(async () => {
      const chunksCollection = database.get<RAGChunk>('rag_chunks');
      const chunks = await chunksCollection.query().fetch();
      
      // Delete in batches for performance
      const batchSize = 100;
      let deletedCount = 0;
      
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        await Promise.all(batch.map(chunk => chunk.markAsDeleted()));
        deletedCount += batch.length;
      }
      
      return deletedCount;
    });
  }

  /**
   * Delete all documents from database
   */
  private async deleteAllDocuments(): Promise<number> {
    return await database.write(async () => {
      const documentsCollection = database.get<RAGDocument>('rag_documents');
      const documents = await documentsCollection.query().fetch();
      
      await Promise.all(documents.map(doc => doc.markAsDeleted()));
      return documents.length;
    });
  }

  /**
   * Delete chunks for a specific document
   */
  private async deleteDocumentChunks(documentId: string): Promise<number> {
    return await database.write(async () => {
      const chunksCollection = database.get<RAGChunk>('rag_chunks');
      const chunks = await chunksCollection.query(
        Q.where('document_id', documentId)
      ).fetch();
      
      await Promise.all(chunks.map(chunk => chunk.markAsDeleted()));
      return chunks.length;
    });
  }

  /**
   * Delete a specific document
   */
  private async deleteDocument(documentId: string): Promise<void> {
    await database.write(async () => {
      const documentsCollection = database.get<RAGDocument>('rag_documents');
      const document = await documentsCollection.find(documentId);
      await document.markAsDeleted();
    });
  }

  /**
   * Delete a specific chunk
   */
  private async deleteChunk(chunkId: string): Promise<void> {
    await database.write(async () => {
      const chunksCollection = database.get<RAGChunk>('rag_chunks');
      const chunk = await chunksCollection.find(chunkId);
      await chunk.markAsDeleted();
    });
  }

  /**
   * Reset RAG settings to defaults
   */
  private async resetSettings(): Promise<void> {
    await database.write(async () => {
      const settingsCollection = database.get<RAGSettings>('rag_settings');
      const settings = await settingsCollection.query().fetch();
      
      // Delete existing settings
      await Promise.all(settings.map(setting => setting.markAsDeleted()));
    });
  }

  /**
   * Find orphaned chunks (chunks without corresponding documents)
   */
  private async findOrphanedChunks(): Promise<RAGChunk[]> {
    const chunksCollection = database.get<RAGChunk>('rag_chunks');
    const documentsCollection = database.get<RAGDocument>('rag_documents');
    
    const chunks = await chunksCollection.query().fetch();
    const documents = await documentsCollection.query().fetch();
    const documentIds = new Set(documents.map(doc => doc.id));
    
    return chunks.filter(chunk => !documentIds.has(chunk.documentId));
  }

  /**
   * Validate that cleanup was completed successfully
   */
  private async validateCleanupCompletion(): Promise<void> {
    const documentsCollection = database.get<RAGDocument>('rag_documents');
    const chunksCollection = database.get<RAGChunk>('rag_chunks');
    
    const remainingDocuments = await documentsCollection.query().fetch();
    const remainingChunks = await chunksCollection.query().fetch();
    
    if (remainingDocuments.length > 0) {
      throw new Error(`Cleanup validation failed: ${remainingDocuments.length} documents still exist`);
    }
    
    if (remainingChunks.length > 0) {
      throw new Error(`Cleanup validation failed: ${remainingChunks.length} chunks still exist`);
    }
  }

  /**
   * Validate that document cleanup was completed successfully
   */
  private async validateDocumentCleanup(documentId: string): Promise<void> {
    const documentsCollection = database.get<RAGDocument>('rag_documents');
    const chunksCollection = database.get<RAGChunk>('rag_chunks');
    
    try {
      await documentsCollection.find(documentId);
      throw new Error(`Document cleanup validation failed: document ${documentId} still exists`);
    } catch (error) {
      // Document not found is expected
    }
    
    const remainingChunks = await chunksCollection.query(
      Q.where('document_id', documentId)
    ).fetch();
    
    if (remainingChunks.length > 0) {
      throw new Error(`Document cleanup validation failed: ${remainingChunks.length} chunks still exist for document ${documentId}`);
    }
  }

  /**
   * Report cleanup progress
   */
  private reportProgress(progress: CleanupProgress): void {
    if (this.onProgress) {
      this.onProgress(progress);
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStatistics(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    totalStorageUsed: number; // in bytes
    orphanedChunks: number;
  }> {
    const documentsCollection = database.get<RAGDocument>('rag_documents');
    const chunksCollection = database.get<RAGChunk>('rag_chunks');
    
    const documents = await documentsCollection.query().fetch();
    const chunks = await chunksCollection.query().fetch();
    const orphanedChunks = await this.findOrphanedChunks();
    
    const totalStorageUsed = documents.reduce((sum, doc) => sum + doc.size, 0);
    
    return {
      totalDocuments: documents.length,
      totalChunks: chunks.length,
      totalStorageUsed,
      orphanedChunks: orphanedChunks.length,
    };
  }
}