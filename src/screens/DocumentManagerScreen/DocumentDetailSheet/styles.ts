import {StyleSheet, Dimensions} from 'react-native';
import {Theme} from '../../../utils/types';

const {height} = Dimensions.get('window');

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      margin: 20,
      borderRadius: 16,
      maxHeight: height * 0.8,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.onSurface,
      flex: 1,
      marginRight: 12,
    },
    closeButton: {
      margin: 0,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    section: {
      marginBottom: 16,
      elevation: 0,
      backgroundColor: theme.colors.surfaceVariant,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.onSurface,
      marginBottom: 12,
    },
    subsectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.onSurface,
      marginTop: 16,
      marginBottom: 8,
    },
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusLabel: {
      fontSize: 14,
      color: theme.colors.onSurface,
      marginRight: 8,
    },
    statusInfo: {
      marginTop: 8,
    },
    statusText: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginBottom: 4,
    },
    processedDate: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
    },
    processingStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginVertical: 16,
      paddingVertical: 16,
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.primary,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    chunkPreview: {
      backgroundColor: theme.colors.surface,
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
    },
    chunkHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    chunkTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.onSurface,
    },
    chunkTokens: {
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
    },
    chunkText: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      lineHeight: 16,
    },
    moreChunks: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      fontStyle: 'italic',
      textAlign: 'center',
      marginTop: 8,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      padding: 20,
      paddingTop: 16,
      gap: 12,
    },
    actionButton: {
      minWidth: 100,
    },
  });