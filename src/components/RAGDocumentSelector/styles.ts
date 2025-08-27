import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

interface StyleProps {
  theme: Theme;
}

export const createStyles = ({theme}: StyleProps) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    emptyText: {
      color: theme.colors.onSurface,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptySubtext: {
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    header: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    title: {
      color: theme.colors.onSurface,
      marginBottom: 4,
    },
    subtitle: {
      color: theme.colors.onSurfaceVariant,
    },
    documentList: {
      flex: 1,
    },
    documentItem: {
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    documentItemSelected: {
      backgroundColor: theme.colors.primaryContainer,
    },
    documentItemDisabled: {
      opacity: 0.5,
    },
    documentContent: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    documentInfo: {
      flex: 1,
      marginLeft: 12,
    },
    documentName: {
      color: theme.colors.onSurface,
      marginBottom: 4,
    },
    documentNameDisabled: {
      color: theme.colors.onSurfaceVariant,
    },
    documentMeta: {
      color: theme.colors.onSurfaceVariant,
    },
  });