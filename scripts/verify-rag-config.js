#!/usr/bin/env node

/**
 * Script to verify RAG model configuration
 * Run with: node scripts/verify-rag-config.js
 */

const fs = require('fs');
const path = require('path');

const MODEL_ID = 'unsloth/medgemma-4b-it-GGUF/medgemma-4b-it-IQ4_NL.gguf';
const OLD_MODEL_ID = 'medgemma-4b-it-Q2_K_L';

console.log('🔍 Verifying RAG model configuration...\n');

// Files to check
const filesToCheck = [
  'src/store/RAGStore.ts',
  'src/services/rag/RAGModelManager.ts',
  'src/utils/ragModelUtils.ts',
  'src/store/defaultModels.ts',
  'src/hooks/useRAGChatSession.ts',
  'src/screens/ChatScreen/ChatScreen.tsx',
  'src/services/rag/RecoveryManager.ts',
  'src/services/rag/DatabaseIndexer.ts',
  'src/services/rag/PerformanceOptimizationExample.ts',
];

let hasOldReferences = false;
let hasNewReferences = false;

filesToCheck.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    const hasOld = content.includes(OLD_MODEL_ID);
    const hasNew = content.includes(MODEL_ID);
    
    if (hasOld) {
      console.log(`❌ ${filePath} still contains old model reference: ${OLD_MODEL_ID}`);
      hasOldReferences = true;
    }
    
    if (hasNew) {
      console.log(`✅ ${filePath} contains new model reference`);
      hasNewReferences = true;
    }
    
    if (!hasOld && !hasNew) {
      console.log(`ℹ️  ${filePath} doesn't contain model references`);
    }
  } else {
    console.log(`⚠️  ${filePath} not found`);
  }
});

console.log('\n📊 Summary:');
console.log(`New model references found: ${hasNewReferences ? '✅' : '❌'}`);
console.log(`Old model references remaining: ${hasOldReferences ? '❌' : '✅'}`);

if (!hasOldReferences && hasNewReferences) {
  console.log('\n🎉 RAG model configuration successfully updated!');
  console.log(`Model: ${MODEL_ID}`);
  console.log('URL: https://huggingface.co/unsloth/medgemma-4b-it-GGUF/resolve/main/medgemma-4b-it-IQ4_NL.gguf');
} else {
  console.log('\n⚠️  Configuration update incomplete. Please check the files above.');
}