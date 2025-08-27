import React, {useState, useEffect} from 'react';
import {View, ScrollView, TouchableOpacity} from 'react-native';
import {Text, Card, Chip, IconButton, ActivityIndicator} from 'react-native-paper';
import {observer} from 'mobx-react';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';
import {MessageType} from '../../utils/types';
import {citationManager, CitationContext} from '../../services/rag/CitationManager';

export interface SourceExcerptViewerProps {
  citation: MessageType.RAGCitation;
  onViewDocument?: (documentId: string, pageNumber: number) => void;
  onClose?: () => void;
  showFullContext?: boolean;
}

export const SourceExcerptViewer: React.FC<SourceExcerptViewerProps> = observer(
  ({citation, onViewDocument, onClose, showFullContext = true}) => {
    const theme = useTheme();
    const styles = createStyles({theme});
    const [context, setContext] = useState<CitationContext | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      loadContext();
    }, [citation]);

    const loadContext = async () => {
      setLoading(true);
      try {
        const citationContext = citationManager.getCitationContext(citation);
        setContext(citationContext);
      } catch (error) {
        console.error('Failed to load citation context:', error);
      } finally {
        setLoading(false);
      }
    };

    const handleViewDocument = () => {
      onViewDocument?.(citation.documentId, citation.pageNumber);
    };

    const similarity = Math.round(citation.similarity * 100);

    if (loading) {
      return (
        <Card style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" />
            <Text variant="bodyMedium" style={styles.loadingText}>
              Loading context...
            </Text>
          </View>
        </Card>
      );
    }

    return (
      <Card style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text variant="titleSmall" style={styles.documentName} numberOfLines={1}>
              {citation.documentName}
            </Text>
            <View style={styles.metadata}>
              <Chip compact style={styles.pageChip}>
                Page {citation.pageNumber}
              </Chip>
              <Chip compact style={styles.similarityChip}>
                {similarity}% relevance
              </Chip>
            </View>
          </View>
          {onClose && (
            <IconButton
              icon="close"
              size={20}
              onPress={onClose}
              style={styles.closeButton}
            />
          )}
        </View>

        <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.excerptContainer}>
            <Text variant="labelSmall" style={styles.sectionLabel}>
              Relevant Excerpt
            </Text>
            <View style={styles.excerptBox}>
              <Text variant="bodyMedium" style={styles.excerptText}>
                {citation.chunkText}
              </Text>
            </View>
          </View>

          {showFullContext && context?.fullContext && context.fullContext !== citation.chunkText && (
            <View style={styles.contextContainer}>
              <Text variant="labelSmall" style={styles.sectionLabel}>
                Extended Context
              </Text>
              <View style={styles.contextBox}>
                <Text variant="bodyMedium" style={styles.contextText}>
                  {context.fullContext}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.detailsContainer}>
            <Text variant="labelSmall" style={styles.sectionLabel}>
              Source Details
            </Text>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text variant="bodySmall" style={styles.detailLabel}>
                  Character Range
                </Text>
                <Text variant="bodySmall" style={styles.detailValue}>
                  {citation.startChar} - {citation.endChar}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text variant="bodySmall" style={styles.detailLabel}>
                  Chunk Index
                </Text>
                <Text variant="bodySmall" style={styles.detailValue}>
                  {context?.chunkIndex ?? 'N/A'}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text variant="bodySmall" style={styles.detailLabel}>
                  Similarity Score
                </Text>
                <Text variant="bodySmall" style={styles.detailValue}>
                  {citation.similarity.toFixed(3)}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleViewDocument}>
            <Text variant="labelMedium" style={styles.actionButtonText}>
              View Full Document
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  }
);