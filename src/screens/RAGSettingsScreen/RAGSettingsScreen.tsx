import React, {useState, useEffect, useRef, useContext} from 'react';
import {
  View,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  TextInput as RNTextInput,
  Alert,
} from 'react-native';

import {debounce} from 'lodash';
import {observer} from 'mobx-react-lite';
import Slider from '@react-native-community/slider';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Switch, Text, Card, Button, Icon, List, Chip} from 'react-native-paper';

import {TextInput, Divider} from '../../components';
import {useTheme} from '../../hooks';
import {createStyles} from './styles';
import {ragStore} from '../../store';
import {L10nContext} from '../../utils';

export const RAGSettingsScreen: React.FC = observer(() => {
  const l10n = useContext(L10nContext);
  const theme = useTheme();
  const styles = createStyles(theme);
  
  // Local state for input validation
  const [chunkSizeInput, setChunkSizeInput] = useState(ragStore.chunkSize.toString());
  const [overlapInput, setOverlapInput] = useState(ragStore.overlap.toString());
  const [isValidChunkSize, setIsValidChunkSize] = useState(true);
  const [isValidOverlap, setIsValidOverlap] = useState(true);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  
  // Refs for input handling
  const chunkSizeInputRef = useRef<RNTextInput>(null);
  const overlapInputRef = useRef<RNTextInput>(null);

  // Debounced update functions
  const debouncedUpdateChunkSize = useRef(
    debounce(async (value: number) => {
      try {
        await ragStore.setChunkSize(value);
      } catch (error) {
        console.error('Failed to update chunk size:', error);
      }
    }, 500),
  ).current;

  const debouncedUpdateOverlap = useRef(
    debounce(async (value: number) => {
      try {
        await ragStore.setOverlap(value);
      } catch (error) {
        console.error('Failed to update overlap:', error);
      }
    }, 500),
  ).current;

  useEffect(() => {
    // Initialize RAG store
    ragStore.initialize();
    
    return () => {
      debouncedUpdateChunkSize.cancel();
      debouncedUpdateOverlap.cancel();
    };
  }, []);

  useEffect(() => {
    // Update local state when store changes
    setChunkSizeInput(ragStore.chunkSize.toString());
    setOverlapInput(ragStore.overlap.toString());
  }, [ragStore.chunkSize, ragStore.overlap]);

  const handleOutsidePress = () => {
    Keyboard.dismiss();
    chunkSizeInputRef.current?.blur();
    overlapInputRef.current?.blur();
    
    // Reset invalid inputs to store values
    if (!isValidChunkSize) {
      setChunkSizeInput(ragStore.chunkSize.toString());
      setIsValidChunkSize(true);
    }
    if (!isValidOverlap) {
      setOverlapInput(ragStore.overlap.toString());
      setIsValidOverlap(true);
    }
  };

  const handleChunkSizeChange = (text: string) => {
    setChunkSizeInput(text);
    const value = parseInt(text, 10);
    
    if (!isNaN(value) && value >= 100 && value <= 2000) {
      setIsValidChunkSize(true);
      debouncedUpdateChunkSize(value);
    } else {
      setIsValidChunkSize(false);
    }
  };

  const handleOverlapChange = (text: string) => {
    setOverlapInput(text);
    const value = parseInt(text, 10);
    const chunkSize = parseInt(chunkSizeInput, 10) || ragStore.chunkSize;
    
    if (!isNaN(value) && value >= 0 && value < chunkSize) {
      setIsValidOverlap(true);
      debouncedUpdateOverlap(value);
    } else {
      setIsValidOverlap(false);
    }
  };

  const handleResetToDefaults = () => {
    Alert.alert(
      'Reset to Defaults',
      'Are you sure you want to reset all RAG settings to their default values?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await ragStore.resetToDefaults();
            } catch (error) {
              Alert.alert('Error', 'Failed to reset settings to defaults');
            }
          },
        },
      ],
    );
  };

  const performanceImpact = ragStore.getPerformanceImpact();
  const performanceDescription = ragStore.getPerformanceDescription(performanceImpact);

  const getPerformanceColor = (impact: 'low' | 'medium' | 'high') => {
    switch (impact) {
      case 'low':
        return theme.colors.primary;
      case 'medium':
        return theme.colors.tertiary;
      case 'high':
        return theme.colors.error;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <TouchableWithoutFeedback onPress={handleOutsidePress}>
        <ScrollView contentContainerStyle={styles.container}>
          {/* Performance Impact Indicator */}
          <Card elevation={0} style={styles.card}>
            <Card.Title title="Performance Impact" />
            <Card.Content>
              <View style={styles.performanceContainer}>
                <Chip
                  mode="outlined"
                  textStyle={[styles.performanceChip, {color: getPerformanceColor(performanceImpact)}]}
                  style={[styles.performanceChipContainer, {borderColor: getPerformanceColor(performanceImpact)}]}>
                  {performanceImpact.toUpperCase()}
                </Chip>
                <Text variant="bodySmall" style={styles.performanceDescription}>
                  {performanceDescription}
                </Text>
              </View>
            </Card.Content>
          </Card>

          {/* Document Processing Settings */}
          <Card elevation={0} style={styles.card}>
            <Card.Title title="Document Processing" />
            <Card.Content>
              {/* Chunk Size */}
              <View style={styles.settingItemContainer}>
                <Text variant="titleMedium" style={styles.textLabel}>
                  Chunk Size (tokens)
                </Text>
                <TextInput
                  ref={chunkSizeInputRef}
                  testID="chunk-size-input"
                  style={[
                    styles.textInput,
                    !isValidChunkSize && styles.invalidInput,
                  ]}
                  keyboardType="numeric"
                  value={chunkSizeInput}
                  onChangeText={handleChunkSizeChange}
                  placeholder="512"
                />
                {!isValidChunkSize && (
                  <Text style={styles.errorText}>
                    Chunk size must be between 100 and 2000 tokens
                  </Text>
                )}
                <Text variant="labelSmall" style={styles.textDescription}>
                  Size of text chunks for processing. Larger chunks provide more context but use more memory.
                </Text>
              </View>
              <Divider />

              {/* Overlap */}
              <View style={styles.settingItemContainer}>
                <Text variant="titleMedium" style={styles.textLabel}>
                  Overlap (tokens)
                </Text>
                <TextInput
                  ref={overlapInputRef}
                  testID="overlap-input"
                  style={[
                    styles.textInput,
                    !isValidOverlap && styles.invalidInput,
                  ]}
                  keyboardType="numeric"
                  value={overlapInput}
                  onChangeText={handleOverlapChange}
                  placeholder="50"
                />
                {!isValidOverlap && (
                  <Text style={styles.errorText}>
                    Overlap must be between 0 and chunk size
                  </Text>
                )}
                <Text variant="labelSmall" style={styles.textDescription}>
                  Token overlap between adjacent chunks. Helps maintain context continuity.
                </Text>
              </View>
              <Divider />

              {/* Preserve Sentences */}
              <View style={styles.settingItemContainer}>
                <View style={styles.switchContainer}>
                  <View style={styles.textContainer}>
                    <Text variant="titleMedium" style={styles.textLabel}>
                      Preserve Sentences
                    </Text>
                    <Text variant="labelSmall" style={styles.textDescription}>
                      Avoid splitting sentences across chunk boundaries for better context.
                    </Text>
                  </View>
                  <Switch
                    testID="preserve-sentences-switch"
                    value={ragStore.preserveSentences}
                    onValueChange={ragStore.setPreserveSentences}
                  />
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Retrieval Settings */}
          <Card elevation={0} style={styles.card}>
            <Card.Title title="Retrieval Configuration" />
            <Card.Content>
              {/* Max Results */}
              <View style={styles.settingItemContainer}>
                <Text variant="titleMedium" style={styles.textLabel}>
                  Max Results: {ragStore.maxResults}
                </Text>
                <Slider
                  testID="max-results-slider"
                  value={ragStore.maxResults}
                  onValueChange={value => ragStore.setMaxResults(Math.round(value))}
                  minimumValue={1}
                  maximumValue={20}
                  step={1}
                  style={styles.slider}
                  thumbTintColor={theme.colors.primary}
                  minimumTrackTintColor={theme.colors.primary}
                />
                <Text variant="labelSmall" style={styles.textDescription}>
                  Maximum number of document chunks to retrieve for each query. More results provide richer context but may slow processing.
                </Text>
              </View>
              <Divider />

              {/* Minimum Similarity */}
              <View style={styles.settingItemContainer}>
                <Text variant="titleMedium" style={styles.textLabel}>
                  Minimum Similarity: {ragStore.minSimilarity.toFixed(2)}
                </Text>
                <Slider
                  testID="min-similarity-slider"
                  value={ragStore.minSimilarity}
                  onValueChange={ragStore.setMinSimilarity}
                  minimumValue={0}
                  maximumValue={1}
                  step={0.05}
                  style={styles.slider}
                  thumbTintColor={theme.colors.primary}
                  minimumTrackTintColor={theme.colors.primary}
                />
                <Text variant="labelSmall" style={styles.textDescription}>
                  Minimum similarity threshold for including chunks in results. Higher values are more selective.
                </Text>
              </View>
            </Card.Content>
          </Card>

          {/* Advanced Settings */}
          <Card elevation={0} style={styles.card}>
            <List.Accordion
              title="Advanced Settings"
              titleStyle={styles.accordionTitle}
              style={styles.advancedAccordion}
              expanded={showAdvancedSettings}
              onPress={() => setShowAdvancedSettings(!showAdvancedSettings)}>
              <View style={styles.advancedSettingsContent}>
                <View style={styles.settingItemContainer}>
                  <Text variant="titleMedium" style={styles.textLabel}>
                    Settings Migration
                  </Text>
                  <Text variant="labelSmall" style={styles.textDescription}>
                    Settings are automatically migrated when the app updates. Current version supports all RAG features.
                  </Text>
                </View>
                <Divider />

                <View style={styles.settingItemContainer}>
                  <Text variant="titleMedium" style={styles.textLabel}>
                    Performance Optimization
                  </Text>
                  <Text variant="labelSmall" style={styles.textDescription}>
                    • Lower chunk sizes reduce memory usage{'\n'}
                    • Fewer max results improve response speed{'\n'}
                    • Higher similarity thresholds reduce processing load
                  </Text>
                </View>
              </View>
            </List.Accordion>
          </Card>

          {/* Reset Button */}
          <Card elevation={0} style={styles.card}>
            <Card.Content>
              <Button
                mode="outlined"
                onPress={handleResetToDefaults}
                style={styles.resetButton}
                icon="restore">
                Reset to Defaults
              </Button>
            </Card.Content>
          </Card>

          {/* Error Display */}
          {ragStore.error && (
            <Card elevation={0} style={[styles.card, styles.errorCard]}>
              <Card.Content>
                <View style={styles.errorContainer}>
                  <Icon source="alert-circle" size={20} color={theme.colors.error} />
                  <Text variant="bodyMedium" style={styles.errorMessage}>
                    {ragStore.error}
                  </Text>
                  <Button
                    mode="text"
                    onPress={ragStore.clearError}
                    textColor={theme.colors.error}>
                    Dismiss
                  </Button>
                </View>
              </Card.Content>
            </Card>
          )}
        </ScrollView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
});