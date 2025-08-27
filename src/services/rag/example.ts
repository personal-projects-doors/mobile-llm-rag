/**
 * Example usage of the RAG PDF processing services
 * 
 * This file demonstrates how to use the PDFProcessor and TextProcessor
 * classes to extract and clean text from PDF documents.
 */

import { PDFProcessor, TextProcessor } from './index';

export class RAGExample {
  /**
   * Example: Basic PDF text extraction
   */
  static async basicPDFExtraction(filePath: string) {
    console.log('Starting PDF text extraction...');
    
    // First, validate the PDF
    const isValid = await PDFProcessor.isValidPDF(filePath);
    if (!isValid) {
      console.error('Invalid PDF file');
      return;
    }

    // Get PDF information
    const info = await PDFProcessor.getPDFInfo(filePath);
    console.log('PDF Info:', info);

    // Extract text from the entire document
    const result = await PDFProcessor.extractText(filePath);
    
    if (result.success) {
      console.log('Text extracted successfully!');
      console.log('Page count:', result.pageCount);
      console.log('Text length:', result.text?.length);
      
      // Clean the extracted text
      const cleanedText = TextProcessor.cleanText(result.text!);
      console.log('Cleaned text length:', cleanedText.cleanedLength);
      console.log('Characters removed:', cleanedText.removedCharacters);
      
      return cleanedText.cleanedText;
    } else {
      console.error('Failed to extract text:', result.error);
    }
  }

  /**
   * Example: Extract text from specific pages with progress tracking
   */
  static async extractWithProgress(filePath: string, startPage: number, endPage: number) {
    console.log(`Extracting pages ${startPage}-${endPage} with progress tracking...`);
    
    const result = await PDFProcessor.extractTextWithProgress(
      filePath,
      { startPage, endPage },
      (progress, currentPage, totalPages) => {
        console.log(`Progress: ${progress.toFixed(1)}% (Page ${currentPage}/${totalPages})`);
      }
    );

    if (result.success) {
      console.log('Extraction completed!');
      
      // Analyze the extracted text
      const metadata = TextProcessor.extractTextMetadata(result.text!);
      console.log('Text analysis:');
      console.log('- Word count:', metadata.wordCount);
      console.log('- Character count:', metadata.characterCount);
      console.log('- Headers found:', metadata.headers.length);
      console.log('- Sections:', metadata.sections.length);
      
      return result.text;
    } else {
      console.error('Extraction failed:', result.error);
    }
  }

  /**
   * Example: Advanced text cleaning with custom options
   */
  static async advancedTextCleaning(filePath: string) {
    console.log('Performing advanced text cleaning...');
    
    const result = await PDFProcessor.extractText(filePath);
    
    if (result.success && result.text) {
      // Clean with custom options
      const cleanedText = TextProcessor.cleanText(result.text, {
        removeExtraWhitespace: true,
        normalizeLineBreaks: true,
        removeSpecialCharacters: false, // Keep special characters for medical text
        preserveFormatting: true, // Preserve formatting for better structure
      });

      // Validate the cleaned text
      const validation = TextProcessor.validateText(cleanedText.cleanedText);
      
      console.log('Cleaning results:');
      console.log('- Original length:', cleanedText.originalLength);
      console.log('- Cleaned length:', cleanedText.cleanedLength);
      console.log('- Reduction:', ((cleanedText.removedCharacters / cleanedText.originalLength) * 100).toFixed(1) + '%');
      console.log('- Validation passed:', validation.isValid);
      
      if (!validation.isValid) {
        console.warn('Validation issues:', validation.issues);
      }

      return cleanedText.cleanedText;
    }
  }

  /**
   * Example: Error handling and recovery
   */
  static async robustPDFProcessing(filePath: string) {
    try {
      // Check if file exists first
      const isValid = await PDFProcessor.isValidPDF(filePath);
      if (!isValid) {
        throw new Error('Invalid or corrupted PDF file');
      }

      // Get file info to check size
      const info = await PDFProcessor.getPDFInfo(filePath);
      if (!info.isValid) {
        throw new Error(info.error || 'Failed to read PDF info');
      }

      if (info.fileSizeMB && info.fileSizeMB > 50) {
        console.warn('Large PDF detected, processing in smaller chunks...');
        
        // Process in smaller page ranges for large files
        const pageCount = info.pageCount || 1;
        const chunkSize = 10; // Process 10 pages at a time
        let allText = '';

        for (let start = 1; start <= pageCount; start += chunkSize) {
          const end = Math.min(start + chunkSize - 1, pageCount);
          console.log(`Processing pages ${start}-${end}...`);
          
          const chunkResult = await PDFProcessor.extractText(filePath, {
            startPage: start,
            endPage: end,
          });

          if (chunkResult.success && chunkResult.text) {
            allText += chunkResult.text + '\n';
          } else {
            console.warn(`Failed to process pages ${start}-${end}:`, chunkResult.error);
          }
        }

        return allText;
      } else {
        // Process normally for smaller files
        const result = await PDFProcessor.extractText(filePath);
        return result.success ? result.text : null;
      }

    } catch (error) {
      console.error('PDF processing failed:', error);
      
      // Implement fallback strategies here
      // For example, try different PDF libraries or processing methods
      
      return null;
    }
  }
}

// Example usage (commented out to prevent execution during import)
/*
async function runExamples() {
  const pdfPath = 'pdfs/HY MSK_Anatomy.pdf';
  
  // Basic extraction
  await RAGExample.basicPDFExtraction(pdfPath);
  
  // Extract with progress (first 3 pages only)
  await RAGExample.extractWithProgress(pdfPath, 1, 3);
  
  // Advanced cleaning
  await RAGExample.advancedTextCleaning(pdfPath);
  
  // Robust processing
  await RAGExample.robustPDFProcessing(pdfPath);
}
*/