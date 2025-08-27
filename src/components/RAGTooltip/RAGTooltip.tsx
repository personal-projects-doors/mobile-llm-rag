import React, {useEffect, useRef} from 'react';
import {View, Animated, TouchableOpacity, Modal} from 'react-native';
import {Text, IconButton, Card} from 'react-native-paper';
import {observer} from 'mobx-react';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';

export interface RAGTooltipProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  content: string;
  position: {x: number; y: number};
  arrowDirection?: 'up' | 'down' | 'left' | 'right';
  showCloseButton?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
}

export const RAGTooltip: React.FC<RAGTooltipProps> = observer(
  ({
    visible,
    onDismiss,
    title,
    content,
    position,
    arrowDirection = 'up',
    showCloseButton = true,
    autoHide = false,
    autoHideDelay = 3000,
  }) => {
    const theme = useTheme();
    const styles = createStyles({theme, arrowDirection});
    
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const slideAnim = useRef(new Animated.Value(-10)).current;

    useEffect(() => {
      if (visible) {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();

        if (autoHide) {
          const timer = setTimeout(() => {
            handleDismiss();
          }, autoHideDelay);
          return () => clearTimeout(timer);
        }
      } else {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.8,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, [visible, fadeAnim, scaleAnim, slideAnim, autoHide, autoHideDelay]);

    const handleDismiss = () => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onDismiss();
      });
    };

    const getTooltipStyle = () => {
      const baseStyle = {
        position: 'absolute' as const,
        left: position.x,
        top: position.y,
      };

      switch (arrowDirection) {
        case 'up':
          return {
            ...baseStyle,
            top: position.y + 10,
          };
        case 'down':
          return {
            ...baseStyle,
            top: position.y - 10,
          };
        case 'left':
          return {
            ...baseStyle,
            left: position.x + 10,
          };
        case 'right':
          return {
            ...baseStyle,
            left: position.x - 10,
          };
        default:
          return baseStyle;
      }
    };

    const getArrowStyle = () => {
      switch (arrowDirection) {
        case 'up':
          return styles.arrowUp;
        case 'down':
          return styles.arrowDown;
        case 'left':
          return styles.arrowLeft;
        case 'right':
          return styles.arrowRight;
        default:
          return styles.arrowUp;
      }
    };

    if (!visible) {
      return null;
    }

    return (
      <Modal
        transparent
        visible={visible}
        animationType="none"
        onRequestClose={handleDismiss}>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={handleDismiss}>
          <Animated.View
            style={[
              getTooltipStyle(),
              {
                opacity: fadeAnim,
                transform: [
                  {scale: scaleAnim},
                  {
                    translateY: slideAnim,
                  },
                ],
              },
            ]}>
            <TouchableOpacity activeOpacity={1}>
              <Card style={styles.tooltipCard}>
                <View style={styles.tooltipContent}>
                  <View style={styles.header}>
                    <Text variant="titleSmall" style={styles.title}>
                      {title}
                    </Text>
                    {showCloseButton && (
                      <IconButton
                        icon="close"
                        size={16}
                        iconColor={theme.colors.onSurfaceVariant}
                        onPress={handleDismiss}
                        style={styles.closeButton}
                      />
                    )}
                  </View>
                  <Text variant="bodySmall" style={styles.content}>
                    {content}
                  </Text>
                </View>
                
                {/* Arrow */}
                <View style={[styles.arrow, getArrowStyle()]} />
              </Card>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    );
  }
);