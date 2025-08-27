import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

interface StyleProps {
  theme: Theme;
}

export const createStyles = ({theme}: StyleProps) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      margin: 16,
      maxHeight: '80%',
    },
    loadingContainer: {
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: 8,
      color: theme.colors.onSurface,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    headerInfo: {
      flex: 1,
    },
    documentName: {
      color: theme.colors.onSurface,
      fontWeight: '600',
      marginBottom: 8,
    },
    metadata: {
      flexDirection: 'row',
      gap: 8,
    },
    pageChip: {
      backgroundColor: theme.colors.primaryContainer,
      height: 28,
    },
    similarityChip: {
      backgroundColor: theme.colors.secondaryContainer,
      height: 28,
    },
    closeButton: {
      margin: 0,
    },
    contentScroll: {
      maxHeight: 400,
    },
    excerptContainer: {
      padding: 16,
    },
    contextContainer: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    detailsContainer: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    sectionLabel: {
      color: theme.colors.primary,
      fontWeight: '600',
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    excerptBox: {
      backgroundColor: theme.colors.primaryContainer,
      borderRadius: 8,
      padding: 12,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
    },
    excerptText: {
      color: theme.colors.onPrimaryContainer,
      lineHeight: 20,
    },
    contextBox: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 8,
      padding: 12,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.secondary,
    },
    contextText: {
      color: theme.colors.onSurfaceVariant,
      lineHeight: 20,
    },
    detailsGrid: {
      gap: 12,
    },
    detailItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    detailLabel: {
      color: theme.colors.onSurfaceVariant,
      fontWeight: '500',
    },
    detailValue: {
      color: theme.colors.onSurface,
      fontFamily: 'monospace',
    },
    actions: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outline,
    },
    actionButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    actionButtonText: {
      color: theme.colors.onPrimary,
      fontWeight: '600',
    },
  });