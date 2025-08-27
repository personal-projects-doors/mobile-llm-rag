import {Model} from '@nozbe/watermelondb';
import {field, readonly, date} from '@nozbe/watermelondb/decorators';

export interface RAGSettingsConfig {
  chunkSize: number;
  overlap: number;
  maxResults: number;
  minSimilarity: number;
  preserveSentences: boolean;
}

export const DEFAULT_RAG_SETTINGS: RAGSettingsConfig = {
  chunkSize: 512,
  overlap: 50,
  maxResults: 5,
  minSimilarity: 0.7,
  preserveSentences: true,
};

export default class RAGSettings extends Model {
  static table = 'rag_settings';

  @field('chunk_size') chunkSize!: number;
  @field('overlap') overlap!: number;
  @field('max_results') maxResults!: number;
  @field('min_similarity') minSimilarity!: number;
  @field('preserve_sentences') preserveSentences!: boolean;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // Helper methods
  get config(): RAGSettingsConfig {
    return {
      chunkSize: this.chunkSize,
      overlap: this.overlap,
      maxResults: this.maxResults,
      minSimilarity: this.minSimilarity,
      preserveSentences: this.preserveSentences,
    };
  }

  // Validation methods
  get isValidChunkSize(): boolean {
    return this.chunkSize >= 100 && this.chunkSize <= 2000;
  }

  get isValidOverlap(): boolean {
    return this.overlap >= 0 && this.overlap < this.chunkSize;
  }

  get isValidMaxResults(): boolean {
    return this.maxResults >= 1 && this.maxResults <= 20;
  }

  get isValidMinSimilarity(): boolean {
    return this.minSimilarity >= 0 && this.minSimilarity <= 1;
  }

  get isValid(): boolean {
    return (
      this.isValidChunkSize &&
      this.isValidOverlap &&
      this.isValidMaxResults &&
      this.isValidMinSimilarity
    );
  }

  // Performance impact indicators
  get performanceImpact(): 'low' | 'medium' | 'high' {
    const score = 
      (this.chunkSize > 1000 ? 2 : this.chunkSize > 500 ? 1 : 0) +
      (this.maxResults > 10 ? 2 : this.maxResults > 5 ? 1 : 0) +
      (this.overlap > 100 ? 1 : 0);
    
    if (score >= 4) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }
}