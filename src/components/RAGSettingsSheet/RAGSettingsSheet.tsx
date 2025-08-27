import React from 'react';
import {View} from 'react-native';
import {Text, Switch, Button, Chip, Divider} from 'react-native-paper';
import {observer} from 'mobx-react';

import {Sheet} from '../Sheet';
import {RAGDocumentSelector, RAGDocument} from '../RAGDocumentSelector';
import {RAGLoadingIndicator} from '../RAGLoadingIndicator';
import {RAGTooltip} from '../RAGTooltip';
import {useTheme} from '../../hooks';
import {ragStore} from '../../store';
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
  onOpenAdvancedSettings?: () => void;
  processingState?: any;
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
    onOpenAdvancedSettings,
    processingState,
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
    
    // Initialize RAG store if not already done
    React.useEffect(() => {
      if (!ragStore.isInitialized) {
        ragStore.initialize();
      }
    }, []);

    const performanceImpact = ragStore.getPerformanceImpact();
    const getPerformanceColor = (impact: 'low' | 'medium' | 'high') => {
      switch (impact) {
        case 'low':
          return theme.colors.primary;
        case 'medium':
          return theme.colors.tertiary;
        case 'high':
          return theme.colors.error;
      }
    };

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

            {!canEnableRAG && !processingState && (
              <View style={styles.warningContainer}>
                <Text variant="bodySmall" style={styles.warningText}>
                  No processed documents available. Add and process PDF documents to enable RAG.
                </Text>
              </View>
            )}

            {/* Processing State */}
            {processingState && (
              <View style={styles.processingContainer}>
                <RAGLoadingIndicator
                  loadingState={processingState}
                  showProgress={true}
                  compact={false}
                />
              </View>
            )}

            {/* Performance Impact Indicator */}
            {ragEnabled && (
              <>
                <Divider style={styles.divider} />
                <View style={styles.performanceSection}>
                  <Text variant="titleSmall" style={styles.sectionTitle}>
                    Current Performance Impact
                  </Text>
                  <View style={styles.performanceContainer}>
                    <Chip
                      mode="outlined"
                      textStyle={[styles.performanceChip, {color: getPerformanceColor(performanceImpact)}]}
                      style={[styles.performanceChipContainer, {borderColor: getPerformanceColor(performanceImpact)}]}>
                      {performanceImpact.toUpperCase()}
                    </Chip>
                    <Text variant="bodySmall" style={styles.performanceDescription}>
                      Chunk Size: {ragStore.chunkSize} • Max Results: {ragStore.maxResults}
                    </Text>
                  </View>
                </View>
              </>
            )}

            {/* Document Selection */}
            {ragEnabled && canEnableRAG && (
              <>
                <Divider style={styles.divider} />
                <View style={styles.documentSection}>
                  <RAGDocumentSelector
                    documents={availableDocuments}
                    selectedDocumentIds={selectedDocumentIds}
                    onSelectionChange={onDocumentSelectionChange}
                    maxSelections={5}
                  />
                </View>
              </>
            )}
          </View>

          <View style={styles.footer}>
            {onOpenAdvancedSettings && (
              <Button
                mode="outlined"
                onPress={onOpenAdvancedSettings}
                style={styles.advancedButton}
                icon="cog">
                Advanced Settings
              </Button>
            )}
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