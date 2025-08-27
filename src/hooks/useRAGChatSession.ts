import {useCallback} from 'react';
import {database} from '../database';
import {RAGMessageProcessor, EmbeddingGenerator, ragRecoveryManager} from '../services/rag';
import {chatSessionStore, modelStore} from '../store';
import {MessageType} from '../utils/types';

export const useRAGChatSession = () => {
  // Initialize RAG processor
  const createRAGProcessor = useCallback(async () => {
    const medgemmaModel = modelStore.models.find(m => m.id === 'unsloth/medgemma-4b-it-GGUF/medgemma-4b-it-IQ4_NL.gguf');
    
    if (!medgemmaModel) {
      throw new Error('unsloth/medgemma-4b-it-GGUF/medgemma-4b-it-IQ4_NL.gguf model not found for RAG');
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
    originalHandleSendPress: (message: MessageType.PartialText) => void,
    onError?: (error: string, recoveryActions?: any[]) => void
  ) => {
    const ragEnabled = chatSessionStore.activeRagEnabled;
    const ragDocumentIds = chatSessionStore.activeRagDocumentIds;

    // If RAG is not enabled or no documents selected, use original handler
    if (!ragEnabled || ragDocumentIds.length === 0) {
      originalHandleSendPress(message);
      return;
    }

    try {
      // Create RAG processor with error handling
      const ragProcessor = await ragRecoveryManager.recoverFromError(
        new Error('Creating RAG processor'), // Placeholder error for recovery context
        {
          operation: 'create_rag_processor',
          sessionId: chatSessionStore.activeSession?.id,
        },
        {
          retryAction: createRAGProcessor,
          fallbackAction: async () => {
            // Fallback: use normal chat
            originalHandleSendPress(message);
            return null;
          },
        }
      );

      if (!ragProcessor.success || !ragProcessor.result) {
        // Recovery manager handled the fallback
        return;
      }

      const processor = ragProcessor.result;

      // Check if RAG should be applied
      const shouldProcess = await processor.shouldProcessWithRAG(ragEnabled, ragDocumentIds);
      
      if (!shouldProcess) {
        // Fall back to normal processing
        originalHandleSendPress(message);
        return;
      }

      // Process message with RAG (error handling is now built into processMessage)
      const ragResult = await processor.processMessage(message.text, {
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
          fallbackUsed: ragResult.fallbackUsed,
          errorRecovered: ragResult.errorRecovered,
          partialResults: ragResult.partialResults,
        },
      };

      // Send the enhanced message
      originalHandleSendPress(enhancedMessage);

      // Notify user if fallback was used or errors were recovered
      if (ragResult.fallbackUsed && onError) {
        onError(
          'Document search temporarily unavailable. Continuing with normal chat.',
          []
        );
      } else if (ragResult.errorRecovered && onError) {
        onError(
          'Recovered from processing error. Some results may be limited.',
          []
        );
      }

    } catch (error) {
      console.error('RAG processing failed completely:', error);
      
      // Use recovery manager for final error handling
      const finalRecovery = await ragRecoveryManager.recoverFromError(
        error instanceof Error ? error : new Error('Unknown RAG error'),
        {
          operation: 'process_message_with_rag',
          sessionId: chatSessionStore.activeSession?.id,
        },
        {
          fallbackAction: async () => {
            originalHandleSendPress(message);
            return true;
          },
        }
      );

      if (finalRecovery.shouldNotifyUser && onError) {
        const recoveryActions = ragRecoveryManager.createUserRecoveryActions(
          error instanceof Error ? error : new Error('Unknown error'),
          {
            operation: 'process_message_with_rag',
            sessionId: chatSessionStore.activeSession?.id,
          }
        );
        
        onError(
          finalRecovery.userMessage || 'An error occurred while processing your message.',
          recoveryActions
        );
      }
    }
  }, [createRAGProcessor]);

  return {
    processMessageWithRAG,
  };
};