import React, {useEffect, useRef} from 'react';
import {View, Animated} from 'react-native';
import {Text, IconButton, Card} from 'react-native-paper';
import {observer} from 'mobx-react';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';

export interface RAGTransitionProps {
  isRAGEnabled: boolean;
  documentCount: number;
  onTransitionComplete?: (enabled: boolean) => void;
  showAnimation?: boolean;
}

export const RAGTransition: React.FC<RAGTransitionProps> = observer(
  ({isRAGEnabled, documentCount, onTransitionComplete, showAnimation = true}) => {
    const theme = useTheme();
    const styles = createStyles({theme});
    
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;
    const colorAnim = useRef(new Animated.Value(isRAGEnabled ? 1 : 0)).current;

    useEffect(() => {
      if (!showAnimation) return;

      const animations = [];

      // Scale animation for mode change
      animations.push(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ])
      );

      // Color transition
      animations.push(
        Animated.timing(colorAnim, {
          toValue: isRAGEnabled ? 1 : 0,
          duration: 300,
          useNativeDriver: false,
        })
      );

      // Slide in effect for document count
      if (isRAGEnabled && documentCount > 0) {
        animations.push(
          Animated.timing(slideAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          })
        );
      } else {
        animations.push(
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          })
        );
      }

      Animated.parallel(animations).start(() => {
        onTransitionComplete?.(isRAGEnabled);
      });
    }, [isRAGEnabled, documentCount, showAnimation, scaleAnim, fadeAnim, slideAnim, colorAnim, onTransitionComplete]);

    const backgroundColor = colorAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [theme.colors.surface, theme.colors.primaryContainer],
    });

    const textColor = colorAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [theme.colors.onSurfaceVariant, theme.colors.primary],
    });

    const iconColor = colorAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [theme.colors.onSurfaceVariant, theme.colors.primary],
    });

    if (!isRAGEnabled && documentCount === 0) {
      return null;
    }

    return (
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{scale: scaleAnim}],
            opacity: fadeAnim,
          },
        ]}>
        <Animated.View style={[styles.card, {backgroundColor}]}>
          <View style={styles.content}>
            <Animated.View style={styles.iconContainer}>
              <IconButton
                icon={isRAGEnabled ? 'book-open-variant' : 'book-outline'}
                size={20}
                iconColor={iconColor}
                style={styles.icon}
              />
            </Animated.View>

            <View style={styles.textContainer}>
              <Animated.Text style={[styles.modeText, {color: textColor}]}>
                {isRAGEnabled ? 'RAG Mode' : 'Chat Mode'}
              </Animated.Text>
              
              {isRAGEnabled && (
                <Animated.View
                  style={[
                    styles.documentCountContainer,
                    {
                      opacity: slideAnim,
                      transform: [
                        {
                          translateX: slideAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-20, 0],
                          }),
                        },
                      ],
                    },
                  ]}>
                  <Animated.Text style={[styles.documentCount, {color: textColor}]}>
                    {documentCount} document{documentCount !== 1 ? 's' : ''}
                  </Animated.Text>
                </Animated.View>
              )}
            </View>

            {/* Status indicator */}
            <Animated.View
              style={[
                styles.statusIndicator,
                {
                  backgroundColor: isRAGEnabled ? theme.colors.primary : theme.colors.surfaceVariant,
                  transform: [
                    {
                      scale: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>

          {/* Animated border */}
          <Animated.View
            style={[
              styles.border,
              {
                backgroundColor: iconColor,
                opacity: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.3],
                }),
              },
            ]}
          />
        </Animated.View>
      </Animated.View>
    );
  }
);