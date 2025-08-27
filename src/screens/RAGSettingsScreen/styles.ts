import {StyleSheet} from 'react-native';
import {Theme} from 'react-native-paper';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      padding: 16,
      paddingBottom: 32,
    },
    card: {
      marginBottom: 16,
      backgroundColor: theme.colors.surface,
    },
    settingItemContainer: {
      paddingVertical: 12,
    },
    textLabel: {
      marginBottom: 8,
      color: theme.colors.onSurface,
      fontWeight: '500',
    },
    textInput: {
      marginBottom: 8,
    },
    invalidInput: {
      borderColor: theme.colors.error,
      borderWidth: 1,
    },
    errorText: {
      color: theme.colors.error,
      fontSize: 12,
      marginBottom: 4,
    },
    textDescription: {
      color: theme.colors.onSurfaceVariant,
      lineHeight: 18,
    },
    switchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    textContainer: {
      flex: 1,
      marginRight: 16,
    },
    slider: {
      marginVertical: 8,
      height: 40,
    },
    performanceContainer: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    performanceChipContainer: {
      marginBottom: 8,
    },
    performanceChip: {
      fontWeight: 'bold',
      fontSize: 12,
    },
    performanceDescription: {
      textAlign: 'center',
      color: theme.colors.onSurfaceVariant,
    },
    accordionTitle: {
      color: theme.colors.onSurface,
      fontSize: 16,
      fontWeight: '500',
    },
    advancedAccordion: {
      backgroundColor: 'transparent',
      paddingHorizontal: 0,
    },
    advancedSettingsContent: {
      paddingTop: 8,
    },
    resetButton: {
      marginTop: 8,
    },
    errorCard: {
      backgroundColor: theme.colors.errorContainer,
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    errorMessage: {
      flex: 1,
      color: theme.colors.onErrorContainer,
    },
  });