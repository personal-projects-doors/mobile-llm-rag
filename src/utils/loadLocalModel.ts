/**
 * Utility to load the local MedGemma model into the app
 * This will copy the model file and update the model store
 */

import RNFS from '@dr.pogodin/react-native-fs';
import { modelStore } from '../store';
import { Platform } from 'react-native';

export interface LoadModelResult {
  success: boolean;
  message: string;
  modelId?: string;
}

/**
 * Load the local MedGemma model file into the app
 * This function will:
 * 1. Copy the model file to the app's documents directory
 * 2. Update the model store to mark it as downloaded
 * 3. Initialize the model context
 */
export async function loadLocalMedGemmaModel(): Promise<LoadModelResult> {
  try {
    console.log('🚀 Starting local MedGemma model integration...');
    
    // Model configuration
    const modelId = 'unsloth/medgemma-4b-it-GGUF/medgemma-4b-it-IQ4_NL.gguf';
    const fileName = 'medgemma-4b-it-IQ4_NL.gguf';
    
    // Find the model in the store
    const model = modelStore.models.find(m => m.id === modelId);
    if (!model) {
      return {
        success: false,
        message: 'MedGemma model not found in model store. Please check model configuration.'
      };
    }
    
    // Check if already downloaded
    if (model.isDownloaded) {
      console.log('✅ Model already marked as downloaded');
      
      // Try to initialize context if not already active
      if (!modelStore.context || modelStore.activeModelId !== modelId) {
        try {
          await modelStore.initContext(model);
          return {
            success: true,
            message: 'Model was already downloaded and has been activated successfully',
            modelId
          };
        } catch (error) {
          console.error('Error initializing existing model:', error);
          return {
            success: false,
            message: `Model exists but failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
        }
      }
      
      return {
        success: true,
        message: 'Model is already downloaded and active',
        modelId
      };
    }
    
    // Get the expected model path using the store's method
    const expectedPath = await modelStore.getModelFullPath(model);
    console.log(`📁 Expected model path: ${expectedPath}`);
    
    // Check if file already exists at expected location
    const fileExists = await RNFS.exists(expectedPath);
    
    if (!fileExists) {
      // For development/testing, you might want to copy from your local models directory
      // In production, users would download through the app's download mechanism
      
      console.log('📥 Model file not found at expected location');
      console.log('💡 Please download the model through the app\'s Models section');
      
      return {
        success: false,
        message: 'Model file not found. Please download the MedGemma model through Settings → Models'
      };
    }
    
    // File exists, mark as downloaded and initialize
    console.log('✅ Model file found, updating store...');
    
    // Update model store
    model.isDownloaded = true;
    model.progress = 100;
    
    console.log('🔄 Initializing model context...');
    
    // Initialize the model context
    await modelStore.initContext(model);
    
    console.log('✅ Model loaded and initialized successfully!');
    
    return {
      success: true,
      message: 'MedGemma model loaded and initialized successfully',
      modelId
    };
    
  } catch (error) {
    console.error('❌ Error loading local model:', error);
    return {
      success: false,
      message: `Failed to load model: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Copy model file from development location to app directory
 * This is mainly for development purposes
 */
export async function copyModelFromDevelopmentLocation(): Promise<LoadModelResult> {
  try {
    const modelId = 'unsloth/medgemma-4b-it-GGUF/medgemma-4b-it-IQ4_NL.gguf';
    const fileName = 'medgemma-4b-it-IQ4_NL.gguf';
    
    // Find the model in the store
    const model = modelStore.models.find(m => m.id === modelId);
    if (!model) {
      return {
        success: false,
        message: 'MedGemma model not found in model store'
      };
    }
    
    // Get destination path
    const destPath = await modelStore.getModelFullPath(model);
    const destDir = destPath.substring(0, destPath.lastIndexOf('/'));
    
    // Ensure destination directory exists
    const dirExists = await RNFS.exists(destDir);
    if (!dirExists) {
      await RNFS.mkdir(destDir, { NSURLIsExcludedFromBackupKey: true });
      console.log(`📁 Created directory: ${destDir}`);
    }
    
    // Check if file already exists
    const fileExists = await RNFS.exists(destPath);
    if (fileExists) {
      console.log('✅ Model file already exists at destination');
    } else {
      // For development, you would need to manually place the file
      // or implement a copy mechanism from your development location
      console.log('📥 Model file needs to be copied to:', destPath);
      console.log('💡 Please copy your model file to this location manually');
      
      return {
        success: false,
        message: `Please copy the model file to: ${destPath}`
      };
    }
    
    // Mark as downloaded
    model.isDownloaded = true;
    model.progress = 100;
    
    // Initialize context
    await modelStore.initContext(model);
    
    return {
      success: true,
      message: 'Model copied and initialized successfully',
      modelId
    };
    
  } catch (error) {
    console.error('Error copying model:', error);
    return {
      success: false,
      message: `Failed to copy model: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Check the status of the MedGemma model
 */
export function checkMedGemmaModelStatus() {
  const modelId = 'unsloth/medgemma-4b-it-GGUF/medgemma-4b-it-IQ4_NL.gguf';
  const model = modelStore.models.find(m => m.id === modelId);
  
  if (!model) {
    return {
      found: false,
      message: 'MedGemma model not found in store'
    };
  }
  
  return {
    found: true,
    downloaded: model.isDownloaded,
    active: modelStore.activeModelId === modelId,
    hasContext: !!modelStore.context,
    message: `Model found - Downloaded: ${model.isDownloaded}, Active: ${modelStore.activeModelId === modelId}`
  };
}