import {Model} from '@nozbe/watermelondb';
import {field, text, readonly, date} from '@nozbe/watermelondb/decorators';
import {Associations} from '@nozbe/watermelondb/Model';

export default class RAGDocument extends Model {
  static table = 'rag_documents';

  static associations: Associations = {
    rag_chunks: {type: 'has_many' as const, foreignKey: 'document_id'},
  };

  @text('name') name!: string;
  @text('file_path') filePath!: string;
  @field('size') size!: number;
  @field('page_count') pageCount!: number;
  @field('processed_at') processedAt?: number;
  @field('is_processed') isProcessed!: boolean;
  @field('chunk_count') chunkCount!: number;
  @field('is_enabled') isEnabled!: boolean;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // Helper methods
  get isReady(): boolean {
    return this.isProcessed && this.chunkCount > 0;
  }

  get processedDate(): Date | null {
    return this.processedAt ? new Date(this.processedAt) : null;
  }

  // Format file size for display
  get formattedSize(): string {
    const bytes = this.size;
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}