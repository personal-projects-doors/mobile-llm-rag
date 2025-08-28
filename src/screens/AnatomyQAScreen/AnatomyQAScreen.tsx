import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Dimensions,
} from 'react-native';
import { useAnatomyQA } from '../../hooks/useAnatomyQA';
import { AnatomyQAResult } from '../../services/AnatomyRAGService';

const { width } = Dimensions.get('window');

export const AnatomyQAScreen: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [currentResult, setCurrentResult] = useState<AnatomyQAResult | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  const {
    askQuestion,
    isLoading,
    error,
    isReady,
    suggestedQuestions,
    anatomySystems,
    clearError,
  } = useAnatomyQA();

  const handleAskQuestion = async () => {
    if (!question.trim()) {
      Alert.alert('Question Required', 'Please enter a question about anatomy');
      return;
    }

    try {
      clearError();
      setShowSuggestions(false);
      
      const result = await askQuestion(question.trim(), {
        maxSources: 5,
        minSimilarity: 0.3,
        includePageNumbers: true,
      });
      
      setCurrentResult(result);
      
      // Scroll to show the result
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
    } catch (err) {
      console.error('Q&A error:', err);
      Alert.alert('Error', 'Failed to process your question. Please try again.');
    }
  };

  const handleSuggestedQuestion = (suggestedQ: string) => {
    setQuestion(suggestedQ);
    setShowSuggestions(false);
  };

  const handleSystemTopic = (system: { name: string; keywords: string[] }) => {
    const randomKeyword = system.keywords[Math.floor(Math.random() * system.keywords.length)];
    const questionTemplates = [
      `Tell me about ${randomKeyword} anatomy`,
      `What is the structure of ${randomKeyword}?`,
      `How does ${randomKeyword} function?`,
      `Describe the ${randomKeyword} in detail`,
    ];
    const randomTemplate = questionTemplates[Math.floor(Math.random() * questionTemplates.length)];
    setQuestion(randomTemplate);
    setShowSuggestions(false);
  };

  const resetToSuggestions = () => {
    setQuestion('');
    setCurrentResult(null);
    setShowSuggestions(true);
    clearError();
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return '#28a745'; // Green
    if (confidence >= 0.6) return '#ffc107'; // Yellow
    return '#dc3545'; // Red
  };

  const getConfidenceText = (confidence: number): string => {
    if (confidence >= 0.8) return 'High Confidence';
    if (confidence >= 0.6) return 'Medium Confidence';
    return 'Low Confidence';
  };

  if (!isReady && isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Initializing Anatomy Q&A System...</Text>
        <Text style={styles.subText}>Loading vectors and AI model</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>🧠 Anatomy Q&A</Text>
          <Text style={styles.subtitle}>
            Ask questions about anatomy and get AI-powered answers
          </Text>
          {!isReady && (
            <Text style={styles.warningText}>
              ⚠️ Loading anatomy database...
            </Text>
          )}
          {isReady && (
            <Text style={styles.readyText}>
              ✅ Ready! 1,174 anatomy chunks loaded
            </Text>
          )}
        </View>

        {/* Question Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.questionInput}
            placeholder="Ask about anatomy (e.g., 'What are the quadriceps muscles?')"
            value={question}
            onChangeText={setQuestion}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <View style={styles.inputActions}>
            <TouchableOpacity 
              style={styles.clearButton} 
              onPress={resetToSuggestions}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.askButton, (!question.trim() || isLoading) && styles.disabledButton]} 
              onPress={handleAskQuestion}
              disabled={isLoading || !question.trim()}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.askButtonText}>Ask Question</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Answer Display */}
        {currentResult && (
          <View style={styles.resultContainer}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Answer</Text>
              <View style={styles.confidenceContainer}>
                <View 
                  style={[
                    styles.confidenceBadge, 
                    { backgroundColor: getConfidenceColor(currentResult.confidence) }
                  ]}
                >
                  <Text style={styles.confidenceText}>
                    {getConfidenceText(currentResult.confidence)}
                  </Text>
                </View>
              </View>
            </View>
            
            <Text style={styles.answerText}>{currentResult.answer}</Text>
            
            {/* Sources */}
            {currentResult.sources.length > 0 && (
              <View style={styles.sourcesContainer}>
                <Text style={styles.sourcesTitle}>Sources ({currentResult.sources.length})</Text>
                {currentResult.sources.map((source, index) => (
                  <View key={source.chunk.id} style={styles.sourceItem}>
                    <Text style={styles.sourceText}>
                      {source.chunk.text}
                    </Text>
                    <View style={styles.sourceMeta}>
                      <Text style={styles.sourceMetaText}>
                        Page {source.chunk.page} • {(source.similarity * 100).toFixed(0)}% match
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            
            {/* Processing Info */}
            <View style={styles.processingInfo}>
              <Text style={styles.processingText}>
                Processed in {currentResult.processingTime}ms • Confidence: {(currentResult.confidence * 100).toFixed(0)}%
              </Text>
            </View>
          </View>
        )}

        {/* Suggestions */}
        {showSuggestions && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>💡 Suggested Questions</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {suggestedQuestions.slice(0, 5).map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionChip}
                  onPress={() => handleSuggestedQuestion(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.systemsTitle}>🔍 Browse by System</Text>
            <View style={styles.systemsGrid}>
              {anatomySystems.map((system, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.systemCard}
                  onPress={() => handleSystemTopic(system)}
                >
                  <Text style={styles.systemName}>{system.name}</Text>
                  <Text style={styles.systemKeywords}>
                    {system.keywords.slice(0, 3).join(', ')}...
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#212529',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 4,
  },
  warningText: {
    fontSize: 14,
    color: '#dc3545',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  readyText: {
    fontSize: 14,
    color: '#28a745',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  inputContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  questionInput: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  inputActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  clearButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  askButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 6,
    minWidth: 120,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#adb5bd',
  },
  askButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#495057',
    fontWeight: '500',
  },
  subText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6c757d',
  },
  errorContainer: {
    backgroundColor: '#f8d7da',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f5c6cb',
  },
  errorText: {
    color: '#721c24',
    fontSize: 14,
    textAlign: 'center',
  },
  resultContainer: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
  },
  confidenceContainer: {
    alignItems: 'flex-end',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  answerText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#212529',
    marginBottom: 16,
  },
  sourcesContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  sourcesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 12,
  },
  sourceItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  sourceText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#495057',
    marginBottom: 6,
  },
  sourceMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sourceMetaText: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  processingInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  processingText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
  },
  suggestionsContainer: {
    padding: 16,
  },
  suggestionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 12,
  },
  suggestionChip: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    maxWidth: width * 0.7,
  },
  suggestionText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
  },
  systemsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginTop: 24,
    marginBottom: 12,
  },
  systemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  systemCard: {
    backgroundColor: '#fff',
    width: (width - 48) / 2,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  systemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  systemKeywords: {
    fontSize: 12,
    color: '#6c757d',
    lineHeight: 16,
  },
});