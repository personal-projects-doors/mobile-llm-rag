import React, {useRef, ReactNode, useState, useEffect, useCallback} from 'react';

import {observer} from 'mobx-react';

import {Bubble, ChatView, ErrorSnackbar, RAGSettingsSheet, RAGStatusIndicator, RAGOnboarding, RAGLoadingIndicator} from '../../components';
import {RAGDocument} from '../../components/RAGDocumentSelector';

import {useChatSession} from '../../hooks';
import {useRAGChatSession} from '../../hooks/useRAGChatSession';
import {useRAGOnboarding} from '../../hooks/useRAGOnboarding';

import {modelStore, chatSessionStore, palStore, uiStore} from '../../store';
import {database} from '../../database';
import {RAGMessageProcessor, EmbeddingGenerator} from '../../services/rag';

import {L10nContext} from '../../utils';
import {MessageType} from '../../utils/types';
import {user, assistant} from '../../utils/chat';

import {VideoPalScreen} from './VideoPalScreen';
import {PalType} from '../../components/PalsSheets/types';

const renderBubble = ({
  child,
  message,
  nextMessageInGroup,
  scale,
}: {
  child: ReactNode;
  message: MessageType.Any;
  nextMessageInGroup: boolean;
  scale?: any;
}) => (
  <Bubble
    child={child}
    message={message}
    nextMessageInGroup={nextMessageInGroup}
    scale={scale}
  />
);

