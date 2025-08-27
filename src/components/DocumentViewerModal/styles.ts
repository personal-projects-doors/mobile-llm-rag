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
  });