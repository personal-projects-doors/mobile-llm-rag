import { vectorService, SearchResult as VectorSearchResult } from './VectorService';
import { LlamaContext } from '@pocketpalai/llama.rn';
import { modelStore } from '../store';

export interface AnatomyQAResult {
    answer: string;
    sources: VectorSearchResult[];
    confidence: number;
    processingTime: number;
}

export interface AnatomyQAOptions {
    maxSources?: number;
    minSimilarity?: number;
    includePageNumbers?: boolean;
    contextWindow?: number;
}

class AnatomyRAGService {
    private isInitialized = false;

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // Ensure vector service is loaded
            await vectorService.loadVectors();
            
            // Check if we need to activate a model
            await this.ensureModelReady();
            
            this.isInitialized = true;
            console.log('AnatomyRAGService initialized successfully');
        } catch (error) {
            console.error('Failed to initialize AnatomyRAGService:', error);
            throw new Error('Could not initialize anatomy Q&A system');
        }
    }

    private async ensureModelReady(): Promise<void> {
        // If we already have a context (chat model loaded), use it directly
        if (modelStore.context && modelStore.activeModelId) {
            const activeModel = modelStore.models.find(m => m.id === modelStore.activeModelId);
            console.log('✅ Using already loaded chat model for Q&A:', activeModel?.name || modelStore.activeModelId);
            return;
        }

        console.log('⚠️ No chat model currently loaded, attempting to load a model...');

        // Prioritize the IQ4_NL model that's working for embeddings
        const iq4nlModel = modelStore.models.find(m => 
            m.filename?.includes('IQ4_NL') || 
            m.name.includes('IQ4_NL') ||
            m.id.includes('IQ4_NL')
        );

        // Fallback to any medgemma model
        const medgemmaModel = modelStore.models.find(m => 
            m.name.toLowerCase().includes('medgemma') || 
            m.id.toLowerCase().includes('medgemma')
        );

        const anyModel = modelStore.models.find(m => m.isDownloaded);

        // Prioritize IQ4_NL model since it's working for embeddings
        const modelToTry = iq4nlModel || medgemmaModel || anyModel;

        if (modelToTry) {
            console.log('Found model for Q&A:', modelToTry.name);
            try {
                await modelStore.initContext(modelToTry);
                console.log('Successfully activated model for Q&A:', modelToTry.name);
            } catch (error) {
                console.warn('Could not activate model for Q&A:', error);
                // Don't throw here, let the generateAnswer method handle the fallback
            }
        } else {
            console.log('💡 No suitable model found, Q&A will use fallback mode');
        }
    }

    async askQuestion(
        question: string,
        options: AnatomyQAOptions = {}
    ): Promise<AnatomyQAResult> {
        const startTime = Date.now();

        await this.initialize();

        const {
            maxSources = 5,
            minSimilarity = 0.3,
            includePageNumbers = true,
            contextWindow = 2000
        } = options;

        try {
            // 1. Retrieve relevant context from anatomy vectors
            const searchResults = await vectorService.searchByText(question, maxSources);

            // Filter by similarity threshold
            const relevantSources = searchResults.filter(
                result => result.similarity >= minSimilarity
            );

            if (relevantSources.length === 0) {
                return {
                    answer: "I couldn't find relevant information in the anatomy content to answer your question. Please try rephrasing your question or asking about specific anatomical structures.",
                    sources: [],
                    confidence: 0,
                    processingTime: Date.now() - startTime
                };
            }

            // 2. Prepare context for the LLM
            const context = this.prepareContext(relevantSources, contextWindow, includePageNumbers);

            // 3. Generate answer using LLaMA
            const answer = await this.generateAnswer(question, context);

            // 4. Calculate confidence based on source quality
            const confidence = this.calculateConfidence(relevantSources);

            return {
                answer,
                sources: relevantSources,
                confidence,
                processingTime: Date.now() - startTime
            };

        } catch (error) {
            console.error('Error in anatomy Q&A:', error);
            throw new Error('Failed to process anatomy question');
        }
    }

    private prepareContext(
        sources: VectorSearchResult[],
        maxTokens: number,
        includePageNumbers: boolean
    ): string {
        let context = '';
        let currentLength = 0;

        for (const source of sources) {
            const pageInfo = includePageNumbers ? ` (Page ${source.chunk.page})` : '';
            const sourceText = `${source.chunk.text}${pageInfo}\n\n`;

            // Rough token estimation (1 token ≈ 4 characters)
            const estimatedTokens = sourceText.length / 4;

            if (currentLength + estimatedTokens > maxTokens) {
                break;
            }

            context += sourceText;
            currentLength += estimatedTokens;
        }

        return context.trim();
    }

    private async generateAnswer(question: string, context: string): Promise<string> {
        try {
            // Check if we have a context (model loaded)
            if (!modelStore.context) {
                return this.generateFallbackAnswer(question, context);
            }

            const prompt = this.buildPrompt(question, context);

            // Generate response using the LLaMA context
            const response = await modelStore.context.completion({
                prompt,
                n_predict: 512,
                temperature: 0.3,
                top_p: 0.9,
                top_k: 40,
                stop: ['Human:', 'Question:', '\n\n---', 'QUESTION:', 'ANATOMY CONTENT:']
            });

            return this.cleanResponse(response.text);

        } catch (error) {
            console.error('Error generating answer:', error);
            
            // Fall back to context-based answer if model fails
            return this.generateFallbackAnswer(question, context);
        }
    }

    private generateFallbackAnswer(question: string, context: string): string {
        // If no model is available, provide a context-based response
        if (!context || context.trim().length === 0) {
            return "I couldn't find relevant information in the anatomy content to answer your question. Please try rephrasing your question or asking about specific anatomical structures mentioned in the textbook.";
        }

        // Extract the most relevant sentences from context
        const sentences = context.split(/[.!?]+/).filter(s => s.trim().length > 20);
        const relevantSentences = sentences.slice(0, 3); // Take first 3 relevant sentences

        let answer = "Based on the anatomy content, here's what I found:\n\n";
        answer += relevantSentences.join('. ').trim();
        
        if (!answer.endsWith('.')) {
            answer += '.';
        }

        answer += "\n\n(Note: AI model unavailable - showing direct content from textbook. Please load a model in Settings for enhanced answers.)";

        return answer;
    }

    private buildPrompt(question: string, context: string): string {
        return `You are an expert anatomy assistant. Answer the following question based ONLY on the provided anatomy content. Be accurate, concise, and cite page numbers when available.

ANATOMY CONTENT:
${context}

QUESTION: ${question}

INSTRUCTIONS:
- Answer based only on the provided content
- Be specific and accurate
- Include page references when mentioned
- If the content doesn't contain enough information, say so
- Keep the answer focused and educational

ANSWER:`;
    }

    private cleanResponse(response: string): string {
        // Remove any prompt artifacts or unwanted text
        let cleaned = response.trim();

        // Remove common artifacts
        cleaned = cleaned.replace(/^(ANSWER:|Answer:)/i, '').trim();
        cleaned = cleaned.replace(/Human:|Question:|---.*$/g, '').trim();

        // Ensure proper sentence ending
        if (cleaned && !cleaned.match(/[.!?]$/)) {
            cleaned += '.';
        }

        return cleaned;
    }

    private calculateConfidence(sources: VectorSearchResult[]): number {
        if (sources.length === 0) return 0;

        // Calculate confidence based on:
        // 1. Number of sources
        // 2. Average similarity
        // 3. Similarity distribution

        const similarities = sources.map(s => s.similarity);
        const avgSimilarity = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
        const maxSimilarity = Math.max(...similarities);

        // Base confidence from average similarity
        let confidence = avgSimilarity;

        // Boost for multiple high-quality sources
        if (sources.length >= 3 && avgSimilarity > 0.7) {
            confidence = Math.min(confidence * 1.2, 1.0);
        }

        // Boost for very high max similarity
        if (maxSimilarity > 0.9) {
            confidence = Math.min(confidence * 1.1, 1.0);
        }

        return Math.round(confidence * 100) / 100; // Round to 2 decimal places
    }

    async getRelatedTopics(topic: string, limit: number = 5): Promise<VectorSearchResult[]> {
        await this.initialize();
        return vectorService.searchByText(topic, limit);
    }

    async getContentByPage(page: number): Promise<any[]> {
        await this.initialize();
        return vectorService.getChunksByPage(page);
    }

    async isReady(): Promise<boolean> {
        try {
            await this.initialize();
            
            // The service is ready if vectors are loaded (even without a model)
            // We can provide fallback answers using just the retrieved context
            return this.isInitialized;
        } catch {
            return false;
        }
    }

    // Predefined anatomy questions for quick access
    getSuggestedQuestions(): string[] {
        return [
            "What are the main muscles of the quadriceps?",
            "Describe the structure of the hip joint",
            "What bones make up the shoulder girdle?",
            "How does the knee joint function?",
            "What are the layers of muscle in the abdominal wall?",
            "Describe the anatomy of the spine",
            "What nerves innervate the arm muscles?",
            "How is the ankle joint structured?",
            "What are the rotator cuff muscles?",
            "Describe the pelvic floor anatomy"
        ];
    }

    // Get anatomy systems for categorized browsing
    getAnatomySystems(): { name: string; keywords: string[] }[] {
        return [
            {
                name: "Musculoskeletal System",
                keywords: ["muscle", "bone", "joint", "ligament", "tendon", "cartilage"]
            },
            {
                name: "Nervous System",
                keywords: ["nerve", "brain", "spinal", "neuron", "reflex"]
            },
            {
                name: "Cardiovascular System",
                keywords: ["heart", "blood", "vessel", "artery", "vein", "circulation"]
            },
            {
                name: "Respiratory System",
                keywords: ["lung", "breathing", "airway", "diaphragm", "oxygen"]
            },
            {
                name: "Digestive System",
                keywords: ["stomach", "intestine", "liver", "digestion", "absorption"]
            }
        ];
    }
}

export const anatomyRAGService = new AnatomyRAGService();