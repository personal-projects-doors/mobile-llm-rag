import React, {useEffect, useRef} from 'react';
import {View, Animated} from 'react-native';
import {Text, ProgressBar, IconButton} from 'react-native-paper';
import {observer} from 'mobx-react';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';

export interface RAGLoadingState {
  stage: 'processing' | 'embedding' | 'indexing' | 'searching' | 'complete';
  progress: number;
  message: string;
  documentName?: string;
  chunkCount?: number;
  currentChunk?: number;
}

export interface RAGLoadingIndicatorProps {
  loadingState: RAGLoadingState;
  onCancel?: () => void;
  showProgress?: boolean;
  compact?: boolean;
}

const stageIcons = {
  processing: 'file-document-outline',
  embedding: 'brain',
  indexing: 'database',
  searching: 'magnify',
  complete: 'check-circle',
};

const stageMessages = {
  processing: 'Processing document...',
  embedding: 'Generating embeddings...',
  indexing: 'Building search index...',
  searching: 'Finding relevant content...',
  complete: 'Ready!',
};

export const RAGLoadingIndicator: React.FC<RAGLoadingIndicatorProps> = observer(
  ({loadingState, onCancel, showProgress = true, compact = false}) => {
    const theme = useTheme();
    const styles = createStyles({theme, compact});
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      // Pulse animation for active states
      if (loadingState.stage !== 'complete') {
        const pulse = Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]);
        Animated.loop(pulse).start();
      } else {
        pulseAnim.setValue(1);
      }

      // Slide in animation
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, [loadingState.stage, pulseAnim, slideAnim]);

    const getStageIcon = () => {
      return stageIcons[loadingState.stage] || 'loading';
    };

    const getStageMessage = () => {
      return loadingState.message || stageMessages[loadingState.stage];
    };

    const getProgressText = () => {
      if (loadingState.currentChunk && loadingState.chunkCount) {
        return `${loadingState.currentChunk}/${loadingState.chunkCount} chunks`;
      }
      if (loadingState.progress > 0) {
        return `${Math.round(loadingState.progress * 100)}%`;
      }
      return '';
    };

    if (compact) {
      return (
        <Animated.View
          style={[
            styles.compactContainer,
            {
              opacity: slideAnim,
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}>
          <Animated.View style={[styles.compactIcon, {opacity: pulseAnim}]}>
            <IconButton
              icon={getStageIcon()}
              size={16}
              iconColor={theme.colors.primary}
            />
          </Animated.View>
          <Text variant="bodySmall" style={styles.compactText}>
            {getStageMessage()}
          </Text>
          {showProgress && loadingState.progress > 0 && (
            <Text variant="bodySmall" style={styles.compactProgress}>
              {getProgressText()}
            </Text>
          )}
        </Animated.View>
      );
    }

    return (
      <Animated.View
        style={[
          styles.container,
          {
            opacity: slideAnim,
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              },
            ],
          },
        ]}>
        <View style={styles.header}>
          <Animated.View style={[styles.iconContainer, {opacity: pulseAnim}]}>
            <IconButton
              icon={getStageIcon()}
              size={24}
              iconColor={
                loadingState.stage === 'complete'
                  ? theme.colors.primary
                  : theme.colors.onSurfaceVariant
              }
            />
          </Animated.View>
          <View style={styles.textContainer}>
            <Text variant="bodyMedium" style={styles.stageText}>
              {getStageMessage()}
            </Text>
            {loadingState.documentName && (
              <Text variant="bodySmall" style={styles.documentText}>
                {loadingState.documentName}
              </Text>
            )}
          </View>
          {onCancel && loadingState.stage !== 'complete' && (
            <IconButton
              icon="close"
              size={20}
              iconColor={theme.colors.onSurfaceVariant}
              onPress={onCancel}
              style={styles.cancelButton}
            />
          )}
        </View>

        {showProgress && (
          <View style={styles.progressContainer}>
            <ProgressBar
              progress={loadingState.progress}
              color={theme.colors.primary}
              style={styles.progressBar}
            />
            <View style={styles.progressTextContainer}>
              <Text variant="bodySmall" style={styles.progressText}>
                {getProgressText()}
              </Text>
              {loadingState.stage === 'embedding' && loadingState.chunkCount && (
                <Text variant="bodySmall" style={styles.progressDetail}>
                  Processing {loadingState.chunkCount} chunks
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Stage indicators */}
        <View style={styles.stageIndicators}>
          {Object.keys(stageIcons).map((stage, index) => {
            const isActive = stage === loadingState.stage;
            const isCompleted = Object.keys(stageIcons).indexOf(loadingState.stage) > index;
            
            return (
              <View key={stage} style={styles.stageIndicator}>
                <View
                  style={[
                    styles.stageDot,
                    isActive && styles.stageDotActive,
                    isCompleted && styles.stageDotCompleted,
                  ]}
                />
                {index < Object.keys(stageIcons).length - 1 && (
                  <View
                    style={[
                      styles.stageConnector,
                      isCompleted && styles.stageConnectorCompleted,
                    ]}
                  />
                )}
              </View>
            );
          })}
        </View>
      </Animated.View>
    );
  }
);