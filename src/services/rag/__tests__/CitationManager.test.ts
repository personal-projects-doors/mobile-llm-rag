import {CitationManager} from '../CitationManager';
import {SearchResult} from '../types';
import {MessageType} from '../../../utils/types';

describe('CitationManager', () => {
  let citationManager: CitationManager;

  beforeEach(() => {
    citationManager = new CitationManager();
  });

  afterEach(() => {
    citationManager.clearCache();
  });

  const mockSearchResults: SearchResult[] = [
    {
      chunkId: 'chunk1',
      documentId: 'doc1',
      documentName: 'Medical Anatomy.pdf',
      text: 'The heart is a muscular organ that pumps blood throughout the body.',
      pageNumber: 15,
      chunkIndex: 0,
      similarity: 0.95,
      startChar: 100,
      endChar: 168,
      tokenCount: 12,
    },
    {
      chunkId: 'chunk2',
      documentId: 'doc1',
      documentName: 'Medical Anatomy.pdf',
      text: 'Blood vessels include arteries, veins, and capillaries.',
      pageNumber: 16,
      chunkIndex: 1,
      similarity: 0.87,
      startChar: 200,
      endChar: 252,
      tokenCount: 8,
    },
    {
      chunkId: 'chunk3',
      documentId: 'doc2',
      documentName: 'Physiology Guide.pdf',
      text: 'The cardiovascular system consists of the heart and blood vessels.',
      pageNumber: 5,
      chunkIndex: 0,
      similarity: 0.92,
      startChar: 50,
      endChar: 115,
      tokenCount: 10,
    },
  ];

  describe('createCitations', () => {
    it('should convert search results to citations', () => {
      const citations = citationManager.createCitations(mockSearchResults);

      expect(citations).toHaveLength(3);
      expect(citations[0]).toEqual({
        documentId: 'doc1',
        documentName: 'Medical Anatomy.pdf',
        pageNumber: 15,
        chunkText: 'The heart is a muscular organ that pumps blood throughout the body.',
        similarity: 0.95,
        startChar: 100,
        endChar: 168,
      });
    });

    it('should cache citation contexts', () => {
      const citations = citationManager.createCitations(mockSearchResults);
      const context = citationManager.getCitationContext(citations[0]);

      expect(context).toBeTruthy();
      expect(context?.documentId).toBe('doc1');
      expect(context?.chunkIndex).toBe(0);
    });
  });

  describe('groupCitationsByDocument', () => {
    it('should group citations by document', () => {
      const citations = citationManager.createCitations(mockSearchResults);
      const groups = citationManager.groupCitationsByDocument(citations);

      expect(groups).toHaveLength(2);
      expect(groups[0].documentId).toBe('doc1');
      expect(groups[0].citations).toHaveLength(2);
      expect(groups[1].documentId).toBe('doc2');
      expect(groups[1].citations).toHaveLength(1);
    });

    it('should sort groups by reference count', () => {
      const citations = citationManager.createCitations(mockSearchResults);
      const groups = citationManager.groupCitationsByDocument(citations);

      expect(groups[0].totalReferences).toBeGreaterThan(groups[1].totalReferences);
    });
  });

  describe('getCitationStats', () => {
    it('should calculate citation statistics', () => {
      const citations = citationManager.createCitations(mockSearchResults);
      const stats = citationManager.getCitationStats(citations);

      expect(stats.totalCitations).toBe(3);
      expect(stats.uniqueDocuments).toBe(2);
      expect(stats.averageSimilarity).toBeCloseTo(0.913, 2);
      expect(stats.citationsByDocument).toHaveLength(2);
    });
  });

  describe('formatInlineCitations', () => {
    it('should format citations for inline display', () => {
      const citations = citationManager.createCitations(mockSearchResults);
      const formatted = citationManager.formatInlineCitations(citations);

      expect(formatted).toContain('Sources:');
      expect(formatted).toContain('[1] Medical Anatomy.pdf');
      expect(formatted).toContain('[2] Physiology Guide.pdf');
    });

    it('should return empty string for no citations', () => {
      const formatted = citationManager.formatInlineCitations([]);
      expect(formatted).toBe('');
    });
  });

  describe('formatDetailedCitations', () => {
    it('should format detailed citations', () => {
      const citations = citationManager.createCitations(mockSearchResults);
      const formatted = citationManager.formatDetailedCitations(citations);

      expect(formatted).toContain('Sources:');
      expect(formatted).toContain('Medical Anatomy.pdf, Pages 15, 16');
      expect(formatted).toContain('Physiology Guide.pdf, Page 5');
      expect(formatted).toContain('relevance');
    });
  });

  describe('validateCitation', () => {
    it('should validate correct citations', () => {
      const citation: MessageType.RAGCitation = {
        documentId: 'doc1',
        documentName: 'Test.pdf',
        pageNumber: 1,
        chunkText: 'Test content',
        similarity: 0.8,
        startChar: 0,
        endChar: 12,
      };

      expect(citationManager.validateCitation(citation)).toBe(true);
    });

    it('should reject invalid citations', () => {
      const invalidCitation: MessageType.RAGCitation = {
        documentId: '',
        documentName: 'Test.pdf',
        pageNumber: 0,
        chunkText: '',
        similarity: 1.5,
        startChar: 10,
        endChar: 5,
      };

      expect(citationManager.validateCitation(invalidCitation)).toBe(false);
    });
  });

  describe('deduplicateCitations', () => {
    it('should remove duplicate citations', () => {
      const duplicateResults: SearchResult[] = [
        ...mockSearchResults,
        {
          ...mockSearchResults[0],
          chunkId: 'chunk1-duplicate',
          text: 'The heart is a muscular organ that pumps blood through the body.',
          similarity: 0.93,
        },
      ];

      const citations = citationManager.createCitations(duplicateResults);
      const deduplicated = citationManager.deduplicateCitations(citations, 0.8);

      expect(deduplicated).toHaveLength(3); // Should remove the duplicate
    });

    it('should keep citations with low similarity', () => {
      const citations = citationManager.createCitations(mockSearchResults);
      const deduplicated = citationManager.deduplicateCitations(citations, 0.9);

      expect(deduplicated).toHaveLength(3); // Should keep all as they're different enough
    });
  });

  describe('clearCache', () => {
    it('should clear citation cache', () => {
      const citations = citationManager.createCitations(mockSearchResults);
      let context = citationManager.getCitationContext(citations[0]);
      expect(context).toBeTruthy();

      citationManager.clearCache();
      context = citationManager.getCitationContext(citations[0]);
      expect(context).toBeNull();
    });
  });
});