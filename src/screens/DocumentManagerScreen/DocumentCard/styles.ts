import {StyleSheet} from 'react-native';
import {Theme} from '../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 12,
    },
    cardContent: {
      padding: 16,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    titleContainer: {
      flex: 1,
      marginRight: 12,
    },
    documentName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.onSurface,
      marginBottom: 4,
    },
    metadataRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    fileSize: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
    },
    separator: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      marginHorizontal: 6,
    },
    pageCount: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
    },
    chunkCount: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionButton: {
      margin: 0,
    },
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    statusChip: {
      height: 28,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '500',
    },
    processedDate: {
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
    },
    progressContainer: {
      marginTop: 8,
    },
    progressBar: {
      height: 4,
      borderRadius: 2,
      marginBottom: 4,
    },
    progressText: {
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'right',
    },
    errorContainer: {
      marginTop: 8,
      padding: 8,
      backgroundColor: theme.colors.errorContainer,
      borderRadius: 6,
    },
    errorText: {
      fontSize: 12,
      color: theme.colors.onErrorContainer,
    },
  });