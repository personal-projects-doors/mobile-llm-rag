import React from 'react';
import {View} from 'react-native';

import {
  Card,
  Text,
  IconButton,
  ProgressBar,
  Chip,
  TouchableRipple,
} from 'react-native-paper';

import {useTheme} from '../../../hooks';
import {createStyles} from './styles';
import {RAGDocument} from '../../../database/models';

interface ProcessingStatus {
  documentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

interface DocumentCardProps {
  document: RAGDocument;
  processingStatus?: ProcessingStatus;
  onPress: () => void;
  onDelete: () => void;
  onToggleEnabled: () => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  processingStatus,
  onPress,
  onDelete,
  onToggleEnabled,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  const getStatusColor = () => {
    if (!document.isEnabled) return theme.colors.outline;
    if (processingStatus?.status === 'processing') return theme.colors.primary;
    if (processingStatus?.status === 'failed') return theme.colors.error;
    if (document.isProcessed) return theme.colors.primary;
    return theme.colors.outline;
  };

  const getStatusText = () => {
    if (!document.isEnabled) return 'Disabled';
    if (processingStatus?.status === 'processing') return 'Processing...';
    if (processingStatus?.status === 'failed') return 'Failed';
    if (document.isProcessed) return 'Ready';
    return 'Not Processed';
  };

  const renderProcessingProgress = () => {
    if (processingStatus?.status === 'processing') {
      return (
        <View style={styles.progressContainer}>
          <ProgressBar
            progress={processingStatus.progress / 100}
            color={theme.colors.primary}
            style={styles.progressBar}
          />
          <Text style={styles.progressText}>
            {Math.round(processingStatus.progress)}%
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <Card
      elevation={1}
      style={[
        styles.card,
        {backgroundColor: theme.colors.surface},
        !document.isEnabled && {opacity: 0.6},
      ]}>
      <TouchableRipple onPress={onPress} style={styles.cardContent}>
        <View>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Text style={styles.documentName} numberOfLines={2}>
                {document.name}
              </Text>
              <View style={styles.metadataRow}>
                <Text style={styles.fileSize}>{document.formattedSize}</Text>
                {document.pageCount > 0 && (
                  <>
                    <Text style={styles.separator}>•</Text>
                    <Text style={styles.pageCount}>
                      {document.pageCount} pages
                    </Text>
                  </>
                )}
                {document.chunkCount > 0 && (
                  <>
                    <Text style={styles.separator}>•</Text>
                    <Text style={styles.chunkCount}>
                      {document.chunkCount} chunks
                    </Text>
                  </>
                )}
              </View>
            </View>
            
            <View style={styles.actions}>
              <IconButton
                icon={document.isEnabled ? 'eye' : 'eye-off'}
                size={20}
                iconColor={document.isEnabled ? theme.colors.primary : theme.colors.outline}
                onPress={onToggleEnabled}
                style={styles.actionButton}
              />
              <IconButton
                icon="delete"
                size={20}
                iconColor={theme.colors.error}
                onPress={onDelete}
                style={styles.actionButton}
              />
            </View>
          </View>

          <View style={styles.statusRow}>
            <Chip
              mode="outlined"
              textStyle={[styles.statusText, {color: getStatusColor()}]}
              style={[styles.statusChip, {borderColor: getStatusColor()}]}>
              {getStatusText()}
            </Chip>
            
            {document.processedDate && (
              <Text style={styles.processedDate}>
                Processed {document.processedDate.toLocaleDateString()}
              </Text>
            )}
          </View>

          {renderProcessingProgress()}

          {processingStatus?.error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{processingStatus.error}</Text>
            </View>
          )}
        </View>
      </TouchableRipple>
    </Card>
  );
};