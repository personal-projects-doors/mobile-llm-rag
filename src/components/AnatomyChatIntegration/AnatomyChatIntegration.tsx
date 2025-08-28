import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useAnatomyQA } from '../../hooks/useAnatomyQA';
import { AnatomyQAResult } from '../../services/AnatomyRAGService';

interface AnatomyChatIntegrationProps {
  visible: boolean;
  onClose: () => void;
  onUseAnswer: (answer: string, sources: string) => void;
  initialQuestion?: string;
}

export const AnatomyChatIntegration: React.FC<AnatomyChatIntegrationProps> = ({
  visible,
  onClose,
  onUseAnswer,
  initialQuestion = '',
}) => {
  const [result, setResult] = useState<AnatomyQAResult | null>(null);
  const { askQuestion, isLoading, error, suggestedQuestions } = useAnatomyQA();

  const handleQuestionPress = async (question: string) => {
    try {
      const qaResult = await askQuestion(question);
      setResult(qaResult);
    } catch (err) {
      console.error('Error asking question:', err);
    }
  };

  const handleUseInChat = () => {
    if (!result) return;

    const sourcesText = result.sources.length > 0 
      ? `\n\nSources: ${result.sources.map(s => `Page ${s.chunk.page}`).join(', ')}`
      : '';

    onUseAnswer(result.answer, sourcesText);
    onClose();
    setResult(null);
  };

  React.useEffect(() => {
    if (visible && initialQuestion) {
      handleQuestionPress(initialQuestion);
    }
  }, [visible, initialQuestion]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Anatomy Assistant</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Getting anatomy information...</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {result && (
            <View style={styles.resultContainer}>
              <Text style={styles.answerText}>{result.answer}</Text>
              
              {result.sources.length > 0 && (
                <View style={styles.sourcesContainer}>
                  <Text style={styles.sourcesTitle}>Sources:</Text>
                  {result.sources.slice(0, 3).map((source, index) => (
                    <Text key={index} style={styles.sourceText}>
                      • Page {source.chunk.page}: {source.chunk.text.substring(0, 100)}...
                    </Text>
                  ))}
                </View>
              )}

              <TouchableOpacity 
                style={styles.useButton}
                onPress={handleUseInChat}
              >
                <Text style={styles.useButtonText}>Use in Chat</Text>
              </TouchableOpacity>
            </View>
          )}

          {!result && !isLoading && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Quick Questions:</Text>
              {suggestedQuestions.slice(0, 6).map((question, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionButton}
                  onPress={() => handleQuestionPress(question)}
                >
                  <Text style={styles.suggestionText}>{question}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6c757d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6c757d',
  },
  errorContainer: {
    backgroundColor: '#f8d7da',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  errorText: {
    color: '#721c24',
    fontSize: 14,
  },
  resultContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  sourceText: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 4,
    lineHeight: 16,
  },
  useButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 16,
  },
  useButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  suggestionsContainer: {
    marginTop: 16,
  },
  suggestionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 12,
  },
  suggestionButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  suggestionText: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
  },
});