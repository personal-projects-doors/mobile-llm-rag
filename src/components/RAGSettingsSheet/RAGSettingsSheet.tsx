import React from 'react';
import {View} from 'react-native';
import {Text, Switch, Button} from 'react-native-paper';
import {observer} from 'mobx-react';

import {Sheet} from '../Sheet';
import {RAGDocumentSelector, RAGDocument} from '../RAGDocumentSelector';
import {useTheme} from '../../hooks';
import {createStyles} from './styles';

export interface RAGSettingsSheetProps {
  visible: boolean;
  onDismiss: () => void;
  ragEnabled: boolean;
  onRAGEnabledChange: (enabled: boolean) => void;
  selectedDocumentIds: string[];
  onDocumentSelectionChange: (documentIds: string[]) => void;
  availableDocuments: RAGDocument[];
  isLoading?: boolean;
}

export const RAGSettingsSheet: React.FC<RAGSettingsSheetProps> = observer(
  ({
    visible,
    onDismiss,
    ragEnabled,
    onRAGEnabledChange,
    selectedDocumentIds,
    onDocumentSelectionChange,
    availableDocuments,
    isLoading = false,
  }) => {
    const theme = useTheme();
    const styles = createStyles({theme});

    const handleRAGToggle = () => {
      const newEnabled = !ragEnabled;
      onRAGEnabledChange(newEnabled);
      
      // If disabling RAG, clear document selection
      if (!newEnabled) {
        onDocumentSelectionChange([]);
      }
    };

    const canEnableRAG = availableDocuments.some(doc => doc.isProcessed && doc.chunkCount > 0);

    return (
      <Sheet isVisible={visible} onDismiss={onDismiss}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text variant="headlineSmall" style={styles.title}>
              RAG Settings
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Configure Retrieval-Augmented Generation for document-aware conversations
            </Text>
          </View>

          <View style={styles.content}>
            {/* RAG Enable/Disable Toggle */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text variant="titleMedium" style={styles.settingTitle}>
                  Enable RAG Mode
                </Text>
                <Text variant="bodySmall" style={styles.settingDescription}>
                  Use document context to enhance AI responses
                </Text>
              </View>
              <Switch
                value={ragEnabled}
                onValueChange={handleRAGToggle}
                disabled={!canEnableRAG || isLoading}
              />
            </View>

            {!canEnableRAG && (
              <View style={styles.warningContainer}>
                <Text variant="bodySmall" style={styles.warningText}>
                  No processed documents available. Add and process PDF documents to enable RAG.
                </Text>
              </View>
            )}

            {/* Document Selection */}
            {ragEnabled && canEnableRAG && (
              <View style={styles.documentSection}>
                <RAGDocumentSelector
                  documents={availableDocuments}
                  selectedDocumentIds={selectedDocumentIds}
                  onSelectionChange={onDocumentSelectionChange}
                  maxSelections={5}
                />
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <Button
              mode="contained"
              onPress={onDismiss}
              style={styles.doneButton}>
              Done
            </Button>
          </View>
        </View>
      </Sheet>
    );
  }
);