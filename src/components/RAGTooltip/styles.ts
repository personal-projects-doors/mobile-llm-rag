import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = ({
  theme,
  arrowDirection,
}: {
  theme: Theme;
  arrowDirection: 'up' | 'down' | 'left' | 'right';
}) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    tooltipCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      elevation: 4,
      shadowColor: theme.colors.shadow,
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.2,
      shadowRadius: 4,
      maxWidth: 280,
      minWidth: 200,
    },
    tooltipContent: {
      padding: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    title: {
      color: theme.colors.onSurface,
      flex: 1,
    },
    closeButton: {
      margin: 0,
      marginLeft: 8,
    },
    content: {
      color: theme.colors.onSurfaceVariant,
      lineHeight: 18,
    },
    arrow: {
      position: 'absolute',
      width: 0,
      height: 0,
      backgroundColor: 'transparent',
      borderStyle: 'solid',
    },
    arrowUp: {
      top: -8,
      left: '50%',
      marginLeft: -8,
      borderLeftWidth: 8,
      borderRightWidth: 8,
      borderBottomWidth: 8,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: theme.colors.surface,
    },
    arrowDown: {
      bottom: -8,
      left: '50%',
      marginLeft: -8,
      borderLeftWidth: 8,
      borderRightWidth: 8,
      borderTopWidth: 8,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: theme.colors.surface,
    },
    arrowLeft: {
      top: '50%',
      left: -8,
      marginTop: -8,
      borderTopWidth: 8,
      borderBottomWidth: 8,
      borderRightWidth: 8,
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      borderRightColor: theme.colors.surface,
    },
    arrowRight: {
      top: '50%',
      right: -8,
      marginTop: -8,
      borderTopWidth: 8,
      borderBottomWidth: 8,
      borderLeftWidth: 8,
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      borderLeftColor: theme.colors.surface,
    },
  });