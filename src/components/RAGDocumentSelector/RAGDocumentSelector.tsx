import React from 'react';
import {View, ScrollView, TouchableOpacity} from 'react-native';
import {Text, Checkbox} from 'react-native-paper';
import {observer} from 'mobx-react';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';

export interface RAGDocument {
  id: string;
  name: string;
  isProcessed: boolean;
  chunkCount: number;
  formattedSize?: string;
}

export interface RAGDocumentSelectorProps {
  documents: RAGDocument[];
  selectedDocumentIds: string[];
  onSelectionChange: (documentIds: string[]) => void;
  maxSelections?: number;
}

export const RAGDocumentSelector: React.FC<RAGDocumentSelectorProps> = observer(
  ({
    documents,
    selectedDocumentIds,
    onSelectionChange,
    maxSelections = 5,
  }) => {
    const theme = useTheme();
    const styles = createStyles({theme});

    const handleDocumentToggle = (documentId: string) => {
      const isSelected = selectedDocumentIds.includes(documentId);
      
      if (isSelected) {
        // Remove from selection
        const newSelection = selectedDocumentIds.filter(id => id !== documentId);
        onSelectionChange(newSelection);
      } else {
        // Add to selection if under limit
        if (selectedDocumentIds.length < maxSelections) {
          const newSelection = [...selectedDocumentIds, documentId];
          onSelectionChange(newSelection);
        }
      }
    };

    const availableDocuments = documents.filter(doc => doc.isProcessed && doc.chunkCount > 0);

    if (availableDocuments.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text variant="bodyMedium" style={styles.emptyText}>
            No processed documents available for RAG.
          </Text>
          <Text variant="bodySmall" style={styles.emptySubtext}>
            Add and process PDF documents to enable RAG functionality.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text variant="titleMedium" style={styles.title}>
            Select Documents ({selectedDocumentIds.length}/{maxSelections})
          </Text>
          <Text variant="bodySmall" style={styles.subtitle}>
            Choose documents to include in RAG context
          </Text>
        </View>

        <ScrollView style={styles.documentList} showsVerticalScrollIndicator={false}>
          {availableDocuments.map(document => {
            const isSelected = selectedDocumentIds.includes(document.id);
            const canSelect = isSelected || selectedDocumentIds.length < maxSelections;

            return (
              <TouchableOpacity
                key={document.id}
                style={[
                  styles.documentItem,
                  isSelected && styles.documentItemSelected,
                  !canSelect && styles.documentItemDisabled,
                ]}
                onPress={() => canSelect && handleDocumentToggle(document.id)}
                disabled={!canSelect}>
                <View style={styles.documentContent}>
                  <Checkbox
                    status={isSelected ? 'checked' : 'unchecked'}
                    onPress={() => canSelect && handleDocumentToggle(document.id)}
                    disabled={!canSelect}
                  />
                  <View style={styles.documentInfo}>
                    <Text
                      variant="bodyMedium"
                      style={[
                        styles.documentName,
                        !canSelect && styles.documentNameDisabled,
                      ]}
                      numberOfLines={2}>
                      {document.name}
                    </Text>
                    <Text variant="bodySmall" style={styles.documentMeta}>
                      {document.chunkCount} chunks
                      {document.formattedSize && ` • ${document.formattedSize}`}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }
);