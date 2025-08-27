import React, {useState, useEffect} from 'react';
import {View, ScrollView, Dimensions} from 'react-native';
import {Text, Card, IconButton, ActivityIndicator, Chip} from 'react-native-paper';
import {observer} from 'mobx-react';
import Pdf from 'react-native-pdf';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';

export interface DocumentViewerProps {
  documentId: string;
  documentName: string;
  filePath: string;
  initialPage?: number;
  onClose?: () => void;
  highlightText?: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = observer(
  ({documentId, documentName, filePath, initialPage = 1, onClose, highlightText}) => {
    const theme = useTheme();
    const styles = createStyles({theme});
    const [currentPage, setCurrentPage] = useState(initialPage);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const screenData = Dimensions.get('window');
    const pdfWidth = screenData.width - 32; // Account for margins

    const handleLoadComplete = (numberOfPages: number) => {
      setTotalPages(numberOfPages);
      setLoading(false);
      setError(null);
    };

    const handlePageChanged = (page: number) => {
      setCurrentPage(page);
    };

    const handleError = (error: any) => {
      console.error('PDF loading error:', error);
      setError('Failed to load document');
      setLoading(false);
    };

    const goToPage = (page: number) => {
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
      }
    };

    const goToPreviousPage = () => {
      goToPage(currentPage - 1);
    };

    const goToNextPage = () => {
      goToPage(currentPage + 1);
    };

    if (error) {
      return (
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <Text variant="titleMedium" style={styles.documentTitle}>
                {documentName}
              </Text>
              <Text variant="bodySmall" style={styles.errorText}>
                {error}
              </Text>
            </View>
            {onClose && (
              <IconButton
                icon="close"
                size={24}
                onPress={onClose}
                style={styles.closeButton}
              />
            )}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text variant="titleMedium" style={styles.documentTitle} numberOfLines={1}>
              {documentName}
            </Text>
            {totalPages > 0 && (
              <View style={styles.pageInfo}>
                <Chip compact style={styles.pageChip}>
                  Page {currentPage} of {totalPages}
                </Chip>
                {highlightText && (
                  <Chip compact style={styles.highlightChip}>
                    Highlighting: "{highlightText.substring(0, 20)}..."
                  </Chip>
                )}
              </View>
            )}
          </View>
          {onClose && (
            <IconButton
              icon="close"
              size={24}
              onPress={onClose}
              style={styles.closeButton}
            />
          )}
        </View>

        <View style={styles.content}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" />
              <Text variant="bodyMedium" style={styles.loadingText}>
                Loading document...
              </Text>
            </View>
          )}

          <Pdf
            source={{uri: filePath, cache: true}}
            onLoadComplete={handleLoadComplete}
            onPageChanged={handlePageChanged}
            onError={handleError}
            style={styles.pdf}
            page={currentPage}
            horizontal={false}
            fitWidth={true}
            spacing={10}
            password=""
            scale={1.0}
            minScale={0.5}
            maxScale={3.0}
            renderActivityIndicator={() => (
              <ActivityIndicator size="large" color={theme.colors.primary} />
            )}
          />
        </View>

        {totalPages > 0 && (
          <View style={styles.controls}>
            <IconButton
              icon="chevron-left"
              size={24}
              disabled={currentPage <= 1}
              onPress={goToPreviousPage}
              style={[
                styles.controlButton,
                currentPage <= 1 && styles.disabledButton
              ]}
            />
            
            <View style={styles.pageControls}>
              <Text variant="bodyMedium" style={styles.pageText}>
                {currentPage} / {totalPages}
              </Text>
            </View>

            <IconButton
              icon="chevron-right"
              size={24}
              disabled={currentPage >= totalPages}
              onPress={goToNextPage}
              style={[
                styles.controlButton,
                currentPage >= totalPages && styles.disabledButton
              ]}
            />
          </View>
        )}
      </View>
    );
  }
);