import { vectorService } from '../VectorService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock the vector data
jest.mock('../../assets/vectors/anatomy_vectors.json', () => ({
  metadata: {
    total_chunks: 2,
    embedding_model: 'test-model',
    embedding_dim: 3,
    created_at: '2023-01-01',
  },
  vectors: [
    {
      id: 'test_1',
      text: 'This is about muscle anatomy',
      page: 1,
      source: 'test.pdf',
      embedding: [0.1, 0.2, 0.3],
      embedding_dim: 3,
    },
    {
      id: 'test_2',
      text: 'This discusses bone structure',
      page: 2,
      source: 'test.pdf',
      embedding: [0.4, 0.5, 0.6],
      embedding_dim: 3,
    },
  ],
}));

describe('VectorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should load vectors successfully', async () => {
    await vectorService.loadVectors();
    const chunks = await vectorService.getAllChunks();
    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toBe('This is about muscle anatomy');
  });

  it('should search by text', async () => {
    const results = await vectorService.searchByText('muscle', 1);
    expect(results).toHaveLength(1);
    expect(results[0].chunk.text).toContain('muscle');
    expect(results[0].similarity).toBeGreaterThan(0);
  });

  it('should filter chunks by page', async () => {
    const pageChunks = await vectorService.getChunksByPage(1);
    expect(pageChunks).toHaveLength(1);
    expect(pageChunks[0].page).toBe(1);
  });
});