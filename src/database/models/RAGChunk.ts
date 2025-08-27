import {Model} from '@nozbe/watermelondb';
import {field, text, readonly, date} from '@nozbe/watermelondb/decorators';
import {Associations} from '@nozbe/watermelondb/Model';
import {securityManager} from '../../services/rag/SecurityManager';

export default class RAGChunk extends Model {
  static table = 'rag_chunks';

  static associations: Associations = {
    rag_documents: {type: 'belongs_to' as const, key: 'document_id'},
  };

  @text('document_id') documentId!: string;
  @text('text') text!: string; // Encrypted text content
  @field('page_number') pageNumber!: number;
  @field('chunk_index') chunkIndex!: number;
  @text('embedding') embedding?: string; // Encrypted embedding data
  @field('start_char') startChar!: number;
  @field('end_char') endChar!: number;
  @field('token_count') tokenCount!: number;
  @readonly @date('created_at') createdAt!: Date;

  // Helper methods
  get hasEmbedding(): boolean {
    return !!this.embedding;
  }

  get embeddingVector(): number[] | null {
    if (!this.embedding) return null;
    try {
      // Decrypt the embedding before parsing
      if (securityManager.isInitialized()) {
        return securityManager.decryptEmbedding(this.embedding);
      } else {
        // Fallback for backwards compatibility during migration
        return JSON.parse(this.embedding);
      }
    } catch (error) {
      console.error('Failed to decrypt/parse embedding vector:', error);
      return null;
    }
  }

  async setEmbeddingVector(vector: number[]): Promise<void> {
    try {
      // Ensure security manager is initialized
      if (!securityManager.isInitialized()) {
        await securityManager.initialize();
      }
      
      // Encrypt the embedding before storing
      this.embedding = securityManager.encryptEmbedding(vector);
    } catch (error) {
      console.error('Failed to encrypt embedding vector:', error);
      // Fallback to unencrypted storage for backwards compatibility
      this.embedding = JSON.stringify(vector);
    }
  }

  // Get decrypted text content
  get decryptedText(): string {
    try {
      if (securityManager.isInitialized()) {
        return securityManager.decryptDocumentText(this.text);
      } else {
        // Fallback for backwards compatibility during migration
        return this.text;
      }
    } catch (error) {
      console.error('Failed to decrypt text content:', error);
      return this.text; // Return encrypted text as fallback
    }
  }

  // Set encrypted text content
  async setEncryptedText(plainText: string): Promise<void> {
    try {
      // Ensure security manager is initialized
      if (!securityManager.isInitialized()) {
        await securityManager.initialize();
      }
      
      // Encrypt the text before storing
      this.text = securityManager.encryptDocumentText(plainText);
    } catch (error) {
      console.error('Failed to encrypt text content:', error);
      // Fallback to unencrypted storage for backwards compatibility
      this.text = plainText;
    }
  }

  // Get text excerpt for display
  get excerpt(): string {
    const decryptedText = this.decryptedText;
    const maxLength = 150;
    if (decryptedText.length <= maxLength) return decryptedText;
    return decryptedText.substring(0, maxLength) + '...';
  }

  // Get character range info
  get characterRange(): string {
    return `${this.startChar}-${this.endChar}`;
  }
}