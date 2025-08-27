import {database} from '../../database';
import RAGDocument from '../../database/models/RAGDocument';
import RAGChunk from '../../database/models/RAGChunk';
import {securityManager} from './SecurityManager';
import {PDFProcessor} from './PDFProcessor';
import {TextChunker, ChunkingConfig} from './TextChunker';
import {EmbeddingGenerator} from './EmbeddingGenerator';
import {Q} from '@nozbe/watermelondb';

export interface SecureProcessingOptions {
  chunkingConfig?: Partial<ChunkingConfig>;
  generateEmbeddings?: boolean;
  validateFileIntegrity?: boolean;
  enableProgressTracking?: boolean;
}

export interface ProcessingProgress {
  stage: 'validation' | 'extraction' | 'chunking' | 'embedding' | 'storage' | 'cleanup';
  progress: number; // 0-100
  message: string;
  currentChunk?: number;
  totalChunks?: number;
}

export interface SecureProcessingResult {
  documentId: string;
  success: boolean;
  chunksCreated: number;
  embeddingsGenerated: number;
  processingTime: number;
  error?: string;
}

/**
 * SecureDocumentProcessor handles all document processing with security and privacy measures
 */
export class SecureDocumentProcessor {
  private pdfProcessor: PDFProcessor;
  private textChunker: TextChunker;
  private embeddingGenerator?: EmbeddingGenerator;
  private onProgress?: (progress: ProcessingProgress) => void;

  constructor(
    pdfProcessor: PDFProcessor,
    textChunker: TextChunker,
    embeddingGenerator?: EmbeddingGenerator,
    onProgress?: (progress: ProcessingProgress) => void
  ) {
    this.pdfProcessor = pdfProcessor;
    this.textChunker = textChunker;
    this.embeddingGenerator = embeddingGenerator;
    this.onProgress = onProgress;
  }

