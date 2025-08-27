import React, {useState, useContext, useEffect, useCallback} from 'react';
import {
  FlatList,
  RefreshControl,
  Platform,
  Alert,
  KeyboardAvoidingView,
  View,
} from 'react-native';

import {observer} from 'mobx-react-lite';
import DocumentPicker from 'react-native-document-picker';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {
  FAB,
  Text,
  Searchbar,
  Chip,
  Portal,
  Snackbar,
} from 'react-native-paper';

import {useTheme} from '../../hooks';
import {DocumentCard} from './DocumentCard';
import {DocumentDetailSheet} from './DocumentDetailSheet';
import {createStyles} from './styles';

import {database} from '../../database';
import {RAGDocument} from '../../database/models';

import {L10nContext} from '../../utils';

interface ProcessingStatus {
  documentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

export const DocumentManagerScreen: React.FC = observer(() => {
  const l10n = useContext(L10nContext);
  const theme = useTheme();
  const styles = createStyles(theme);

  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDocument, setSelectedDocument] = useState<RAGDocument | null>(null);
  const [detailSheetVisible, setDetailSheetVisible] = useState(false);
  const [processingStatuses, setProcessingStatuses] = useState<Map<string, ProcessingStatus>>(new Map());
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [filterEnabled, setFilterEnabled] = useState<boolean | null>(null); // null = all, true = enabled, false = disabled

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const documentsCollection = database.get<RAGDocument>('rag_documents');
      const allDocuments = await documentsCollection.query().fetch();
      setDocuments(allDocuments);
    } catch (error) {
      console.error('Failed to load documents:', error);
      showSnackbar('Failed to load documents');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDocuments();
    setRefreshing(false);
  };

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const handleAddDocument = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: Platform.OS === 'ios' ? 'com.adobe.pdf' : DocumentPicker.types.pdf,
        allowMultiSelection: false,
      });

      const file = result[0];
      if (!file) return;

      // Check if document already exists
      const existingDoc = documents.find(doc => doc.name === file.name);
      if (existingDoc) {
        Alert.alert(
          'Document Already Exists',
          `A document named "${file.name}" already exists. Would you like to replace it?`,
          [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Replace',
              style: 'destructive',
              onPress: () => replaceDocument(existingDoc, file),
            },
          ]
        );
        return;
      }

      await importDocument(file);
    } catch (error) {
      if (DocumentPicker.isCancel(error)) {
        // User cancelled the picker
        return;
      }
      console.error('Failed to pick document:', error);
      showSnackbar('Failed to select document');
    }
  };

  const importDocument = async (file: any) => {
    try {
      // Create documents directory if it doesn't exist
      const documentsDir = `${RNFS.DocumentDirectoryPath}/rag_documents`;
      if (!(await RNFS.exists(documentsDir))) {
        await RNFS.mkdir(documentsDir);
      }

      // Copy file to permanent location
      const fileName = file.name || `document_${Date.now()}.pdf`;
      const permanentPath = `${documentsDir}/${fileName}`;
      await RNFS.copyFile(file.uri, permanentPath);

      // Get file stats
      const stats = await RNFS.stat(permanentPath);

      // Create database entry
      await database.write(async () => {
        const documentsCollection = database.get<RAGDocument>('rag_documents');
        await documentsCollection.create((document) => {
          document.name = fileName;
          document.filePath = permanentPath;
          document.size = stats.size;
          document.pageCount = 0; // Will be updated during processing
          document.isProcessed = false;
          document.chunkCount = 0;
          document.isEnabled = true;
        });
      });

      await loadDocuments();
      showSnackbar(`Document "${fileName}" imported successfully`);

      // TODO: Start processing the document (will be implemented in later tasks)
      
    } catch (error) {
      console.error('Failed to import document:', error);
      showSnackbar('Failed to import document');
    }
  };

  const replaceDocument = async (existingDoc: RAGDocument, file: any) => {
    try {
      // Delete old file
      if (await RNFS.exists(existingDoc.filePath)) {
        await RNFS.unlink(existingDoc.filePath);
      }

      // Copy new file
      await RNFS.copyFile(file.uri, existingDoc.filePath);
      const stats = await RNFS.stat(existingDoc.filePath);

      // Update database entry
      await database.write(async () => {
        await existingDoc.update((document) => {
          document.size = stats.size;
          document.pageCount = 0;
          document.isProcessed = false;
          document.chunkCount = 0;
          document.isEnabled = true;
        });
      });

      await loadDocuments();
      showSnackbar(`Document "${existingDoc.name}" replaced successfully`);
      
    } catch (error) {
      console.error('Failed to replace document:', error);
      showSnackbar('Failed to replace document');
    }
  };

  const handleDeleteDocument = async (document: RAGDocument) => {
    Alert.alert(
      'Delete Document',
      `Are you sure you want to delete "${document.name}"? This action cannot be undone.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete file from filesystem
              if (await RNFS.exists(document.filePath)) {
                await RNFS.unlink(document.filePath);
              }

              // Delete from database (this will cascade delete chunks)
              await database.write(async () => {
                await document.destroyPermanently();
              });

              await loadDocuments();
              showSnackbar(`Document "${document.name}" deleted successfully`);
            } catch (error) {
              console.error('Failed to delete document:', error);
              showSnackbar('Failed to delete document');
            }
          },
        },
      ]
    );
  };

  const handleToggleEnabled = async (document: RAGDocument) => {
    try {
      await database.write(async () => {
        await document.update((doc) => {
          doc.isEnabled = !doc.isEnabled;
        });
      });
      await loadDocuments();
    } catch (error) {
      console.error('Failed to toggle document status:', error);
      showSnackbar('Failed to update document status');
    }
  };

  const handleDocumentPress = (document: RAGDocument) => {
    setSelectedDocument(document);
    setDetailSheetVisible(true);
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterEnabled === null || doc.isEnabled === filterEnabled;
    return matchesSearch && matchesFilter;
  });

  const renderDocument = ({item}: {item: RAGDocument}) => (
    <DocumentCard
      document={item}
      processingStatus={processingStatuses.get(item.id)}
      onPress={() => handleDocumentPress(item)}
      onDelete={() => handleDeleteDocument(item)}
      onToggleEnabled={() => handleToggleEnabled(item)}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No Documents</Text>
      <Text style={styles.emptySubtitle}>
        Add PDF documents to enable RAG functionality
      </Text>
    </View>
  );

  const renderFilterChips = () => (
    <View style={styles.filterContainer}>
      <Chip
        selected={filterEnabled === null}
        onPress={() => setFilterEnabled(null)}
        style={styles.filterChip}>
        All ({documents.length})
      </Chip>
      <Chip
        selected={filterEnabled === true}
        onPress={() => setFilterEnabled(true)}
        style={styles.filterChip}>
        Enabled ({documents.filter(d => d.isEnabled).length})
      </Chip>
      <Chip
        selected={filterEnabled === false}
        onPress={() => setFilterEnabled(false)}
        style={styles.filterChip}>
        Disabled ({documents.filter(d => !d.isEnabled).length})
      </Chip>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      
      <Searchbar
        placeholder="Search documents..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      {renderFilterChips()}

      <FlatList
        data={filteredDocuments}
        keyExtractor={(item) => item.id}
        renderItem={renderDocument}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
      />

      <Portal>
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={handleAddDocument}
          label="Add Document"
        />
      </Portal>

      <DocumentDetailSheet
        visible={detailSheetVisible}
        document={selectedDocument}
        onDismiss={() => {
          setDetailSheetVisible(false);
          setSelectedDocument(null);
        }}
        onDelete={handleDeleteDocument}
        onToggleEnabled={handleToggleEnabled}
      />

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={Snackbar.DURATION_SHORT}>
        {snackbarMessage}
      </Snackbar>
    </KeyboardAvoidingView>
  );
});