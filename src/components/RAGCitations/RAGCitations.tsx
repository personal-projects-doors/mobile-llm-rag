import React, {useState} from 'react';
import {View, TouchableOpacity, ScrollView} from 'react-native';
import {Text, Card, Chip} from 'react-native-paper';
import {observer} from 'mobx-react';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';
import {MessageType} from '../../utils/types';

export interface RAGCitationsProps {
  citations: MessageType.RAGCitation[];
  onViewDocument?: (documentId: string, pageNumber: number) => void;
}

export const RAGCitations: React.FC<RAGCitationsProps> = observer(
  ({citations, onViewDocument}) => {
    const theme = useTheme();
    const styles = createStyles({theme});
    const [expandedCitation, setExpandedCitation] = useState<string | null>(null);

    if (!citations || citations.length === 0) {
      return null;
    }

    const handleCitationPress = (citation: MessageType.RAGCitation) => {
      const citationKey = `${citation.documentId}-${citation.pageNumber}`;
      setExpandedCitation(
        expandedCitation === citationKey ? null : citationKey
      );
    };

    const handleViewDocument = (citation: MessageType.RAGCitation) => {
      onViewDocument?.(citation.documentId, citation.pageNumber);
    };

    return (
      <View style={styles.container}>
        <Text variant="labelMedium" style={styles.title}>
          Sources ({citations.length})
        </Text>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.citationsScroll}
          contentContainerStyle={styles.citationsContent}>
          {citations.map((citation, index) => {
            const citationKey = `${citation.documentId}-${citation.pageNumber}`;
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
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.citationContent}>
                    <Text variant="bodySmall" style={styles.citationText} numberOfLines={4}>
                      {citation.chunkText}
                    </Text>
                    <TouchableOpacity
                      style={styles.viewDocumentButton}
                      onPress={() => handleViewDocument(citation)}>
                      <Text variant="labelSmall" style={styles.viewDocumentText}>
                        View Full Document
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Card>
            );
          })}
        </ScrollView>
      </View>
    );
  }
);