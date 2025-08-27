import {StyleSheet, Dimensions} from 'react-native';
import {Theme} from '../../utils/types';

interface StyleProps {
  theme: Theme;
}

const screenData = Dimensions.get('window');

export const createStyles = ({theme}: StyleProps) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
      backgroundColor: theme.colors.surface,
    },
    headerInfo: {
      flex: 1,
    },
    documentTitle: {
      color: theme.colors.onSurface,
      fontWeight: '600',
      marginBottom: 4,
    },
    pageInfo: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    pageChip: {
      backgroundColor: theme.colors.primaryContainer,
      height: 24,
    },
    highlightChip: {
      backgroundColor: theme.colors.secondaryContainer,
      height: 24,
    },
    closeButton: {
      margin: 0,
    },
    content: {
      flex: 1,
      backgroundColor: theme.colors.surfaceVariant,
    },
    loadingContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      zIndex: 1,
    },
    loadingText: {
      marginTop: 16,
      color: theme.colors.onSurface,
    },
    errorText: {
      color: theme.colors.error,
    },
    pdf: {
      flex: 1,
      width: screenData.width,
      backgroundColor: 'transparent',
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outline,
    },
    controlButton: {
      backgroundColor: theme.colors.primaryContainer,
      margin: 0,
    },
    disabledButton: {
      backgroundColor: theme.colors.surfaceVariant,
      opacity: 0.5,
    },
    pageControls: {
      flex: 1,
      alignItems: 'center',
    },
    pageText: {
      color: theme.colors.onSurface,
      fontWeight: '500',
    },
  });