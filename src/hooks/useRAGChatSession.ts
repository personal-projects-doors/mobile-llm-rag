import {useCallback} from 'react';
import {database} from '../database';
import {RAGMessageProcessor, EmbeddingGenerator} from '../services/rag';
import {chatSessionStore, modelStore} from '../store';
import {MessageType} from '../utils/types';

export const useRAGChatSession = () => {
  // Initialize RAG processor
  const createRAGProcessor = useCallback(async () => {
    const medgemmaModel = modelStore.models.find(m => m.id === 'medgemma-4b-it-Q2_K_L');
    
    if (!medgemmaModel) {
      throw new Error('medgemma-4b-it-Q2_K_L model not found for RAG');
    }

    const embeddingGenerator = new EmbeddingGenerator({
      model: medgemmaModel,
      config: {
        batchSize: 1,
        maxTokens: 512,
        normalize: true,
      },
    });

    return new RAGMessageProcessor(database, embeddingGenerator);
  }, []);

  // Enhanced message processing with RAG
  const processMessageWithRAG = useCallback(async (
    message: MessageType.PartialText,
    originalHandleSendPress: (message: MessageType.PartialText) => void
  ) => {
    const ragEnabled = chatSessionStore.activeRagEnabled;
    const ragDocumentIds = chatSessionStore.activeRagDocumentIds;

    // If RAG is not enabled or no documents selected, use original handler
    if (!ragEnabled || ragDocumentIds.length === 0) {
      originalHandleSendPress(message);
      return;
    }

    try {
      // Create RAG processor
      const ragProcessor = await createRAGProcessor();

      // Check if RAG should be applied
      const shouldProcess = await ragProcessor.shouldProcessWithRAG(ragEnabled, ragDocumentIds);
      
      if (!shouldProcess) {
        // Fall back to normal processing
        originalHandleSendPress(message);
        return;
      }

      // Process message with RAG
      const ragResult = await ragProcessor.processMessage(message.text, {
        maxResults: 5,
        minSimilarity: 0.7,
        documentIds: ragDocumentIds,
        maxTokens: 2000,
      });

      // Create enhanced message with RAG metadata
      const enhancedMessage: MessageType.PartialText = {
        ...message,
        text: ragResult.enhancedPrompt,
        metadata: {
          ...message.metadata,
          ragEnabled: true,
          retrievalContext: {
            query: ragResult.originalQuery,
            totalChunks: ragResult.retrievalContext.totalChunks,
            processingTime: ragResult.retrievalContext.processingTime,
          },
          citations: ragResult.citations,
        },
      };

      // Send the enhanced message
      originalHandleSendPress(enhancedMessage);

    } catch (error) {
      console.error('RAG processing failed, falling back to normal chat:', error);
      // Fall back to normal processing on error
      originalHandleSendPress(message);
    }
  }, [createRAGProcessor]);

  return {
    processMessageWithRAG,
  };
};