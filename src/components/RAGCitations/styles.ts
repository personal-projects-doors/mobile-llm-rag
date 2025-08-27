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
    title: {
      color: theme.colors.onSurfaceVariant,
      marginBottom: 8,
      marginLeft: 4,
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
      maxWidth: 250,
    },
    citationHeader: {
      padding: 12,
    },
    citationInfo: {
      flex: 1,
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
      borderTopWidth: 1,
      borderTopColor: theme.colors.outline,
    },
    citationText: {
      color: theme.colors.onSurfaceVariant,
      lineHeight: 16,
      marginBottom: 8,
    },
    viewDocumentButton: {
      alignSelf: 'flex-start',
      paddingVertical: 4,
      paddingHorizontal: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: 4,
    },
    viewDocumentText: {
      color: theme.colors.onPrimary,
      fontWeight: '500',
    },
  });