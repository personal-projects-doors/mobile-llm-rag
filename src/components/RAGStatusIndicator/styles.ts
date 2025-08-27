import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

interface StyleProps {
  theme: Theme;
}

export const createStyles = ({theme}: StyleProps) =>
  StyleSheet.create({
    container: {
      marginRight: 8,
    },
    chip: {
      backgroundColor: theme.colors.primaryContainer,
      height: 28,
    },
    chipText: {
      color: theme.colors.onPrimaryContainer,
      fontSize: 12,
      fontWeight: '500',
    },
  });