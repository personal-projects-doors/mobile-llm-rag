import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = ({theme}: {theme: Theme}) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingHorizontal: 24,
      paddingVertical: 16,
      alignItems: 'center',
    },
    title: {
      color: theme.colors.onBackground,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      lineHeight: 24,
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
    },
    progressContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginVertical: 24,
      gap: 8,
    },
    progressDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.surfaceVariant,
    },
    progressDotActive: {
      backgroundColor: theme.colors.primary,
      width: 24,
    },
    progressDotCompleted: {
      backgroundColor: theme.colors.primary,
    },
    stepCard: {
      backgroundColor: theme.colors.surface,
      marginBottom: 24,
      padding: 20,
      borderRadius: 16,
      elevation: 2,
    },
    stepHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    stepIcon: {
      margin: 0,
      marginRight: 12,
    },
    stepTitleContainer: {
      flex: 1,
    },
    stepTitle: {
      color: theme.colors.onSurface,
      marginBottom: 4,
    },
    stepDescription: {
      color: theme.colors.onSurfaceVariant,
      lineHeight: 20,
    },
    stepDetails: {
      gap: 12,
    },
    detailItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    detailIcon: {
      margin: 0,
      marginRight: 8,
    },
    detailText: {
      flex: 1,
      color: theme.colors.onSurface,
      lineHeight: 20,
    },
    overviewSection: {
      marginBottom: 24,
    },
    overviewTitle: {
      color: theme.colors.onBackground,
      marginBottom: 16,
    },
    overviewStep: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      marginBottom: 8,
      overflow: 'hidden',
    },
    overviewStepActive: {
      backgroundColor: theme.colors.primaryContainer,
    },
    overviewStepHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    overviewStepIcon: {
      margin: 0,
      marginRight: 12,
    },
    overviewStepContent: {
      flex: 1,
    },
    overviewStepTitle: {
      color: theme.colors.onSurface,
      marginBottom: 2,
    },
    overviewStepTitleActive: {
      color: theme.colors.primary,
    },
    overviewStepDesc: {
      color: theme.colors.onSurfaceVariant,
      lineHeight: 16,
    },
    expandedDetails: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    expandedDivider: {
      marginBottom: 12,
    },
    expandedDetail: {
      color: theme.colors.onSurfaceVariant,
      marginBottom: 4,
      lineHeight: 16,
    },
    privacyCard: {
      backgroundColor: theme.colors.surfaceContainer,
      padding: 20,
      borderRadius: 16,
      marginBottom: 24,
    },
    privacyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    privacyTitle: {
      color: theme.colors.onSurface,
      marginLeft: 8,
    },
    privacyText: {
      color: theme.colors.onSurfaceVariant,
      lineHeight: 20,
    },
    footer: {
      paddingHorizontal: 24,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outline,
    },
    navigationButtons: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    navButton: {
      flex: 1,
    },
    skipButton: {
      alignSelf: 'center',
    },
  });