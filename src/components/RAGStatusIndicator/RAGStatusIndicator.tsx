import React, {useEffect, useRef} from 'react';
import {View, TouchableOpacity, Animated} from 'react-native';
import {Text, Chip} from 'react-native-paper';
import {observer} from 'mobx-react';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';
import {RAGTransition} from '../RAGTransition/RAGTransition';

export interface RAGStatusIndicatorProps {
  ragEnabled: boolean;
  documentCount: number;
  onPress?: () => void;
  showTransition?: boolean;
  isProcessing?: boolean;
}

export const RAGStatusIndicator: React.FC<RAGStatusIndicatorProps> = observer(
  ({ragEnabled, documentCount, onPress, showTransition = true, isProcessing = false}) => {
    const theme = useTheme();
    const styles = createStyles({theme});
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      if (isProcessing) {
        const pulse = Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.8,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]);
        Animated.loop(pulse).start();
      } else {
        pulseAnim.setValue(1);
      }
    }, [isProcessing, pulseAnim]);

    if (showTransition) {
      return (
        <RAGTransition
          isRAGEnabled={ragEnabled}
          documentCount={documentCount}
          showAnimation={true}
        />
      );
    }

    if (!ragEnabled || documentCount === 0) {
      return null;
    }

    return (
      <TouchableOpacity style={styles.container} onPress={onPress}>
        <Animated.View style={{transform: [{scale: pulseAnim}]}}>
          <Chip
            icon={isProcessing ? 'loading' : 'book-open-variant'}
            compact
            style={[
              styles.chip,
              isProcessing && styles.chipProcessing,
            ]}
            textStyle={styles.chipText}>
            RAG ({documentCount})
          </Chip>
        </Animated.View>
      </TouchableOpacity>
    );
  }
);