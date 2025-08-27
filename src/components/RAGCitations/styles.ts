import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

interface StyleProps {
  theme: Theme;
}

export const createStyles = ({theme}: StyleProps) =>
  StyleSheet.create({
    container: {
      marginTop: 8,
    },
    header: {
      marginBottom: 8,
      marginLeft: 4,
    },
    title: {
      color: theme.colors.onSurfaceVariant,
      marginBottom: 2,
    },
    stats: {
      color: theme.colors.onSurfaceVariant,
      opacity: 0.7,
    },
    citationsScroll: {
      flexGrow: 0,
    },
    citationsContent: {
      paddingHorizontal: 4,
    },
    citationCard: {
      backgroundColor: theme.colors.surfaceVariant,
      marginRight: 8,
      minWidth: 200,
      maxWidth: 280,
      borderRadius: 8,
    },
    citationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
    },
    citationInfo: {
      flex: 1,
    },
    expandIcon: {
      margin: 0,
    },
    documentName: {
      color: theme.colors.onSurfaceVariant,
      fontWeight: '500',
      marginBottom: 6,
    },
    citationMeta: {
      flexDirection: 'row',
      gap: 4,
    },
    pageChip: {
      backgroundColor: theme.colors.primaryContainer,
      height: 24,
    },
    similarityChip: {
      backgroundColor: theme.colors.secondaryContainer,
      height: 24,
    },
    citationContent: {
      paddingHorizontal: 12,
      paddingBottom: 12,
    },
    divider: {
      marginBottom: 8,
      backgroundColor: theme.colors.outline,
    },
    citationText: {
      color: theme.colors.onSurfaceVariant,
      lineHeight: 18,
      marginBottom: 12,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: theme.colors.surface,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.colors.outline,
    },
    primaryButton: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    actionButtonText: {
      color: theme.colors.onSurface,
      fontWeight: '500',
    },
    primaryButtonText: {
      color: theme.colors.onPrimary,
      fontWeight: '500',
    },
    showMoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      paddingVertical: 8,
      backgroundColor: theme.colors.surface,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.colors.outline,
    },
    showMoreText: {
      color: theme.colors.onSurface,
      fontWeight: '500',
    },
  });