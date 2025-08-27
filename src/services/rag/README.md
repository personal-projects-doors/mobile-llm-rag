# RAG PDF Processing Services

This directory contains the PDF processing and text extraction services for the RAG (Retrieval-Augmented Generation) system.

## Overview

The RAG services provide functionality to:
- Extract text from PDF documents
- Clean and preprocess extracted text
- Handle errors gracefully
- Provide progress tracking for long operations

## Components

### PDFProcessor

The main class for PDF processing operations.

**Key Features:**
- PDF validation and file checking
- Text extraction with page range support
- Progress tracking with callbacks
- Comprehensive error handling
- File size and memory management

**Current Implementation:**
The current implementation is a placeholder that demonstrates the interface and error handling patterns. In a production environment, you would need to integrate with a proper PDF processing library that works with React Native.

**Usage:**
```typescript
import { PDFProcessor } from './services/rag';

// Basic text extraction
const result = await PDFProcessor.extractText('/path/to/document.pdf');
if (result.success) {
  console.log('Extracted text:', result.text);
} else {
  console.error('Error:', result.error);
}

// Extract with progress tracking
const result = await PDFProcessor.extractTextWithProgress(
  '/path/to/document.pdf',
  { startPage: 1, endPage: 10 },
  (progress, currentPage, totalPages) => {
    console.log(`Progress: ${progress}% (Page ${currentPage}/${totalPages})`);
  }
);
```

### TextProcessor

Utility class for text cleaning and preprocessing.

**Key Features:**
- Text normalization and cleaning
- Header and section detection
- Text validation
- Metadata extraction

**Usage:**
```typescript
import { TextProcessor } from './services/rag';

// Clean extracted text
const cleaned = TextProcessor.cleanText(rawText, {
  removeExtraWhitespace: true,
  normalizeLineBreaks: true,
  preserveFormatting: true,
});

// Extract metadata
const metadata = TextProcessor.extractTextMetadata(text);
console.log('Headers found:', metadata.headers);
console.log('Word count:', metadata.wordCount);

// Validate text quality
const validation = TextProcessor.validateText(text);
if (!validation.isValid) {
  console.warn('Issues found:', validation.issues);
}
```

## Error Handling

The system includes comprehensive error handling with specific error codes:

- `FILE_NOT_FOUND`: PDF file doesn't exist
- `INVALID_PDF`: File is not a valid PDF
- `CORRUPTED_FILE`: PDF is corrupted or unreadable
- `PASSWORD_REQUIRED`: PDF is password protected
- `UNSUPPORTED_FORMAT`: Unsupported PDF version or format
- `PROCESSING_FAILED`: General processing failure
- `MEMORY_ERROR`: File too large or memory issues
- `PERMISSION_DENIED`: File access permission denied

## Testing

The services include comprehensive unit tests covering:
- Text extraction functionality
- Error handling scenarios
- Text cleaning and validation
- Progress tracking
- Edge cases and boundary conditions

Run tests with:
```bash
yarn test src/services/rag
```

## Integration Notes

### PDF Library Integration

The current implementation uses a placeholder for PDF processing. To integrate with a real PDF library:

1. **Choose a PDF Library**: Options include:
   - Native modules for iOS/Android
   - JavaScript-based parsers (with React Native compatibility)
   - Server-side processing services

2. **Update PDFProcessor**: Replace the placeholder implementation in `PDFProcessor.ts` with actual PDF parsing logic.

3. **Handle Platform Differences**: Ensure the chosen solution works on both iOS and Android.

### Performance Considerations

- **Memory Management**: Large PDFs can consume significant memory
- **Background Processing**: Consider using background tasks for large documents
- **Caching**: Implement caching for processed text to avoid re-processing
- **Chunking**: Process large documents in smaller chunks

### Security Considerations

- **File Validation**: Always validate PDF files before processing
- **Sandboxing**: Ensure PDF processing is sandboxed for security
- **Privacy**: All processing should happen on-device
- **Cleanup**: Properly clean up temporary files and memory

## Future Enhancements

1. **OCR Support**: Add optical character recognition for scanned PDFs
2. **Image Extraction**: Extract and process images from PDFs
3. **Table Processing**: Better handling of tables and structured data
4. **Metadata Extraction**: Enhanced PDF metadata extraction
5. **Format Support**: Support for additional document formats (DOCX, TXT, etc.)

## Requirements Mapping

This implementation addresses the following requirements from the RAG system specification:

- **Requirement 1.3**: PDF file import and processing
- **Requirement 5.1**: Efficient document processing without blocking UI
- **Error Handling**: Comprehensive error handling for corrupted or unsupported files
- **Progress Tracking**: User feedback during long processing operations
- **Text Quality**: Validation and cleaning of extracted text

## Dependencies

- `@dr.pogodin/react-native-fs`: File system operations
- React Native: Core platform functionality

## License

This code is part of the PocketPal AI project and follows the same licensing terms.