/**
 * Component to help load and manage the local MedGemma model
 * Add this to your app's settings or debug screen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { loadLocalMedGemmaModel, checkMedGemmaModelStatus } from '../../utils/loadLocalModel';
import { modelStore } from '../../store';

interface ModelStatus {
  found: boolean;
  downloaded: boolean;
  active: boolean;
  hasContext: boolean;
  message: string;
}

export const ModelLoader: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<ModelStatus | null>(null);

  // Check model status on component mount and periodically
  useEffect(() => {
    updateStatus();
    const interval = setInterval(updateStatus, 2000); // Check every 2 seconds
    return () => clearInterval(interval);
  }, []);

  const updateStatus = () => {
    const modelStatus = checkMedGemmaModelStatus();
    setStatus(modelStatus as ModelStatus);
  };

  const handleLoadModel = async () => {
    setLoading(true);
    try {
      const result = await loadLocalMedGemmaModel();
      
      if (result.success) {
        Alert.alert(
          'Success! 🎉',
          result.message,
          [{ text: 'OK', onPress: updateStatus }]
        );
      } else {
        Alert.alert(
          'Error ❌',
          `${result.message}\n\nTip: Try using the "Use Chat Model for Q&A" component instead for better reliability.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Error ❌',
        `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      updateStatus();
    }
  };

  const handleReleaseModel = async () => {
    try {
      await modelStore.releaseContext();
      Alert.alert('Model Released', 'Model context has been released');
      updateStatus();
    } catch (error) {
      Alert.alert('Error', 'Failed to release model context');
    }
  };

  const getStatusColor = () => {
    if (!status?.found) return '#ff4444';
    if (!status.downloaded) return '#ff8800';
    if (!status.active) return '#ffaa00';
    return '#44aa44';
  };

  const getStatusText = () => {
    if (!status?.found) return 'Model Not Found';
    if (!status.downloaded) return 'Not Downloaded';
    if (!status.active) return 'Downloaded, Not Active';
    return 'Active & Ready';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MedGemma Model Manager</Text>
      
      {/* Status Display */}
      <View style={styles.statusContainer}>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
        <Text style={styles.statusText}>{getStatusText()}</Text>
      </View>
      
      {status && (
        <View style={styles.detailsContainer}>
          <Text style={styles.detailText}>Found: {status.found ? '✅' : '❌'}</Text>
          <Text style={styles.detailText}>Downloaded: {status.downloaded ? '✅' : '❌'}</Text>
          <Text style={styles.detailText}>Active: {status.active ? '✅' : '❌'}</Text>
          <Text style={styles.detailText}>Context: {status.hasContext ? '✅' : '❌'}</Text>
          <Text style={styles.messageText}>{status.message}</Text>
        </View>
      )}
      
      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.loadButton]}
          onPress={handleLoadModel}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>
              {status?.active ? 'Reload Model' : 'Load Model'}
            </Text>
          )}
        </TouchableOpacity>
        
        {status?.active && (
          <TouchableOpacity
            style={[styles.button, styles.releaseButton]}
            onPress={handleReleaseModel}
          >
            <Text style={styles.buttonText}>Release Model</Text>
          </TouchableOpacity>
        )}
        

      </View>
      
      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Instructions:</Text>
        <Text style={styles.instructionText}>
          1. Ensure the model file is in the correct location
        </Text>
        <Text style={styles.instructionText}>
          2. Tap "Load Model" to initialize the MedGemma model
        </Text>
        <Text style={styles.instructionText}>
          3. Wait for initialization to complete
        </Text>
        <Text style={styles.instructionText}>
          4. The model will be ready for RAG/Q&A functionality
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    margin: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  detailsContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  detailText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#666',
  },
  messageText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#888',
    marginTop: 5,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  loadButton: {
    backgroundColor: '#007AFF',
  },
  releaseButton: {
    backgroundColor: '#FF3B30',
  },

  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  instructionText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#666',
  },
});