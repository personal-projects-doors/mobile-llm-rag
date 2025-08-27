import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

interface StyleProps {
  theme: Theme;
}

export const createStyles = ({theme}: StyleProps) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: '80%',
    },
    header: {
      padding: 24,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    title: {
      color: theme.colors.onSurface,
      marginBottom: 8,
    },
    subtitle: {
      color: theme.colors.onSurfaceVariant,
    },
    content: {
      flex: 1,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 24,
      paddingTop: 16,
      paddingBottom: 16,
    },
    settingInfo: {
      flex: 1,
      marginRight: 16,
    },
    settingTitle: {
      color: theme.colors.onSurface,
      marginBottom: 4,
    },
    settingDescription: {
      color: theme.colors.onSurfaceVariant,
    },
    warningContainer: {
      margin: 16,
      padding: 12,
      backgroundColor: theme.colors.errorContainer,
      borderRadius: 8,
    },
    warningText: {
      color: theme.colors.onErrorContainer,
      textAlign: 'center',
    },
    documentSection: {
      flex: 1,
      marginTop: 8,
    },
    footer: {
      padding: 24,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outline,
    },
    doneButton: {
      width: '100%',
    },
  });