/**
 * Example demonstrating RAG model integration with existing model management
 * This shows how to use the RAGModelManager for concurrent model usage
 */

import {ragModelManager} from './RAGModelManager';
import {ragStore} from '../../store/RAGStore';
import {modelStore} from '../../store';
import {isMedGemmaModelAvailable, getMedGemmaModel, isModelRAGCompatible} from '../../utils/ragModelUtils';

export class RAGModelIntegrationExample {
  /**
   * Example 1: Basic RAG setup with automatic model loading
   */
  static async basicRAGSetup(): Promise<void> {
    console.log('=== Basic RAG Setup Example ===');
    
    try {
      // Initialize RAG store (this also initializes the model manager)
      await ragStore.initialize();
      
      // Check if MedGemma model is available
      if (!isMedGemmaModelAvailable()) {
        console.log('MedGemma model not available, downloading...');
        const medgemmaModel = getMedGemmaModel();
        if (medgemmaModel) {
          await modelStore.checkSpaceAndDownload(medgemmaModel.id);
        }
      }
      
      // Enable RAG mode (this will auto-load the embedding model)
      await ragStore.enableRAGMode();
      
      console.log('RAG setup complete!');
      console.log('Model status:', ragStore.getModelStatus());
      
    } catch (error) {
      console.error('Failed to setup RAG:', error);
    }
  }

  /**
   * Example 2: Concurrent model usage for RAG + chat
   */
  static async concurrentModelUsage(chatModelId: string): Promise<void> {
    console.log('=== Concurrent Model Usage Example ===');
    
    try {
      // Initialize RAG store
      await ragStore.initialize();
      
      // Check if the chat model is compatible with RAG
      const compatibility = ragStore.checkModelCompatibility(chatModelId);
      if (!compatibility.isCompatible) {
        console.log(`Chat model ${chatModelId} is not compatible: ${compatibility.reason}`);
        return;
      }
      
      // Enable RAG mode with concurrent chat model
      await ragStore.enableRAGMode(chatModelId);
      
      console.log('Concurrent mode enabled!');
      console.log('Embedding model loaded:', ragStore.getModelStatus().embeddingModelLoaded);
      console.log('Concurrent mode active:', ragStore.getModelStatus().concurrentModeActive);
      
      // Now you can switch between embedding and chat modes
      await ragStore.switchToEmbeddingMode();
      console.log('Switched to embedding mode for document processing');
      
      await ragStore.switchToChatMode();
      console.log('Switched to chat mode for response generation');
      
    } catch (error) {
      console.error('Failed to setup concurrent model usage:', error);
    }
  }

  /**
   * Example 3: Model compatibility checking
   */
  static async checkModelCompatibility(): Promise<void> {
    console.log('=== Model Compatibility Check Example ===');
    
    // Get all downloaded models
    const downloadedModels = modelStore.displayModels.filter(m => m.isDownloaded);
    
    console.log(`Checking compatibility for ${downloadedModels.length} downloaded models:`);
    
    for (const model of downloadedModels) {
      const compatibility = isModelRAGCompatible(model);
      
      console.log(`\n${model.name}:`);
      console.log(`  Compatible: ${compatibility.compatible}`);
      if (!compatibility.compatible) {
        console.log(`  Reason: ${compatibility.reason}`);
      }
      console.log(`  Memory usage: ${compatibility.memoryInfo.totalMemory / (1024 * 1024 * 1024)} GB`);
      console.log(`  Within limits: ${compatibility.memoryInfo.isWithinLimits}`);
      
      if (compatibility.memoryInfo.recommendations.length > 0) {
        console.log('  Recommendations:');
        compatibility.memoryInfo.recommendations.forEach(rec => {
          console.log(`    - ${rec}`);
        });
      }
    }
  }

  /**
   * Example 4: Manual model switching workflow
   */
  static async manualModelSwitching(): Promise<void> {
    console.log('=== Manual Model Switching Example ===');
    
    try {
      // Initialize and load embedding model
      await ragStore.initialize();
      await ragStore.loadEmbeddingModel();
      
      console.log('Embedding model loaded for document processing');
      
      // Simulate document processing
      const embeddingGenerator = ragStore.getEmbeddingGenerator();
      if (embeddingGenerator) {
        console.log('Processing documents with embedding model...');
        // Document processing would happen here
      }
      
      // Switch to chat model for response generation
      const activeModelId = modelStore.activeModelId;
      if (activeModelId) {
        await ragStore.switchToChatMode(activeModelId);
        console.log('Switched to chat model for response generation');
      }
      
      // Switch back to embedding mode if needed
      await ragStore.switchToEmbeddingMode();
      console.log('Switched back to embedding mode');
      
    } catch (error) {
      console.error('Failed manual model switching:', error);
    }
  }

  /**
   * Example 5: Error handling and recovery
   */
  static async errorHandlingExample(): Promise<void> {
    console.log('=== Error Handling Example ===');
    
    try {
      await ragStore.initialize();
      
      // Try to enable RAG mode with a non-existent model
      try {
        await ragStore.enableRAGMode('non-existent-model');
      } catch (error) {
        console.log('Expected error caught:', error instanceof Error ? error.message : error);
        
        // Clear the error and try with a valid model
        ragStore.clearModelError();
        
        // Find a compatible model
        const compatibleModels = modelStore.displayModels.filter(m => {
          return m.isDownloaded && ragStore.checkModelCompatibility(m.id).isCompatible;
        });
        
        if (compatibleModels.length > 0) {
          await ragStore.enableRAGMode(compatibleModels[0].id);
          console.log('Successfully enabled RAG mode with compatible model');
        }
      }
      
    } catch (error) {
      console.error('Error handling example failed:', error);
    }
  }

  /**
   * Example 6: Configuration management
   */
  static async configurationExample(): Promise<void> {
    console.log('=== Configuration Management Example ===');
    
    // Update model configuration
    await ragStore.updateModelConfig({
      autoLoadEmbeddingModel: true,
      concurrentModelUsage: true,
    });
    
    console.log('Current model configuration:');
    console.log('  Embedding model ID:', ragStore.embeddingModelId);
    console.log('  Auto-load embedding model:', ragStore.autoLoadEmbeddingModel);
    console.log('  Concurrent model usage:', ragStore.concurrentModelUsage);
    
    // Update individual settings
    await ragStore.setAutoLoadEmbeddingModel(false);
    await ragStore.setConcurrentModelUsage(false);
    
    console.log('Updated configuration:');
    console.log('  Auto-load embedding model:', ragStore.autoLoadEmbeddingModel);
    console.log('  Concurrent model usage:', ragStore.concurrentModelUsage);
  }

  /**
   * Run all examples
   */
  static async runAllExamples(): Promise<void> {
    console.log('Running RAG Model Integration Examples...\n');
    
    await this.basicRAGSetup();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await this.checkModelCompatibility();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await this.configurationExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await this.manualModelSwitching();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await this.errorHandlingExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Find a compatible model for concurrent usage example
    const compatibleModels = modelStore.displayModels.filter(m => {
      return m.isDownloaded && isModelRAGCompatible(m).compatible;
    });
    
    if (compatibleModels.length > 0) {
      await this.concurrentModelUsage(compatibleModels[0].id);
    } else {
      console.log('No compatible models found for concurrent usage example');
    }
    
    console.log('\nAll examples completed!');
  }
}