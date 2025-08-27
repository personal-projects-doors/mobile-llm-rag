# Requirements Document

## Introduction

This document outlines the requirements for building a Retrieval-Augmented Generation (RAG) system on top of the existing PocketPal AI application. The RAG system will enable users to chat with AI models that can reference and retrieve information from local PDF documents, specifically starting with the medical anatomy PDF in the pdfs folder. The system must work entirely on-device for iOS, maintaining the privacy-first approach of PocketPal AI while providing enhanced contextual responses through document retrieval.

## Requirements

### Requirement 1

**User Story:** As a user, I want to upload and manage PDF documents for RAG functionality, so that I can have AI conversations that reference specific document content.

#### Acceptance Criteria

1. WHEN a user accesses the RAG document management interface THEN the system SHALL display a list of available PDF documents
2. WHEN a user selects "Add Document" THEN the system SHALL allow importing PDF files from device storage
3. WHEN a PDF is successfully imported THEN the system SHALL process and index the document for retrieval
4. WHEN a user views the document list THEN the system SHALL show document name, size, processing status, and last modified date
5. WHEN a user selects a document THEN the system SHALL provide options to view, delete, or toggle its availability for RAG
6. IF a document processing fails THEN the system SHALL display an error message and allow retry

### Requirement 2

**User Story:** As a user, I want to enable RAG mode for my chat sessions, so that the AI can provide responses enhanced with relevant document content.

#### Acceptance Criteria

1. WHEN creating a new chat session THEN the system SHALL provide an option to enable RAG mode
2. WHEN RAG mode is enabled THEN the system SHALL allow selection of which documents to include in the knowledge base
3. WHEN RAG mode is active THEN the chat interface SHALL display a visual indicator showing RAG is enabled
4. WHEN switching between regular and RAG mode THEN the system SHALL preserve the current conversation context
5. WHEN no documents are available THEN the system SHALL disable the RAG mode option and show an informative message

### Requirement 3

**User Story:** As a user, I want the AI to retrieve and reference relevant document content in its responses, so that I get accurate, source-backed answers to my questions.

#### Acceptance Criteria

1. WHEN I send a message in RAG mode THEN the system SHALL search for relevant document chunks before generating a response
2. WHEN relevant content is found THEN the AI response SHALL incorporate the retrieved information naturally
3. WHEN the AI uses document content THEN the response SHALL include source citations showing which document and section was referenced
4. WHEN no relevant content is found THEN the AI SHALL respond normally without document references
5. WHEN multiple relevant chunks are found THEN the system SHALL rank them by relevance and use the most appropriate ones
6. IF retrieval fails THEN the system SHALL fall back to normal AI response generation

### Requirement 4

**User Story:** As a user, I want to see which document sections were used to generate AI responses, so that I can verify the information and explore the source material further.

#### Acceptance Criteria

1. WHEN an AI response includes document references THEN the system SHALL display expandable source citations
2. WHEN I tap on a source citation THEN the system SHALL show the relevant document excerpt with highlighting
3. WHEN viewing source excerpts THEN the system SHALL display the document name, page number, and surrounding context
4. WHEN multiple sources are cited THEN the system SHALL list them in order of relevance
5. WHEN I tap "View Full Document" THEN the system SHALL open the complete PDF for reading

### Requirement 5

**User Story:** As a developer, I want the RAG system to work efficiently on iOS devices using the medgemma-4b-it-Q2_K_L model, so that document processing and retrieval don't impact app performance or user experience.

#### Acceptance Criteria

1. WHEN processing large PDFs THEN the system SHALL chunk documents into manageable segments without blocking the UI
2. WHEN generating embeddings THEN the system SHALL use the medgemma-4b-it-Q2_K_L model for on-device processing to maintain privacy
3. WHEN performing similarity search THEN the system SHALL return results within 2 seconds for typical queries using the medgemma-4b-it-Q2_K_L model
4. WHEN the app is backgrounded during processing THEN the system SHALL pause and resume processing appropriately
5. WHEN device memory is low THEN the system SHALL optimize embedding storage and retrieval operations for the medgemma-4b-it-Q2_K_L model
6. IF processing takes longer than expected THEN the system SHALL show progress indicators and allow cancellation

### Requirement 6

**User Story:** As a user, I want my document data to remain private and secure, so that sensitive information never leaves my device.

#### Acceptance Criteria

1. WHEN documents are processed THEN all text extraction and embedding generation SHALL occur entirely on-device
2. WHEN embeddings are stored THEN they SHALL be saved in the local WatermelonDB database with encryption
3. WHEN performing retrieval THEN all similarity calculations SHALL happen locally without network requests
4. WHEN documents are deleted THEN all associated embeddings and metadata SHALL be completely removed from the device
5. WHEN the app is uninstalled THEN all document data and embeddings SHALL be automatically deleted

### Requirement 7

**User Story:** As a user, I want to configure RAG settings for optimal performance, so that I can balance response quality with processing speed based on my needs.

#### Acceptance Criteria

1. WHEN accessing RAG settings THEN the system SHALL provide options for chunk size, overlap, and retrieval count
2. WHEN adjusting chunk size THEN the system SHALL show the impact on processing time and memory usage
3. WHEN changing retrieval count THEN the system SHALL allow selection of how many document chunks to include in responses
4. WHEN enabling similarity threshold THEN the system SHALL allow setting minimum relevance scores for retrieved content
5. WHEN settings are changed THEN the system SHALL apply them to new conversations without affecting existing ones