export const ChatScreen: React.FC = observer(() => {
  const currentMessageInfo = useRef<{
    createdAt: number;
    id: string;
    sessionId: string;
  } | null>(null);
  const l10n = React.useContext(L10nContext);

  const {handleSendPress: originalHandleSendPress, handleStopPress, isMultimodalEnabled} =
    useChatSession(currentMessageInfo, user, assistant);

  const {processMessageWithRAG} = useRAGChatSession();
  const {onboardingCompleted, tooltipShown, markOnboardingCompleted, markTooltipShown} = useRAGOnboarding();

  // Enhanced send handler with RAG processing
  const handleSendPress = useCallback(
    (message: MessageType.PartialText) => {
      processMessageWithRAG(message, originalHandleSendPress);
    },
    [processMessageWithRAG, originalHandleSendPress]
  );

  // RAG state
  const [showRAGSettings, setShowRAGSettings] = useState(false);
  const [availableDocuments, setAvailableDocuments] = useState<RAGDocument[]>([]);
  const [ragProcessor, setRagProcessor] = useState<RAGMessageProcessor | null>(null);
  const [showRAGOnboarding, setShowRAGOnboarding] = useState(false);
  const [showRAGTooltip, setShowRAGTooltip] = useState(false);
  const [ragProcessingState, setRagProcessingState] = useState<any>(null);

  // Check if multimodal is enabled
  const [multimodalEnabled, setMultimodalEnabled] = React.useState(false);

  React.useEffect(() => {
    const checkMultimodal = async () => {
      const enabled = await isMultimodalEnabled();
      setMultimodalEnabled(enabled);
    };

    checkMultimodal();
  }, [isMultimodalEnabled]);

  // Initialize RAG processor and load available documents
  useEffect(() => {
    const initializeRAG = async () => {
      try {
        // Find the medgemma model
        const medgemmaModel = modelStore.models.find(m => m.id === 'medgemma-4b-it-Q2_K_L');
        
        if (!medgemmaModel) {
          console.warn('medgemma-4b-it-Q2_K_L model not found for RAG');
          return;
        }

        // Initialize embedding generator with medgemma model
        const embeddingGenerator = new EmbeddingGenerator({
          model: medgemmaModel,
          config: {
            batchSize: 1,
            maxTokens: 512,
            normalize: true,
          },
        });

        // Initialize RAG processor
        const processor = new RAGMessageProcessor(database, embeddingGenerator);
        setRagProcessor(processor);

        // Load available documents
        const documents = await processor.getAvailableDocuments();
        setAvailableDocuments(documents.map(doc => ({
          ...doc,
          formattedSize: undefined, // Will be populated by the document model if needed
        })));
      } catch (error) {
        console.error('Failed to initialize RAG:', error);
      }
    };

    initializeRAG();
  }, []);

  const thinkingSupported = modelStore.activeModel?.supportsThinking ?? false;

  const thinkingEnabled = (() => {
    const currentSession = chatSessionStore.sessions.find(
      s => s.id === chatSessionStore.activeSessionId,
    );
    const settings =
      currentSession?.completionSettings ??
      chatSessionStore.newChatCompletionSettings;
    return settings.enable_thinking ?? true;
  })();

  // Show loading bubble only during the thinking phase (inferencing but not streaming)
  const isThinking = modelStore.inferencing && !modelStore.isStreaming;

  const handleThinkingToggle = async (enabled: boolean) => {
    const currentSession = chatSessionStore.sessions.find(
      s => s.id === chatSessionStore.activeSessionId,
    );

    if (currentSession) {
      // Update session-specific settings
      const updatedSettings = {
        ...currentSession.completionSettings,
        enable_thinking: enabled,
      };
      await chatSessionStore.updateSessionCompletionSettings(updatedSettings);
    } else {
      // Update global settings for new chats
      const updatedSettings = {
        ...chatSessionStore.newChatCompletionSettings,
        enable_thinking: enabled,
      };
      await chatSessionStore.setNewChatCompletionSettings(updatedSettings);
    }
  };

  // RAG handlers
  const handleRAGToggle = () => {
    // Check if this is the first time user is accessing RAG
    const isFirstTimeRAG = !onboardingCompleted && availableDocuments.length === 0;
    
    if (isFirstTimeRAG) {
      setShowRAGOnboarding(true);
    } else {
      setShowRAGSettings(true);
    }
  };

  const handleRAGEnabledChange = async (enabled: boolean) => {
    await chatSessionStore.setRagEnabled(enabled);
    
    // Show tooltip for first-time RAG enablement
    if (enabled && !tooltipShown) {
      setShowRAGTooltip(true);
      markTooltipShown();
    }
  };

  const handleDocumentSelectionChange = async (documentIds: string[]) => {
    await chatSessionStore.setRagDocumentIds(documentIds);
  };

  const handleRAGOnboardingDismiss = () => {
    setShowRAGOnboarding(false);
    markOnboardingCompleted();
  };

  const handleRAGOnboardingGetStarted = () => {
    setShowRAGOnboarding(false);
    setShowRAGSettings(true);
    markOnboardingCompleted();
  };

  const handleRAGTooltipDismiss = () => {
    setShowRAGTooltip(false);
  };

  // Get current RAG state
  const ragEnabled = chatSessionStore.activeRagEnabled;
  const ragDocumentIds = chatSessionStore.activeRagDocumentIds;
  const hasRAGDocuments = ragDocumentIds.length > 0;

  const activePalId = chatSessionStore.activePalId;
  const activePal = activePalId
    ? palStore.pals.find(p => p.id === activePalId)
    : undefined;
  const isVideoPal = activePal?.palType === PalType.VIDEO;

  // If the active pal is a video pal, show the video pal screen
  if (isVideoPal) {
    return <VideoPalScreen />;
  }

  // Otherwise, show the regular chat view
  return (
    <>
      <ChatView
        renderBubble={renderBubble}
        messages={chatSessionStore.currentSessionMessages}
        onSendPress={handleSendPress}
        onStopPress={handleStopPress}
        user={user}
        isStopVisible={modelStore.inferencing}
        isThinking={isThinking}
        isStreaming={modelStore.isStreaming}
        sendButtonVisibilityMode="always"
        showImageUpload={true}
        isVisionEnabled={multimodalEnabled}
        customContent={
          <RAGStatusIndicator
            ragEnabled={ragEnabled && hasRAGDocuments}
            documentCount={ragDocumentIds.length}
            onPress={() => setShowRAGSettings(true)}
          />
        }
        inputProps={{
          showThinkingToggle: thinkingSupported,
          isThinkingEnabled: thinkingEnabled,
          onThinkingToggle: handleThinkingToggle,
          showRAGToggle: availableDocuments.length > 0,
          isRAGEnabled: ragEnabled && hasRAGDocuments,
          onRAGToggle: handleRAGToggle,
          showRAGTooltip: showRAGTooltip,
          onRAGTooltipDismiss: handleRAGTooltipDismiss,
        }}
        textInputProps={{
          editable: !!modelStore.context,
          placeholder: !modelStore.context
            ? modelStore.isContextLoading
              ? l10n.chat.loadingModel
              : l10n.chat.modelNotLoaded
            : l10n.chat.typeYourMessage,
        }}
      />
      {uiStore.chatWarning && (
        <ErrorSnackbar
          error={uiStore.chatWarning}
          onDismiss={() => uiStore.clearChatWarning()}
        />
      )}
      
      <RAGSettingsSheet
        visible={showRAGSettings}
        onDismiss={() => setShowRAGSettings(false)}
        ragEnabled={ragEnabled}
        onRAGEnabledChange={handleRAGEnabledChange}
        selectedDocumentIds={ragDocumentIds}
        onDocumentSelectionChange={handleDocumentSelectionChange}
        availableDocuments={availableDocuments}
      />
      
      <RAGOnboarding
        visible={showRAGOnboarding}
        onDismiss={handleRAGOnboardingDismiss}
        onGetStarted={handleRAGOnboardingGetStarted}
      />
    </>
  );
});
