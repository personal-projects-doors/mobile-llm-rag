import {Model, ModelOrigin} from './types';
import {modelStore} from '../store';

/**
 * MedGemma model configuration for RAG embeddings
 */
export const MEDGEMMA_MODEL_CONFIG = {
  id: 'unsloth/medgemma-4b-it-GGUF/medgemma-4b-it-IQ4_NL.gguf',
  expectedSize: 2400000000, // ~2.4GB
  requiredCapabilities: ['questionAnswering'],
  embeddingDimensions: 4096,
  maxTokens: 512,
  batchSize: 5, // Conservative for mobile devices
};

/**
 * Check if the MedGemma model is available in the model store
 */
export function isMedGemmaModelAvailable(): boolean {
  const model = modelStore.models.find(m => m.id === MEDGEMMA_MODEL_CONFIG.id);
  return model ? model.isDownloaded : false;
}

/**
 * Get the MedGemma model from the model store
 */
export function getMedGemmaModel(): Model | null {
  return modelStore.models.find(m => m.id === MEDGEMMA_MODEL_CONFIG.id) || null;
}

/**
 * Check if the MedGemma model is properly configured
 */
export function validateMedGemmaModel(): {
  isValid: boolean;
  issues: string[];
  model: Model | null;
} {
  const model = getMedGemmaModel();
  const issues: string[] = [];

  if (!model) {
    return {
      isValid: false,
      issues: ['MedGemma model not found in model list'],
      model: null,
    };
  }

  // Check if model is downloaded
  if (!model.isDownloaded) {
    issues.push('MedGemma model is not downloaded');
  }

  // Check model size
  if (model.size && Math.abs(model.size - MEDGEMMA_MODEL_CONFIG.expectedSize) > 100000000) {
    issues.push(`Model size mismatch: expected ~${MEDGEMMA_MODEL_CONFIG.expectedSize}, got ${model.size}`);
  }

  // Check model origin
  if (model.origin !== ModelOrigin.PRESET) {
    issues.push('MedGemma model should be a preset model');
  }

  // Check download URL
  if (!model.downloadUrl || !model.downloadUrl.includes('medgemma-4b-it-IQ4_NL.gguf')) {
    issues.push('Invalid or missing download URL for MedGemma model');
  }

  return {
    isValid: issues.length === 0,
    issues,
    model,
  };
}

/**
 * Estimate memory requirements for concurrent model usage
 */
export function estimateRAGMemoryUsage(chatModel: Model): {
  embeddingModelMemory: number;
  chatModelMemory: number;
  totalMemory: number;
  isWithinLimits: boolean;
  recommendations: string[];
} {
  const embeddingModelMemory = MEDGEMMA_MODEL_CONFIG.expectedSize;
  const chatModelMemory = chatModel.size || 0;
  const totalMemory = embeddingModelMemory + chatModelMemory;
  
  // Conservative memory limits for mobile devices
  const memoryLimits = {
    concurrent: 6 * 1024 * 1024 * 1024, // 6GB for concurrent usage
    single: 4 * 1024 * 1024 * 1024, // 4GB for single model
  };

  const isWithinLimits = totalMemory <= memoryLimits.concurrent;
  const recommendations: string[] = [];

  if (!isWithinLimits) {
    recommendations.push('Consider using a smaller chat model for concurrent RAG usage');
    recommendations.push('Alternatively, disable concurrent model usage and use sequential loading');
    
    if (chatModelMemory > memoryLimits.single) {
      recommendations.push('Chat model alone exceeds recommended memory limits');
    }
    
    if (totalMemory > memoryLimits.concurrent * 1.5) {
      recommendations.push('Total memory usage significantly exceeds device capabilities');
    }
  }

  return {
    embeddingModelMemory,
    chatModelMemory,
    totalMemory,
    isWithinLimits,
    recommendations,
  };
}

/**
 * Get recommended models for RAG usage based on memory constraints
 */
export function getRecommendedRAGModels(): Model[] {
  return modelStore.displayModels.filter(model => {
    if (!model.isDownloaded) return false;
    
    const memoryEstimate = estimateRAGMemoryUsage(model);
    return memoryEstimate.isWithinLimits;
  }).sort((a, b) => {
    // Sort by size (smaller first for better performance)
    return (a.size || 0) - (b.size || 0);
  });
}

/**
 * Check if a specific model is compatible with RAG
 */
export function isModelRAGCompatible(model: Model): {
  compatible: boolean;
  reason?: string;
  memoryInfo: ReturnType<typeof estimateRAGMemoryUsage>;
} {
  if (!model.isDownloaded) {
    return {
      compatible: false,
      reason: 'Model is not downloaded',
      memoryInfo: estimateRAGMemoryUsage(model),
    };
  }

  const memoryInfo = estimateRAGMemoryUsage(model);
  
  if (!memoryInfo.isWithinLimits) {
    return {
      compatible: false,
      reason: 'Model size exceeds memory limits for concurrent RAG usage',
      memoryInfo,
    };
  }

  // Check if model has proper chat template (important for response generation)
  if (!model.chatTemplate && model.origin !== ModelOrigin.PRESET) {
    return {
      compatible: false,
      reason: 'Model lacks proper chat template configuration',
      memoryInfo,
    };
  }

  return {
    compatible: true,
    memoryInfo,
  };
}

/**
 * Format memory size for display
 */
export function formatMemorySize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(1)} GB`;
  }
  
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

/**
 * Get RAG model status summary
 */
export function getRAGModelStatusSummary(): {
  medgemmaAvailable: boolean;
  medgemmaDownloaded: boolean;
  compatibleModels: number;
  totalModels: number;
  memoryStatus: 'good' | 'warning' | 'critical';
  issues: string[];
} {
  const validation = validateMedGemmaModel();
  const compatibleModels = getRecommendedRAGModels();
  const totalModels = modelStore.displayModels.filter(m => m.isDownloaded).length;
  
  let memoryStatus: 'good' | 'warning' | 'critical' = 'good';
  const issues: string[] = [...validation.issues];

  if (compatibleModels.length === 0 && totalModels > 0) {
    memoryStatus = 'critical';
    issues.push('No downloaded models are compatible with RAG due to memory constraints');
  } else if (compatibleModels.length < totalModels * 0.5) {
    memoryStatus = 'warning';
    issues.push('Many downloaded models exceed memory limits for RAG usage');
  }

  return {
    medgemmaAvailable: validation.model !== null,
    medgemmaDownloaded: validation.model?.isDownloaded || false,
    compatibleModels: compatibleModels.length,
    totalModels,
    memoryStatus,
    issues,
  };
}