import { useState, useEffect, useCallback } from 'react';
import { vectorService, SearchResult, VectorChunk } from '../services/VectorService';

export interface UseVectorSearchReturn {
  search: (query: string, topK?: number) => Promise<SearchResult[]>;
  searchResults: SearchResult[];
  isLoading: boolean;
  error: string | null;
  isReady: boolean;
  getAllChunks: () => Promise<VectorChunk[]>;
  getChunksByPage: (page: number) => Promise<VectorChunk[]>;
  clearCache: () => Promise<void>;
}

export const useVectorSearch = (): UseVectorSearchReturn => {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeVectors = async () => {
      try {
        setIsLoading(true);
        await vectorService.loadVectors();
        setIsReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize vectors');
      } finally {
        setIsLoading(false);
      }
    };

    initializeVectors();
  }, []);

  const search = useCallback(async (query: string, topK: number = 5): Promise<SearchResult[]> => {
    if (!isReady) {
      throw new Error('Vector service not ready');
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Use text-based search for now (can be enhanced with actual embeddings later)
      const results = await vectorService.searchByText(query, topK);
      setSearchResults(results);
      
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [isReady]);

  const getAllChunks = useCallback(async (): Promise<VectorChunk[]> => {
    return vectorService.getAllChunks();
  }, []);

  const getChunksByPage = useCallback(async (page: number): Promise<VectorChunk[]> => {
    return vectorService.getChunksByPage(page);
  }, []);

  const clearCache = useCallback(async (): Promise<void> => {
    await vectorService.clearCache();
    setIsReady(false);
    setSearchResults([]);
  }, []);

  return {
    search,
    searchResults,
    isLoading,
    error,
    isReady,
    getAllChunks,
    getChunksByPage,
    clearCache,
  };
};