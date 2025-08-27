import {Model} from '@nozbe/watermelondb';
import {field, text, readonly, date} from '@nozbe/watermelondb/decorators';
import {Associations} from '@nozbe/watermelondb/Model';

export default class RAGChunk extends Model {
  static table = 'rag_chunks';

  static associations: Associations = {
    rag_documents: {type: 'belongs_to' as const, key: 'document_id'},
  };

  @text('document_id') documentId!: string;
  @text('text') text!: string;
  @field('page_number') pageNumber!: number;
  @field('chunk_index') chunkIndex!: number;
  @text('embedding') embedding?: string; // JSON serialized array
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
      return JSON.parse(this.embedding);
    } catch (error) {
      console.error('Failed to parse embedding vector:', error);
      return null;
    }
  }

  setEmbeddingVector(vector: number[]): void {
    this.embedding = JSON.stringify(vector);
  }

  // Get text excerpt for display
  get excerpt(): string {
    const maxLength = 150;
    if (this.text.length <= maxLength) return this.text;
    return this.text.substring(0, maxLength) + '...';
  }

  // Get character range info
  get characterRange(): string {
    return `${this.startChar}-${this.endChar}`;
  }
}