import { TextCleaningOptions, ProcessedText } from './types';

export class TextProcessor {
  private static readonly DEFAULT_OPTIONS: TextCleaningOptions = {
    removeExtraWhitespace: true,
    normalizeLineBreaks: true,
    removeSpecialCharacters: false,
    preserveFormatting: false,
  };

  /**
   * Clean and preprocess text extracted from PDF
   */
  static cleanText(
    text: string,
    options: Partial<TextCleaningOptions> = {}
  ): ProcessedText {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const originalLength = text.length;
    let cleanedText = text;

    // Normalize line breaks
    if (opts.normalizeLineBreaks) {
      cleanedText = cleanedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }

    // Remove extra whitespace
    if (opts.removeExtraWhitespace) {
      // Remove multiple spaces
      cleanedText = cleanedText.replace(/[ \t]+/g, ' ');
      
      // Remove multiple line breaks (keep max 2 consecutive)
      cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
      
      // Trim whitespace from each line
      cleanedText = cleanedText
        .split('\n')
        .map(line => line.trim())
        .join('\n');
    }

    // Remove special characters (but preserve basic punctuation)
    if (opts.removeSpecialCharacters) {
      // Keep letters, numbers, basic punctuation, and whitespace
      cleanedText = cleanedText.replace(/[^\w\s.,;:!?'"()\-\[\]{}]/g, '');
    }

    // Preserve formatting markers if requested
    if (opts.preserveFormatting) {
      // This would preserve things like bullet points, headers, etc.
      // For now, we'll keep basic formatting characters
      cleanedText = this.preserveBasicFormatting(cleanedText);
    }

    // Final cleanup
    cleanedText = cleanedText.trim();

    const cleanedLength = cleanedText.length;
    const removedCharacters = originalLength - cleanedLength;

    return {
      cleanedText,
      originalLength,
      cleanedLength,
      removedCharacters,
    };
  }

  /**
   * Preserve basic formatting like bullet points, headers, etc.
   */
  private static preserveBasicFormatting(text: string): string {
    // Preserve bullet points
    text = text.replace(/^[\s]*[•·▪▫‣⁃]\s*/gm, '• ');
    
    // Preserve numbered lists
    text = text.replace(/^[\s]*(\d+)[\.\)]\s*/gm, '$1. ');
    
    // Preserve basic headers (lines that are all caps or have specific patterns)
    text = text.replace(/^([A-Z\s]{3,})$/gm, '\n$1\n');
    
    return text;
  }

  /**
   * Extract metadata from text (like headers, sections, etc.)
   */
  static extractTextMetadata(text: string): {
    headers: string[];
    sections: Array<{ title: string; startIndex: number; endIndex: number }>;
    wordCount: number;
    characterCount: number;
  } {
    const headers: string[] = [];
    const sections: Array<{ title: string; startIndex: number; endIndex: number }> = [];
    
    // Find potential headers (lines that are short, capitalized, or have specific patterns)
    const lines = text.split('\n');
    let currentSectionStart = 0;
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (!trimmedLine) return;
      
      // Check if line looks like a header
      const isHeader = this.isLikelyHeader(trimmedLine);
      
      if (isHeader) {
        // Close previous section if exists
        if (headers.length > 0) {
          const previousHeaderIndex = headers.length - 1;
          const endIndex = text.indexOf(line);
          sections[previousHeaderIndex] = {
            ...sections[previousHeaderIndex],
            endIndex,
          };
        }
        
        headers.push(trimmedLine);
        
        // Start new section
        const startIndex = text.indexOf(line);
        sections.push({
          title: trimmedLine,
          startIndex,
          endIndex: text.length, // Will be updated when next header is found
        });
      }
    });

    // Count words and characters
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
    const characterCount = text.length;

    return {
      headers,
      sections,
      wordCount,
      characterCount,
    };
  }

  /**
   * Determine if a line is likely a header
   */
  private static isLikelyHeader(line: string): boolean {
    // Skip very long lines
    if (line.length > 100) return false;
    
    // Skip very short lines
    if (line.length < 3) return false;
    
    // Check for all caps (but not just numbers or special chars)
    const hasLetters = /[a-zA-Z]/.test(line);
    const isAllCaps = line === line.toUpperCase() && hasLetters;
    
    // Check for numbered sections
    const isNumberedSection = /^\d+[\.\s]/.test(line);
    
    // Check for common header patterns
    const hasHeaderPattern = /^(chapter|section|part|appendix|introduction|conclusion)/i.test(line);
    
    // Check if line ends without punctuation (except colon)
    const endsWithoutPunctuation = !/[.!?]$/.test(line) || /[:]\s*$/.test(line);
    
    return (isAllCaps || isNumberedSection || hasHeaderPattern) && endsWithoutPunctuation;
  }

  /**
   * Validate that text is suitable for processing
   */
  static validateText(text: string): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    if (!text || text.trim().length === 0) {
      issues.push('Text is empty');
    }
    
    if (text.length < 10) {
      issues.push('Text is too short (less than 10 characters)');
    }
    
    // Check for excessive special characters (might indicate OCR issues)
    const specialCharRatio = (text.match(/[^\w\s]/g) || []).length / text.length;
    if (specialCharRatio > 0.3) {
      issues.push('Text contains excessive special characters (possible OCR issues)');
    }
    
    // Check for reasonable word-to-character ratio
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const avgWordLength = text.length / words.length;
    if (avgWordLength > 20) {
      issues.push('Average word length is unusually high (possible formatting issues)');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}