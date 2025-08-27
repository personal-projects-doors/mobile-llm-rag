import AsyncStorage from '@react-native-async-storage/async-storage';
import {RAGStore} from '../RAGStore';
import {DEFAULT_RAG_SETTINGS} from '../../database/models/RAGSettings';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock database
jest.mock('../../database', () => ({
  database: {
    get: jest.fn(),
    write: jest.fn(),
  },
}));

// Mock mobx-persist-store
jest.mock('mobx-persist-store', () => ({
  makePersistable: jest.fn(),
}));

describe('RAGStore', () => {
  let ragStore: RAGStore;
  const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

  beforeEach(() => {
    jest.clearAllMocks();
    ragStore = new RAGStore();
  });

  describe('initialization', () => {
    it('should initialize with correct initial state', () => {
      // mobx-persist-store initializes settings as empty object initially
      expect(ragStore.settings).toBeDefined();
      expect(ragStore.isLoading).toBe(false);
      expect(ragStore.isInitialized).toBe(false);
      expect(ragStore.error).toBeNull();
    });
  });

  describe('validation', () => {
    it('should validate chunk size correctly', () => {
      expect(ragStore.validateSettings({...DEFAULT_RAG_SETTINGS, chunkSize: 50}))
        .toBe('Chunk size must be between 100 and 2000 tokens');
      
      expect(ragStore.validateSettings({...DEFAULT_RAG_SETTINGS, chunkSize: 3000}))
        .toBe('Chunk size must be between 100 and 2000 tokens');
      
      expect(ragStore.validateSettings({...DEFAULT_RAG_SETTINGS, chunkSize: 512}))
        .toBeNull();
    });

    it('should validate overlap correctly', () => {
      expect(ragStore.validateSettings({...DEFAULT_RAG_SETTINGS, overlap: -1}))
        .toBe('Overlap must be between 0 and chunk size');
      
      expect(ragStore.validateSettings({...DEFAULT_RAG_SETTINGS, chunkSize: 512, overlap: 600}))
        .toBe('Overlap must be between 0 and chunk size');
      
      expect(ragStore.validateSettings({...DEFAULT_RAG_SETTINGS, overlap: 50}))
        .toBeNull();
    });

    it('should validate max results correctly', () => {
      expect(ragStore.validateSettings({...DEFAULT_RAG_SETTINGS, maxResults: 0}))
        .toBe('Max results must be between 1 and 20');
      
      expect(ragStore.validateSettings({...DEFAULT_RAG_SETTINGS, maxResults: 25}))
        .toBe('Max results must be between 1 and 20');
      
      expect(ragStore.validateSettings({...DEFAULT_RAG_SETTINGS, maxResults: 5}))
        .toBeNull();
    });

    it('should validate min similarity correctly', () => {
      expect(ragStore.validateSettings({...DEFAULT_RAG_SETTINGS, minSimilarity: -0.1}))
        .toBe('Minimum similarity must be between 0 and 1');
      
      expect(ragStore.validateSettings({...DEFAULT_RAG_SETTINGS, minSimilarity: 1.5}))
        .toBe('Minimum similarity must be between 0 and 1');
      
      expect(ragStore.validateSettings({...DEFAULT_RAG_SETTINGS, minSimilarity: 0.7}))
        .toBeNull();
    });
  });

  describe('performance impact calculation', () => {
    it('should calculate low performance impact', () => {
      const lowImpactSettings = {
        chunkSize: 300,
        overlap: 30,
        maxResults: 3,
        minSimilarity: 0.8,
        preserveSentences: true,
      };
      
      expect(ragStore.getPerformanceImpact(lowImpactSettings)).toBe('low');
    });

    it('should calculate medium performance impact', () => {
      const mediumImpactSettings = {
        chunkSize: 800,
        overlap: 80,
        maxResults: 8,
        minSimilarity: 0.6,
        preserveSentences: true,
      };
      
      expect(ragStore.getPerformanceImpact(mediumImpactSettings)).toBe('medium');
    });

    it('should calculate high performance impact', () => {
      const highImpactSettings = {
        chunkSize: 1500,
        overlap: 150,
        maxResults: 15,
        minSimilarity: 0.5,
        preserveSentences: true,
      };
      
      expect(ragStore.getPerformanceImpact(highImpactSettings)).toBe('high');
    });
  });

  describe('performance descriptions', () => {
    it('should provide correct performance descriptions', () => {
      expect(ragStore.getPerformanceDescription('low'))
        .toBe('Minimal impact on processing speed and memory usage');
      
      expect(ragStore.getPerformanceDescription('medium'))
        .toBe('Moderate impact on processing speed and memory usage');
      
      expect(ragStore.getPerformanceDescription('high'))
        .toBe('Significant impact on processing speed and memory usage');
    });
  });

  describe('error handling', () => {
    it('should clear error state', () => {
      ragStore.error = 'Test error';
      ragStore.clearError();
      expect(ragStore.error).toBeNull();
    });
  });

  describe('migration status', () => {
    it('should return pending when not initialized', () => {
      expect(ragStore.migrationStatus).toBe('pending');
    });

    it('should return not_needed when initialized without migration', () => {
      ragStore.isInitialized = true;
      ragStore.migrationCompleted = false;
      expect(ragStore.migrationStatus).toBe('not_needed');
    });

    it('should return completed when migration is done', () => {
      ragStore.isInitialized = true;
      ragStore.migrationCompleted = true;
      expect(ragStore.migrationStatus).toBe('completed');
    });
  });
});