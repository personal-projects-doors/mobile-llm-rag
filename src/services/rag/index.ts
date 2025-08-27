export { PDFProcessor } from './PDFProcessor';
export { TextProcessor } from './TextProcessor';
export { TextChunker } from './TextChunker';
export { EmbeddingGenerator } from './EmbeddingGenerator';
export { SimilaritySearch } from './SimilaritySearch';
export { ContextAssembler } from './ContextAssembler';
export { RetrievalSystem } from './RetrievalSystem';
export { RAGMessageProcessor } from './RAGMessageProcessor';
export { CitationManager, citationManager } from './CitationManager';
export { RAGErrorHandler, ragErrorHandler } from './ErrorHandler';
export { RAGRecoveryManager, ragRecoveryManager } from './RecoveryManager';
export { PartialProcessor, createPartialProcessor } from './PartialProcessor';
export { RAGModelManager, ragModelManager } from './RAGModelManager';
export { RAGExample } from './example';

// Performance optimization components
export { BackgroundProcessor } from './BackgroundProcessor';
export { MemoryManager } from './MemoryManager';
export { DatabaseIndexer } from './DatabaseIndexer';
export { LazyLoader } from './LazyLoader';
export { ProcessingController } from './ProcessingController';
export { PerformanceOptimizer } from './PerformanceOptimizer';

export * from './types';