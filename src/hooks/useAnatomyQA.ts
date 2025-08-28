import React, { useState, useCallback } from 'react';
import { anatomyRAGService, AnatomyQAResult, AnatomyQAOptions } from '../services/AnatomyRAGService';
import { SearchResult as VectorSearchResult } from '../services/VectorService';

export interface UseAnatomyQAReturn {
  askQuestion: (question: string, options?: AnatomyQAOptions) => Promise<AnatomyQAResult>;
  isLoading: boolean;
  error: string | null;
  lastResult: AnatomyQAResult | null;
  isReady: boolean;
  suggestedQuestions: string[];
  anatomySystems: { name: string; keywords: string[] }[];
  getRelatedTopics: (topic: string) => Promise<VectorSearchResult[]>;
  clearError: () => void;
  clearResult: () => void;
}

export const useAnatomyQA = (): UseAnatomyQAReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AnatomyQAResult | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Check if service is ready
  React.useEffect(() => {
    const checkReady = async () => {
      try {
        const ready = await anatomyRAGService.isReady();
        setIsReady(ready);
      } catch (err) {
        setError('Failed to initialize anatomy Q&A system');
      }
    };
    
    checkReady();
  }, []);

  const askQuestion = useCallback(async (
    question: string, 
    options?: AnatomyQAOptions
  ): Promise<AnatomyQAResult> => {
    if (!question.trim()) {
      throw new Error('Question cannot be empty');
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await anatomyRAGService.askQuestion(question, options);
      setLastResult(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process question';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getRelatedTopics = useCallback(async (topic: string): Promise<VectorSearchResult[]> => {
    try {
      return await anatomyRAGService.getRelatedTopics(topic);
    } catch (err) {
      console.error('Error getting related topics:', err);
      return [];
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearResult = useCallback(() => {
    setLastResult(null);
  }, []);

  return {
    askQuestion,
    isLoading,
    error,
    lastResult,
    isReady,
    suggestedQuestions: anatomyRAGService.getSuggestedQuestions(),
    anatomySystems: anatomyRAGService.getAnatomySystems(),
    getRelatedTopics,
    clearError,
    clearResult,
  };
};