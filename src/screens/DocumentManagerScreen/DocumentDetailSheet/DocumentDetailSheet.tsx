import React, {useState, useEffect} from 'react';
import {View, ScrollView, Alert} from 'react-native';

import {
  Modal,
  Portal,
  Text,
  Button,
  Divider,
  Switch,
  List,
  IconButton,
  Card,
} from 'react-native-paper';

import {Q} from '@nozbe/watermelondb';

import {useTheme} from '../../../hooks';
import {createStyles} from './styles';
import {RAGDocument, RAGChunk} from '../../../database/models';
import {database} from '../../../database';

interface DocumentDetailSheetProps {
  visible: boolean;
  document: RAGDocument | null;
  onDismiss: () => void;
  onDelete: (document: RAGDocument) => void;
  onToggleEnabled: (document: RAGDocument) => void;
}

export const DocumentDetailSheet: React.FC<DocumentDetailSheetProps> = ({
  visible,
  document,
  onDismiss,
  onDelete,
  onToggleEnabled,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  
  const [chunks, setChunks] = useState<RAGChunk[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);

  useEffect(() => {
    if (visible && document) {
      loadChunks();
    }
  }, [visible, document]);

  const loadChunks = async () => {
    if (!document) return;
    
    setLoadingChunks(true);
    try {
      const chunksCollection = database.get<RAGChunk>('rag_chunks');
      const documentChunks = await chunksCollection
        .query(Q.where('document_id', document.id))
        .fetch();
      setChunks(documentChunks);
    } catch (error) {
      console.error('Failed to load chunks:', error);
    } finally {
      setLoadingChunks(false);
    }
  };

  const handleDelete = () => {
    if (!document) return;
    
    Alert.alert(
      'Delete Document',
      `Are you sure you want to delete "${document.name}"? This will also delete all associated chunks and cannot be undone.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(document);
            onDismiss();
          },
        },
      ]
    );
  };

  const handleToggleEnabled = () => {
    if (!document) return;
    onToggleEnabled(document);
  };

  const handleReprocess = () => {
    if (!document) return;
    
    Alert.alert(
      'Reprocess Document',
      'This will delete existing chunks and reprocess the document. Continue?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reprocess',
          onPress: () => {
            // TODO: Implement reprocessing (will be done in later tasks)
            console.log('Reprocessing document:', document.id);
          },
        },
      ]
    );
  };

  if (!document) return null;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>
            {document.name}
          </Text>
          <IconButton
            icon="close"
            size={24}
            onPress={onDismiss}
            style={styles.closeButton}
          />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Document Status */}
          <Card style={styles.section}>
            <Card.Content>
              <View style={styles.statusRow}>
                <Text style={styles.sectionTitle}>Status</Text>
                <View style={styles.statusContainer}>
                  <Text style={styles.statusLabel}>Enabled</Text>
                  <Switch
                    value={document.isEnabled}
                    onValueChange={handleToggleEnabled}
                  />
                </View>
              </View>
              
              <View style={styles.statusInfo}>
                <Text style={styles.statusText}>
                  {document.isProcessed ? 'Processed and ready for use' : 'Not processed yet'}
                </Text>
                {document.processedDate && (
                  <Text style={styles.processedDate}>
                    Processed on {document.processedDate.toLocaleString()}
                  </Text>
                )}
              </View>
            </Card.Content>
          </Card>

          {/* Document Metadata */}
          <Card style={styles.section}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Document Information</Text>
              
              <List.Item
                title="File Size"
                description={document.formattedSize}
                left={(props) => <List.Icon {...props} icon="file" />}
              />
              
              <List.Item
                title="Page Count"
                description={document.pageCount > 0 ? `${document.pageCount} pages` : 'Unknown'}
                left={(props) => <List.Icon {...props} icon="book-open" />}
              />
              
              <List.Item
                title="Chunks"
                description={`${document.chunkCount} text chunks`}
                left={(props) => <List.Icon {...props} icon="text-box-multiple" />}
              />
              
              <List.Item
                title="Created"
                description={document.createdAt.toLocaleString()}
                left={(props) => <List.Icon {...props} icon="calendar-plus" />}
              />
              
              <List.Item
                title="Last Modified"
                description={document.updatedAt.toLocaleString()}
                left={(props) => <List.Icon {...props} icon="calendar-edit" />}
              />
            </Card.Content>
          </Card>

          {/* Processing Information */}
          {document.isProcessed && chunks.length > 0 && (
            <Card style={styles.section}>
              <Card.Content>
                <Text style={styles.sectionTitle}>Processing Details</Text>
                
                <View style={styles.processingStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{chunks.length}</Text>
                    <Text style={styles.statLabel}>Total Chunks</Text>
                  </View>
                  
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {chunks.filter(c => c.hasEmbedding).length}
                    </Text>
                    <Text style={styles.statLabel}>With Embeddings</Text>
                  </View>
                  
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {Math.round(chunks.reduce((sum, c) => sum + c.tokenCount, 0) / chunks.length)}
                    </Text>
                    <Text style={styles.statLabel}>Avg Tokens</Text>
                  </View>
                </View>

                {/* Sample chunks preview */}
                <Text style={styles.subsectionTitle}>Sample Chunks</Text>
                {chunks.slice(0, 3).map((chunk, index) => (
                  <View key={chunk.id} style={styles.chunkPreview}>
                    <View style={styles.chunkHeader}>
                      <Text style={styles.chunkTitle}>
                        Chunk {chunk.chunkIndex + 1} (Page {chunk.pageNumber})
                      </Text>
                      <Text style={styles.chunkTokens}>
                        {chunk.tokenCount} tokens
                      </Text>
                    </View>
                    <Text style={styles.chunkText} numberOfLines={3}>
                      {chunk.excerpt}
                    </Text>
                  </View>
                ))}
                
                {chunks.length > 3 && (
                  <Text style={styles.moreChunks}>
                    ... and {chunks.length - 3} more chunks
                  </Text>
                )}
              </Card.Content>
            </Card>
          )}
        </ScrollView>

        <Divider />
        
        <View style={styles.actions}>
          {document.isProcessed && (
            <Button
              mode="outlined"
              onPress={handleReprocess}
              style={styles.actionButton}>
              Reprocess
            </Button>
          )}
          
          <Button
            mode="outlined"
            textColor={theme.colors.error}
            onPress={handleDelete}
            style={styles.actionButton}>
            Delete
          </Button>
        </View>
      </Modal>
    </Portal>
  );
};