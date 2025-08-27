import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = ({theme, compact}: {theme: Theme; compact: boolean}) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      margin: 8,
      elevation: 2,
      shadowColor: theme.colors.shadow,
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    compactContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceContainer,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 8,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    iconContainer: {
      marginRight: 12,
    },
    compactIcon: {
      margin: 0,
    },
    textContainer: {
      flex: 1,
    },
    stageText: {
      color: theme.colors.onSurface,
      marginBottom: 2,
    },
    compactText: {
      color: theme.colors.onSurface,
      flex: 1,
    },
    documentText: {
      color: theme.colors.onSurfaceVariant,
    },
    compactProgress: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 12,
    },
    cancelButton: {
      margin: 0,
    },
    progressContainer: {
      marginBottom: 16,
    },
    progressBar: {
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.surfaceVariant,
    },
    progressTextContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    progressText: {
      color: theme.colors.onSurfaceVariant,
    },
    progressDetail: {
      color: theme.colors.onSurfaceVariant,
    },
    stageIndicators: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stageIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stageDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.surfaceVariant,
    },
    stageDotActive: {
      backgroundColor: theme.colors.primary,
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    stageDotCompleted: {
      backgroundColor: theme.colors.primary,
    },
    stageConnector: {
      width: 16,
      height: 2,
      backgroundColor: theme.colors.surfaceVariant,
      marginHorizontal: 4,
    },
    stageConnectorCompleted: {
      backgroundColor: theme.colors.primary,
    },
  });