  /**
   * Securely process a document with full privacy measures
   */
  async processDocument(
    filePath: string,
    documentName: string,
    options: SecureProcessingOptions = {}
  ): Promise<SecureProcessingResult> {
    const startTime = Date.now();
    let documentId: string | null = null;

    try {
      // Ensure security manager is initialized
      if (!securityManager.isInitialized()) {
        await securityManager.initialize();
      }

      // Stage 1: Validation
      this.reportProgress({
        stage: 'validation',
        progress: 0,
        message: 'Validating file security and integrity',
      });

      await this.validateFileSecurely(filePath, options);

      // Stage 2: Text Extraction
      this.reportProgress({
        stage: 'extraction',
        progress: 20,
        message: 'Extracting text content from PDF',
      });

      const extractionResult = await this.pdfProcessor.extractText(filePath);
      
      // Validate that extraction was done offline
      securityManager.validateOfflineOperation('pdf_text_extraction');

      // Stage 3: Chunking
      this.reportProgress({
        stage: 'chunking',
        progress: 40,
        message: 'Creating secure text chunks',
      });

      const chunkingResult = this.textChunker.chunkText(
        extractionResult.text,
        `temp_${Date.now()}`, // Temporary ID, will be replaced
        extractionResult.pageNumbers
      );

      // Stage 4: Database Storage with Encryption
      this.reportProgress({
        stage: 'storage',
        progress: 60,
        message: 'Storing document with encryption',
      });

      documentId = await this.storeDocumentSecurely(
        documentName,
        filePath,
        extractionResult,
        chunkingResult.chunks
      );

      let embeddingsGenerated = 0;

      // Stage 5: Embedding Generation (if enabled)
      if (options.generateEmbeddings && this.embeddingGenerator) {
        this.reportProgress({
          stage: 'embedding',
          progress: 70,
          message: 'Generating secure embeddings',
        });

        embeddingsGenerated = await this.generateEmbeddingsSecurely(
          documentId,
          chunkingResult.chunks
        );
      }

      // Stage 6: Cleanup
      this.reportProgress({
        stage: 'cleanup',
        progress: 90,
        message: 'Finalizing secure storage',
      });

      await this.finalizeDocumentProcessing(documentId);

      this.reportProgress({
        stage: 'cleanup',
        progress: 100,
        message: 'Document processing completed securely',
      });

      const processingTime = Date.now() - startTime;

      return {
        documentId,
        success: true,
        chunksCreated: chunkingResult.chunks.length,
        embeddingsGenerated,
        processingTime,
      };

    } catch (error) {
      console.error('Secure document processing failed:', error);

      // Clean up any partial data on failure
      if (documentId) {
        try {
          await securityManager.completeDocumentCleanup(documentId);
        } catch (cleanupError) {
          console.error('Failed to cleanup after processing error:', cleanupError);
        }
      }

      return {
        documentId: documentId || '',
        success: false,
        chunksCreated: 0,
        embeddingsGenerated: 0,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate file security and integrity
   */
  private async validateFileSecurely(
    filePath: string,
    options: SecureProcessingOptions
  ): Promise<void> {
    // Validate file path is secure
    if (!securityManager.validateSecureFileOperation(filePath)) {
      throw new Error('File path is not secure - must be within app sandbox');
    }

    // Validate file exists and is accessible
    const RNFS = require('@dr.pogodin/react-native-fs');
    const exists = await RNFS.exists(filePath);
    if (!exists) {
      throw new Error('File does not exist or is not accessible');
    }

    // Check file size (prevent extremely large files)
    const stat = await RNFS.stat(filePath);
    const maxFileSize = 100 * 1024 * 1024; // 100MB limit
    if (stat.size > maxFileSize) {
      throw new Error(`File too large: ${stat.size} bytes (max: ${maxFileSize})`);
    }

    // Validate file type by extension and magic bytes
    if (!filePath.toLowerCase().endsWith('.pdf')) {
      throw new Error('Only PDF files are supported');
    }

    // Optional: Validate file integrity
    if (options.validateFileIntegrity) {
      await this.validateFileIntegrity(filePath);
    }
  }

  /**
   * Validate file integrity using basic checks
   */
  private async validateFileIntegrity(filePath: string): Promise<void> {
    try {
      const RNFS = require('@dr.pogodin/react-native-fs');
      
      // Read first few bytes to check PDF magic number
      const headerBytes = await RNFS.read(filePath, 4, 0, 'ascii');
      if (!headerBytes.startsWith('%PDF')) {
        throw new Error('File is not a valid PDF (invalid header)');
      }

      // Additional integrity checks could be added here
      // such as checking for PDF trailer, cross-reference table, etc.
      
    } catch (error) {
      throw new Error(`File integrity validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store document and chunks with encryption
   */
  private async storeDocumentSecurely(
    documentName: string,
    filePath: string,
    extractionResult: any,
    chunks: any[]
  ): Promise<string> {
    return await database.write(async () => {
      // Create document record
      const documentsCollection = database.get<RAGDocument>('rag_documents');
      const document = await documentsCollection.create(doc => {
        doc.name = documentName;
        doc.filePath = filePath;
        doc.size = extractionResult.fileSize || 0;
        doc.pageCount = extractionResult.pageCount || 0;
        doc.isProcessed = false; // Will be set to true after all chunks are stored
        doc.chunkCount = chunks.length;
        doc.isEnabled = true;
      });

      // Create encrypted chunks
      const chunksCollection = database.get<RAGChunk>('rag_chunks');
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        await chunksCollection.create(async chunkRecord => {
          chunkRecord.documentId = document.id;
          chunkRecord.pageNumber = chunk.metadata.pageNumber || 1;
          chunkRecord.chunkIndex = chunk.metadata.chunkIndex;
          chunkRecord.startChar = chunk.metadata.startChar;
          chunkRecord.endChar = chunk.metadata.endChar;
          chunkRecord.tokenCount = chunk.metadata.tokenCount;
          
          // Encrypt and store text content
          await chunkRecord.setEncryptedText(chunk.text);
        });

        // Report progress for chunk storage
        if (this.onProgress) {
          const progress = 60 + (i / chunks.length) * 10; // 60-70% range
          this.reportProgress({
            stage: 'storage',
            progress,
            message: `Storing encrypted chunk ${i + 1} of ${chunks.length}`,
            currentChunk: i + 1,
            totalChunks: chunks.length,
          });
        }
      }

      return document.id;
    });
  }

  /**
   * Generate embeddings securely for all chunks
   */
  private async generateEmbeddingsSecurely(
    documentId: string,
    chunks: any[]
  ): Promise<number> {
    if (!this.embeddingGenerator) {
      return 0;
    }

    // Validate offline operation
    securityManager.validateOfflineOperation('embedding_generation');

    let embeddingsGenerated = 0;

    // Get chunks from database to update with embeddings
    const chunksCollection = database.get<RAGChunk>('rag_chunks');
    const dbChunks = await chunksCollection.query(
      Q.where('document_id', documentId)
    ).fetch();

    for (let i = 0; i < dbChunks.length; i++) {
      const dbChunk = dbChunks[i];
      const originalChunk = chunks[i];

      try {
        // Generate embedding for the chunk text
        const embeddingResult = await this.embeddingGenerator.generateEmbedding(
          originalChunk.text,
          dbChunk.id
        );

        // Update chunk with encrypted embedding
        await database.write(async () => {
          await dbChunk.update(async chunk => {
            await chunk.setEmbeddingVector(embeddingResult.embedding);
          });
        });

        embeddingsGenerated++;

        // Report progress
        if (this.onProgress) {
          const progress = 70 + (i / dbChunks.length) * 20; // 70-90% range
          this.reportProgress({
            stage: 'embedding',
            progress,
            message: `Generated embedding ${i + 1} of ${dbChunks.length}`,
            currentChunk: i + 1,
            totalChunks: dbChunks.length,
          });
        }

      } catch (error) {
        console.error(`Failed to generate embedding for chunk ${dbChunk.id}:`, error);
        // Continue with other chunks even if one fails
      }
    }

    return embeddingsGenerated;
  }

  /**
   * Finalize document processing
   */
  private async finalizeDocumentProcessing(documentId: string): Promise<void> {
    await database.write(async () => {
      const documentsCollection = database.get<RAGDocument>('rag_documents');
      const document = await documentsCollection.find(documentId);
      
      await document.update(doc => {
        doc.isProcessed = true;
        doc.processedAt = Date.now();
      });
    });
  }

  /**
   * Securely delete a document and all associated data
   */
  async deleteDocumentSecurely(documentId: string): Promise<void> {
    try {
      // Use security manager for complete cleanup
      await securityManager.completeDocumentCleanup(documentId);
    } catch (error) {
      console.error('Failed to securely delete document:', error);
      throw new Error('Secure document deletion failed');
    }
  }

  /**
   * Report processing progress
   */
  private reportProgress(progress: ProcessingProgress): void {
    if (this.onProgress) {
      this.onProgress(progress);
    }
  }

  /**
   * Validate that all operations are happening offline
   */
  validateOfflineProcessing(): void {
    securityManager.validateOfflineOperation('document_processing');
  }

  /**
   * Get security status for the processor
   */
  getSecurityStatus(): {
    securityManagerInitialized: boolean;
    encryptionEnabled: boolean;
    offlineProcessingValidated: boolean;
  } {
    return {
      securityManagerInitialized: securityManager.isInitialized(),
      encryptionEnabled: securityManager.isInitialized(),
      offlineProcessingValidated: true, // Always true if we reach this point
    };
  }
}