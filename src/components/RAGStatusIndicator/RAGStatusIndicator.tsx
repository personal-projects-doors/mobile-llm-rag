import React from 'react';
import {View, TouchableOpacity} from 'react-native';
import {Text, Chip} from 'react-native-paper';
import {observer} from 'mobx-react';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';

export interface RAGStatusIndicatorProps {
  ragEnabled: boolean;
  documentCount: number;
  onPress?: () => void;
}

export const RAGStatusIndicator: React.FC<RAGStatusIndicatorProps> = observer(
  ({ragEnabled, documentCount, onPress}) => {
    const theme = useTheme();
    const styles = createStyles({theme});

    if (!ragEnabled || documentCount === 0) {
      return null;
    }

    return (
      <TouchableOpacity style={styles.container} onPress={onPress}>
        <Chip
          icon="book-open-variant"
          compact
          style={styles.chip}
          textStyle={styles.chipText}>
          RAG ({documentCount})
        </Chip>
      </TouchableOpacity>
    );
  }
);