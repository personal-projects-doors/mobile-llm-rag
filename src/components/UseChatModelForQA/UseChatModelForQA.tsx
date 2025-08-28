/**
 * Component to use the same loaded chat model for Q&A system
 * This is the most efficient approach - no need to load multiple models
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { modelStore } from '../../store';
import { anatomyRAGService } from '../../services/AnatomyRAGService';

export const UseChatModelForQA: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('Checking...');
  const [refreshing, setRefreshing] = useState(false);

  const updateStatus = () => {
    const hasContext = !!modelStore.context;
    const activeModelId = modelStore.activeModelId;
    const activeModel = activeModelId ? modelStore.models.find(m => m.id === activeModelId) : null;
    
    if (hasContext && activeModel) {
      setStatus(`✅ Chat model loaded: ${activeModel.name}`);
    } else if (activeModelId && !hasContext) {
      setStatus(`⚠️ Model selected but not loaded: ${activeModelId}`);
    } else {
      setStatus('❌ No chat model currently loaded');
    }
  };

  useEffect(() => {
    updateStatus();
    
    // Update status periodically
    const interval = setInterval(updateStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const getCurrentModelInfo = () => {
    const hasContext = !!modelStore.context;
    const activeModelId = modelStore.activeModelId;
    const activeModel = activeModelId ? modelStore.models.find(m => m.id === activeModelId) : null;
    
    return {
      hasContext,
      activeModelId,
      activeModel,
      modelName: activeModel?.name || 'Unknown',
      canUseForQA: hasContext && activeModel
    };
  };

  const handleUseForQA = async () => {
    setLoading(true);
    
    try {
      const modelInfo = getCurrentModelInfo();
      
      if (!modelInfo.canUseForQA) {
        Alert.alert(
          'No Model Available',
          'Please load a model in the chat first, then try again.\n\nGo to Chat → Load a model → Come back here',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('🔄 Initializing Q&A with current chat model...');
      
      // Initialize the anatomy RAG service - it will detect and use the loaded model
      await anatomyRAGService.initialize();
      
      // Test the Q&A functionality
      console.log('🧪 Testing Q&A functionality...');
      const testResult = await anatomyRAGService.askQuestion('What are muscles?', {
        maxSources: 3,
        minSimilarity: 0.3
      });
      
      const isUsingAI = !testResult.answer.includes('(Note: AI model unavailable');
      
      if (isUsingAI) {
        Alert.alert(
          'Success! 🎉',
          `Q&A is now using your chat model!\n\nModel: ${modelInfo.modelName}\nTest answer length: ${testResult.answer.length} chars\nSources found: ${testResult.sources.length}\nProcessing time: ${testResult.processingTime}ms\n\nYour Q&A system is ready to use!`,
          [{ text: 'Great!' }]
        );
      } else {
        Alert.alert(
          'Fallback Mode',
          `Q&A initialized but using fallback mode.\n\nThis means the model context isn't accessible for Q&A, but vector search still works.\n\nTry reloading the model or check model compatibility.`,
          [{ text: 'OK' }]
        );
      }
      
    } catch (error) {
      console.error('Error using chat model for Q&A:', error);
      Alert.alert(
        'Error',
        `Failed to initialize Q&A with chat model:\n\n${error instanceof Error ? error.message : 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = () => {
    setRefreshing(true);
    updateStatus();
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleTestQA = async () => {
    try {
      setLoading(true);
      
      const testQuestions = [
        'What are the quadriceps muscles?',
        'Describe the hip joint',
        'What bones make up the shoulder?'
      ];
      
      const randomQuestion = testQuestions[Math.floor(Math.random() * testQuestions.length)];
      
      console.log(`🧪 Testing Q&A with: "${randomQuestion}"`);
      const result = await anatomyRAGService.askQuestion(randomQuestion);
      
      const isUsingAI = !result.answer.includes('(Note: AI model unavailable');
      const modelInfo = getCurrentModelInfo();
      
      Alert.alert(
        'Q&A Test Result',
        `Question: ${randomQuestion}\n\nUsing AI: ${isUsingAI ? '✅ Yes' : '❌ No (Fallback)'}\nModel: ${modelInfo.modelName}\nAnswer length: ${result.answer.length} chars\nSources: ${result.sources.length}\nTime: ${result.processingTime}ms\nConfidence: ${(result.confidence * 100).toFixed(0)}%`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      Alert.alert(
        'Test Failed',
        `Q&A test failed:\n\n${error instanceof Error ? error.message : 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const modelInfo = getCurrentModelInfo();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔄 Use Chat Model for Q&A</Text>
      <Text style={styles.subtitle}>Reuse the loaded chat model for anatomy Q&A</Text>
      
      {/* Current Status */}
      <View style={styles.statusContainer}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Chat Model Status:</Text>
          <TouchableOpacity onPress={handleRefreshStatus} disabled={refreshing}>
            {refreshing ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Text style={styles.refreshText}>🔄</Text>
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.statusText}>{status}</Text>
        
        {modelInfo.activeModel && (
          <View style={styles.modelDetails}>
            <Text style={styles.detailText}>Model: {modelInfo.modelName}</Text>
            <Text style={styles.detailText}>Context: {modelInfo.hasContext ? '✅' : '❌'}</Text>
            <Text style={styles.detailText}>Ready for Q&A: {modelInfo.canUseForQA ? '✅' : '❌'}</Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button, 
            styles.useButton,
            !modelInfo.canUseForQA && styles.disabledButton
          ]}
          onPress={handleUseForQA}
          disabled={loading || !modelInfo.canUseForQA}
        >
          {loading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.buttonText}>
              {modelInfo.canUseForQA ? '🔄 Use for Q&A' : '⚠️ Load Chat Model First'}
            </Text>
          )}
        </TouchableOpacity>

        {modelInfo.canUseForQA && (
          <TouchableOpacity
            style={[styles.button, styles.testButton]}
            onPress={handleTestQA}
            disabled={loading}
          >
            <Text style={styles.buttonText}>🧪 Test Q&A</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>How This Works:</Text>
        <Text style={styles.instructionText}>
          1. 📱 Load any model in the chat interface{'\n'}
          2. 🔄 Come back here and tap "Use for Q&A"{'\n'}
          3. ✅ Q&A will reuse the same loaded model{'\n'}
          4. 🧪 Test with "Test Q&A" to verify it works{'\n'}
          5. 💡 No need to load multiple models!
        </Text>
      </View>

      {/* Benefits */}
      <View style={styles.benefitsContainer}>
        <Text style={styles.benefitsTitle}>Benefits:</Text>
        <Text style={styles.benefitText}>
          • 🚀 Faster - no additional model loading{'\n'}
          • 💾 Memory efficient - single model in memory{'\n'}
          • 🔄 Automatic - detects loaded chat model{'\n'}
          • ✅ Reliable - uses proven working model
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#212529',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#6c757d',
    marginBottom: 16,
  },
  statusContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
  },
  refreshText: {
    fontSize: 16,
    color: '#007AFF',
  },
  statusText: {
    fontSize: 14,
    color: '#212529',
    marginBottom: 8,
  },
  modelDetails: {
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  detailText: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 2,
  },
  buttonContainer: {
    gap: 8,
    marginBottom: 16,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  useButton: {
    backgroundColor: '#007AFF',
  },
  testButton: {
    backgroundColor: '#28a745',
  },
  disabledButton: {
    backgroundColor: '#adb5bd',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  instructionsContainer: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 12,
    color: '#1976d2',
    lineHeight: 18,
  },
  benefitsContainer: {
    backgroundColor: '#e8f5e8',
    padding: 12,
    borderRadius: 6,
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#155724',
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 12,
    color: '#155724',
    lineHeight: 18,
  },
});