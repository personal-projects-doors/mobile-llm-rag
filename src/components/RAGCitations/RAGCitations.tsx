import React, {useState, useEffect, useRef} from 'react';
import {View, TouchableOpacity, ScrollView, Animated} from 'react-native';
import {Text, Card, Chip, IconButton, Divider} from 'react-native-paper';
import {observer} from 'mobx-react';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';
import {MessageType} from '../../utils/types';
import {citationManager} from '../../services/rag/CitationManager';
import {RAGLoadingIndicator} from '../RAGLoadingIndicator/RAGLoadingIndicator';

export interface RAGCitationsProps {
  citations: MessageType.RAGCitation[];
  onViewDocument?: (documentId: string, pageNumber: number) => void;
  onViewSourceExcerpt?: (citation: MessageType.RAGCitation) => void;
  showStats?: boolean;
  maxVisible?: number;
  isLoading?: boolean;
  loadingMessage?: string;
}

export const RAGCitations: React.FC<RAGCitationsProps> = observer(
  ({
    citations, 
    onViewDocument, 
    onViewSourceExcerpt,
    showStats = false,
    maxVisible = 3,
    isLoading = false,
    loadingMessage = 'Loading citations...'
  }) => {
    const theme = useTheme();
    const styles = createStyles({theme});
    const [expandedCitation, setExpandedCitation] = useState<string | null>(null);
    const [showAllCitations, setShowAllCitations] = useState(false);
    const [animatedHeight] = useState(new Animated.Value(0));
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, [fadeAnim]);

    if (isLoading) {
      return (
        <View style={styles.container}>
          <RAGLoadingIndicator
            loadingState={{
              stage: 'searching',
              progress: 0,
              message: loadingMessage,
            }}
            compact
            showProgress={false}
          />
        </View>
      );
    }

    if (!citations || citations.length === 0) {
      return null;
    }

    const stats = citationManager.getCitationStats(citations);
    const visibleCitations = showAllCitations ? citations : citations.slice(0, maxVisible);
    const hasMoreCitations = citations.length > maxVisible;

    const handleCitationPress = (citation: MessageType.RAGCitation) => {
      const citationKey = `${citation.documentId}-${citation.pageNumber}-${citation.startChar}`;
      setExpandedCitation(
        expandedCitation === citationKey ? null : citationKey
      );
    };

    const handleViewDocument = (citation: MessageType.RAGCitation) => {
      onViewDocument?.(citation.documentId, citation.pageNumber);
    };

    const handleViewSourceExcerpt = (citation: MessageType.RAGCitation) => {
      onViewSourceExcerpt?.(citation);
    };

    const toggleShowAll = () => {
      setShowAllCitations(!showAllCitations);
      Animated.timing(animatedHeight, {
        toValue: showAllCitations ? 0 : 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    };

    return (
      <Animated.View style={[styles.container, {opacity: fadeAnim}]}>
        <View style={styles.header}>
          <Text variant="labelMedium" style={styles.title}>
            Sources ({citations.length})
          </Text>
          {showStats && (
            <Text variant="bodySmall" style={styles.stats}>
              {stats.uniqueDocuments} documents • {Math.round(stats.averageSimilarity * 100)}% avg relevance
            </Text>
          )}
        </View>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.citationsScroll}
          contentContainerStyle={styles.citationsContent}>
          {visibleCitations.map((citation, index) => {
            const citationKey = `${citation.documentId}-${citation.pageNumber}-${citation.startChar}`;
            const isExpanded = expandedCitation === citationKey;
            const similarity = Math.round(citation.similarity * 100);

            return (
              <Card key={citationKey} style={styles.citationCard}>
                <TouchableOpacity
                  onPress={() => handleCitationPress(citation)}
                  style={styles.citationHeader}>
                  <View style={styles.citationInfo}>
                    <Text variant="bodySmall" style={styles.documentName} numberOfLines={1}>
                      {citation.documentName}
                    </Text>
                    <View style={styles.citationMeta}>
                      <Chip compact style={styles.pageChip}>
                        Page {citation.pageNumber}
                      </Chip>
                      <Chip compact style={styles.similarityChip}>
                        {similarity}%
                      </Chip>
                    </View>
                  </View>
                  <IconButton
                    icon={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    style={styles.expandIcon}
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.citationContent}>
                    <Divider style={styles.divider} />
                    <Text variant="bodySmall" style={styles.citationText}>
                      {citation.chunkText}
                    </Text>
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleViewSourceExcerpt(citation)}>
                        <Text variant="labelSmall" style={styles.actionButtonText}>
                          View Context
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.primaryButton]}
                        onPress={() => handleViewDocument(citation)}>
                        <Text variant="labelSmall" style={styles.primaryButtonText}>
                          View Document
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </Card>
            );
          })}
        </ScrollView>

        {hasMoreCitations && (
          <TouchableOpacity
            style={styles.showMoreButton}
            onPress={toggleShowAll}>
            <Text variant="labelSmall" style={styles.showMoreText}>
              {showAllCitations 
                ? `Show Less` 
                : `Show ${citations.length - maxVisible} More Sources`
              }
            </Text>
            <IconButton
              icon={showAllCitations ? 'chevron-up' : 'chevron-down'}
              size={16}
            />
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  }
);