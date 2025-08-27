import {useEffect, useState} from 'react';
import {ragStore} from '../store/RAGStore';
import {modelStore} from '../store';
import {ragModelManager} from '../services/rag';
import {Model} from '../utils/types';

export interface RAGModelStatus {
  embeddingModelAvailable: boolean;
  embeddingModelLoaded: boolean;
  concurrentModeActive: boolean;
  isLoading: boolean;
  error: string | null;
  embeddingModel: Model | null;
  chatModel: Model | null;
}

export interface RAGModelActions {
  loadEmbeddingModel: () => Promise<void>;
  enableRAGMode: (chatModelId?: string) => Promise<void>;
  disableRAGMode: () => Promise<void>;
  switchToEmbeddingMode: () => Promise<void>;
  switchToChatMode: (modelId?: string) => Promise<void>;
  checkModelCompatibility: (modelId: string) => {isCompatible: boolean; reason?: string};
  clearError: () => void;
}

export function useRAGModels(): [RAGModelStatus, RAGModelActions] {
  const [status, setStatus] = useState<RAGModelStatus>({
    embeddingModelAvailable: false,
    embeddingModelLoaded: false,
    concurrentModeActive: false,
    isLoading: false,
    error: null,
    embeddingModel: null,
    chatModel: null,
  });

  // Update status when model manager state changes
  useEffect(() => {
    const updateStatus = () => {
      const modelStatus = ragModelManager.getStatus();
      setStatus({
        embeddingModelAvailable: modelStatus.embeddingModelAvailable,
        embeddingModelLoaded: modelStatus.embeddingModelLoaded,
        concurrentModeActive: modelStatus.concurrentModeActive,
        isLoading: modelStatus.isLoading,
        error: modelStatus.lastError?.getUserMessage() || null,
        embeddingModel: ragModelManager.embeddingModel,
        chatModel: ragModelManager.chatModel,
      });
    };

    // Initial update
    updateStatus();

    // Set up periodic updates (since we don't have direct observability)
    const interval = setInterval(updateStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  const actions: RAGModelActions = {
    loadEmbeddingModel: async () => {
      try {
        await ragStore.loadEmbeddingModel();
      } catch (error) {
        console.error('Failed to load embedding model:', error);
      }
    },

    enableRAGMode: async (chatModelId?: string) => {
      try {
        await ragStore.enableRAGMode(chatModelId);
      } catch (error) {
        console.error('Failed to enable RAG mode:', error);
      }
    },

    disableRAGMode: async () => {
      try {
        await ragStore.disableRAGMode();
      } catch (error) {
        console.error('Failed to disable RAG mode:', error);
      }
    },

    switchToEmbeddingMode: async () => {
      try {
        await ragStore.switchToEmbeddingMode();
      } catch (error) {
        console.error('Failed to switch to embedding mode:', error);
      }
    },

    switchToChatMode: async (modelId?: string) => {
      try {
        await ragStore.switchToChatMode(modelId);
      } catch (error) {
        console.error('Failed to switch to chat mode:', error);
      }
    },

    checkModelCompatibility: (modelId: string) => {
      return ragStore.checkModelCompatibility(modelId);
    },

    clearError: () => {
      ragStore.clearModelError();
    },
  };

  return [status, actions];
}

/**
 * Hook to check if RAG is ready for use
 */
export function useRAGReady(): boolean {
  const [status] = useRAGModels();
  return status.embeddingModelAvailable && status.embeddingModelLoaded;
}

/**
 * Hook to get available models for RAG chat mode
 */
export function useRAGCompatibleModels(): Model[] {
  const [compatibleModels, setCompatibleModels] = useState<Model[]>([]);

  useEffect(() => {
    const updateCompatibleModels = () => {
      const models = modelStore.displayModels.filter(model => {
        if (!model.isDownloaded) return false;
        
        const compatibility = ragStore.checkModelCompatibility(model.id);
        return compatibility.isCompatible;
      });
      
      setCompatibleModels(models);
    };

    // Initial update
    updateCompatibleModels();

    // Update when models change
    const interval = setInterval(updateCompatibleModels, 2000);

    return () => clearInterval(interval);
  }, []);

  return compatibleModels;
}

/**
 * Hook to automatically manage RAG model loading based on session state
 */
export function useAutoRAGModelManagement(isRAGEnabled: boolean, chatModelId?: string) {
  const [, actions] = useRAGModels();

  useEffect(() => {
    if (isRAGEnabled) {
      // Auto-enable RAG mode when needed
      actions.enableRAGMode(chatModelId);
    } else {
      // Auto-disable RAG mode when not needed
      actions.disableRAGMode();
    }
  }, [isRAGEnabled, chatModelId, actions]);
}