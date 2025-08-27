import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = ({theme}: {theme: Theme}) =>
  StyleSheet.create({
    container: {
      marginHorizontal: 8,
      marginVertical: 4,
    },
    card: {
      borderRadius: 20,
      overflow: 'hidden',
      elevation: 1,
      shadowColor: theme.colors.shadow,
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    iconContainer: {
      marginRight: 8,
    },
    icon: {
      margin: 0,
    },
    textContainer: {
      flex: 1,
    },
    modeText: {
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 18,
    },
    documentCountContainer: {
      marginTop: 2,
    },
    documentCount: {
      fontSize: 12,
      lineHeight: 16,
      opacity: 0.8,
    },
    statusIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginLeft: 8,
    },
    border: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 2,
    },
  });