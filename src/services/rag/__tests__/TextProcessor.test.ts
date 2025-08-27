import { TextProcessor } from '../TextProcessor';
import { TextCleaningOptions } from '../types';

describe('TextProcessor', () => {
  describe('cleanText', () => {
    it('should remove extra whitespace by default', () => {
      const input = 'This  has   multiple    spaces\n\n\n\nand   line   breaks';
      const result = TextProcessor.cleanText(input);
      
      expect(result.cleanedText).toBe('This has multiple spaces\n\nand line breaks');
      expect(result.originalLength).toBe(input.length);
      expect(result.cleanedLength).toBeLessThan(result.originalLength);
    });

    it('should normalize line breaks', () => {
      const input = 'Line 1\r\nLine 2\rLine 3\nLine 4';
      const result = TextProcessor.cleanText(input);
      
      expect(result.cleanedText).toBe('Line 1\nLine 2\nLine 3\nLine 4');
    });

    it('should preserve formatting when requested', () => {
      const input = '• Bullet point 1\n1. Numbered item\nCHAPTER 1: INTRODUCTION';
      const options: Partial<TextCleaningOptions> = {
        preserveFormatting: true,
      };
      const result = TextProcessor.cleanText(input, options);
      
      expect(result.cleanedText).toContain('• Bullet point 1');
      expect(result.cleanedText).toContain('1. Numbered item');
    });

    it('should remove special characters when requested', () => {
      const input = 'Text with @#$% special chars!';
      const options: Partial<TextCleaningOptions> = {
        removeSpecialCharacters: true,
      };
      const result = TextProcessor.cleanText(input, options);
      
      expect(result.cleanedText).toMatch(/^[a-zA-Z0-9\s.,;:!?'"()\-\[\]{}]+$/);
    });

    it('should handle empty input', () => {
      const result = TextProcessor.cleanText('');
      
      expect(result.cleanedText).toBe('');
      expect(result.originalLength).toBe(0);
      expect(result.cleanedLength).toBe(0);
      expect(result.removedCharacters).toBe(0);
    });

    it('should trim whitespace from lines', () => {
      const input = '  Line with leading spaces  \n  Another line  ';
      const result = TextProcessor.cleanText(input);
      
      expect(result.cleanedText).toBe('Line with leading spaces\nAnother line');
    });
  });

  describe('extractTextMetadata', () => {
    it('should identify headers correctly', () => {
      const input = `INTRODUCTION
      
This is some content under the introduction.

CHAPTER 1: GETTING STARTED

More content here.

1. First Section

Content for first section.`;

      const metadata = TextProcessor.extractTextMetadata(input);
      
      expect(metadata.headers).toContain('INTRODUCTION');
      expect(metadata.headers).toContain('CHAPTER 1: GETTING STARTED');
      expect(metadata.headers).toContain('1. First Section');
      expect(metadata.sections).toHaveLength(3);
    });

    it('should count words and characters correctly', () => {
      const input = 'This is a test with five words.';
      const metadata = TextProcessor.extractTextMetadata(input);
      
      expect(metadata.wordCount).toBe(7); // "This", "is", "a", "test", "with", "five", "words."
      expect(metadata.characterCount).toBe(input.length);
    });

    it('should handle empty text', () => {
      const metadata = TextProcessor.extractTextMetadata('');
      
      expect(metadata.headers).toHaveLength(0);
      expect(metadata.sections).toHaveLength(0);
      expect(metadata.wordCount).toBe(0);
      expect(metadata.characterCount).toBe(0);
    });
  });

  describe('validateText', () => {
    it('should validate normal text as valid', () => {
      const text = 'This is a normal piece of text with reasonable content.';
      const validation = TextProcessor.validateText(text);
      
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should identify empty text as invalid', () => {
      const validation = TextProcessor.validateText('');
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Text is empty');
    });

    it('should identify very short text as invalid', () => {
      const validation = TextProcessor.validateText('Hi');
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Text is too short (less than 10 characters)');
    });

    it('should identify text with excessive special characters', () => {
      const text = '###@@@$$$%%%^^^&&&***!!!';
      const validation = TextProcessor.validateText(text);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Text contains excessive special characters (possible OCR issues)');
    });

    it('should identify text with unusually long words', () => {
      const text = 'Thisisanunusuallylongwordthatmightindicateformattingissues';
      const validation = TextProcessor.validateText(text);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Average word length is unusually high (possible formatting issues)');
    });
  });

  describe('isLikelyHeader (private method behavior)', () => {
    it('should identify all caps text as headers through cleanText', () => {
      const input = 'INTRODUCTION\n\nThis is regular content.\n\nCONCLUSION';
      const metadata = TextProcessor.extractTextMetadata(input);
      
      expect(metadata.headers).toContain('INTRODUCTION');
      expect(metadata.headers).toContain('CONCLUSION');
    });

    it('should identify numbered sections as headers', () => {
      const input = '1. First Section\n\nContent here.\n\n2. Second Section';
      const metadata = TextProcessor.extractTextMetadata(input);
      
      expect(metadata.headers).toContain('1. First Section');
      expect(metadata.headers).toContain('2. Second Section');
    });

    it('should identify common header patterns', () => {
      const input = 'Chapter 1: Introduction\n\nContent.\n\nAppendix A: References';
      const metadata = TextProcessor.extractTextMetadata(input);
      
      expect(metadata.headers).toContain('Chapter 1: Introduction');
      expect(metadata.headers).toContain('Appendix A: References');
    });
  });
});