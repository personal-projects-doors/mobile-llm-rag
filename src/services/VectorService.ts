import AsyncStorage from '@react-native-async-storage/async-storage';

export interface VectorChunk {
    id: string;
    text: string;
    page: number;
    source: string;
    embedding: number[];
    embedding_dim: number;
}

export interface VectorData {
    metadata: {
        total_chunks: number;
        embedding_model: string;
        embedding_dim: number;
        created_at: string;
    };
    vectors: VectorChunk[];
}

export interface SearchResult {
    chunk: VectorChunk;
    similarity: number;
}

class VectorService {
    private vectors: VectorChunk[] = [];
    private isLoaded = false;
    private readonly STORAGE_KEY = 'anatomy_vectors';

    async loadVectors(): Promise<void> {
        if (this.isLoaded) return;

        try {
            // Try to load from AsyncStorage first (cached)
            const cached = await AsyncStorage.getItem(this.STORAGE_KEY);
            if (cached) {
                const data: VectorData = JSON.parse(cached);
                this.vectors = data.vectors;
                this.isLoaded = true;
                console.log(`Loaded ${this.vectors.length} vectors from cache`);
                return;
            }

            // Load from bundled asset
            const vectorData = require('../assets/vectors/anatomy_vectors.json') as VectorData;
            this.vectors = vectorData.vectors;

            // Cache for future use
            await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(vectorData));

            this.isLoaded = true;
            console.log(`Loaded ${this.vectors.length} vectors from bundle`);
        } catch (error) {
            console.error('Failed to load vectors:', error);
            throw new Error('Could not load vector database');
        }
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error('Vectors must have the same length');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    async search(queryEmbedding: number[], topK: number = 5): Promise<SearchResult[]> {
        await this.loadVectors();

        const results: SearchResult[] = [];

        for (const chunk of this.vectors) {
            const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
            results.push({ chunk, similarity });
        }

        // Sort by similarity (highest first) and return top K
        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
    }

    async searchByText(query: string, topK: number = 5): Promise<SearchResult[]> {
        await this.loadVectors();

        // Simple text-based search as fallback
        const results: SearchResult[] = [];
        const queryLower = query.toLowerCase();

        for (const chunk of this.vectors) {
            const textLower = chunk.text.toLowerCase();
            let similarity = 0;

            // Simple keyword matching
            const queryWords = queryLower.split(' ');
            const textWords = textLower.split(' ');

            for (const word of queryWords) {
                if (textWords.includes(word)) {
                    similarity += 1 / queryWords.length;
                }
            }

            if (similarity > 0) {
                results.push({ chunk, similarity });
            }
        }

        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
    }

    async getAllChunks(): Promise<VectorChunk[]> {
        await this.loadVectors();
        return this.vectors;
    }

    async getChunksByPage(page: number): Promise<VectorChunk[]> {
        await this.loadVectors();
        return this.vectors.filter(chunk => chunk.page === page);
    }

    async clearCache(): Promise<void> {
        await AsyncStorage.removeItem(this.STORAGE_KEY);
        this.isLoaded = false;
        this.vectors = [];
    }
}

export const vectorService = new VectorService();