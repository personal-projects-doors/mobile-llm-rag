# Vector Database Setup Guide

This guide explains how to set up and use the vector database integration in PocketPal.

## Quick Start

1. **Run the setup script:**
   ```bash
   yarn setup:vectors
   ```

2. **Use in your components:**
   ```tsx
   import { VectorSearchExample } from '../components/VectorSearchExample';
   
   // Or use the hook directly
   import { useVectorSearch } from '../hooks/useVectorSearch';
   ```

## What This Does

The setup process:
1. Creates a Python virtual environment
2. Installs required dependencies (PyPDF2, sentence-transformers, etc.)
3. Extracts text from your PDF (`pdfs/HY MSK_Anatomy.pdf`)
4. Generates embeddings using a lightweight transformer model
5. Exports vectors as JSON to `src/assets/vectors/anatomy_vectors.json`
6. Makes them available in your React Native app

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   PDF File      │───▶│  Python Script   │───▶│  JSON Vectors   │
│ (Anatomy.pdf)   │    │ (extract_vectors)│    │ (bundled asset) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ React Component │◀───│  useVectorSearch │◀───│  VectorService  │
│   (Your UI)     │    │     (Hook)       │    │   (Business)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Usage Examples

### Basic Search
```tsx
const { search, searchResults, isLoading } = useVectorSearch();

const handleSearch = async () => {
  const results = await search("muscle anatomy");
  console.log(results); // Array of SearchResult objects
};
```

### Get All Content
```tsx
const { getAllChunks } = useVectorSearch();

const chunks = await getAllChunks();
// Returns all text chunks from the PDF
```

### Page-Specific Search
```tsx
const { getChunksByPage } = useVectorSearch();

const pageContent = await getChunksByPage(5);
// Returns only chunks from page 5
```

## File Structure

```
src/
├── assets/vectors/
│   └── anatomy_vectors.json     # Generated vector data
├── services/
│   └── VectorService.ts         # Core vector operations
├── hooks/
│   └── useVectorSearch.ts       # React hook
└── components/
    └── VectorSearchExample.tsx  # Example component

scripts/
├── extract_vectors.py           # Python extraction script
├── requirements.txt             # Python dependencies
└── setup_vectors.sh            # Setup automation
```

## Customization

### Adding More PDFs
1. Place PDFs in the `pdfs/` folder
2. Update `extract_vectors.py` to process multiple files
3. Re-run `yarn setup:vectors`

### Different Embedding Models
Edit `extract_vectors.py` and change the model:
```python
# Lightweight (current): 'all-MiniLM-L6-v2'
# Better quality: 'all-mpnet-base-v2'
# Multilingual: 'paraphrase-multilingual-MiniLM-L12-v2'
```

### Custom Text Chunking
Modify the `extract_text_from_pdf` function to change how text is split into chunks.

## Performance Notes

- Vectors are cached in AsyncStorage after first load
- Initial load extracts ~384-dimensional embeddings
- Search is performed client-side (no network required)
- Suitable for documents up to ~1000 pages

## Troubleshooting

### Python Issues
```bash
# If setup fails, try manual installation:
python3 -m venv scripts/venv
source scripts/venv/bin/activate
pip install -r scripts/requirements.txt
python3 scripts/extract_vectors.py
```

### Large Files
If your PDF is very large, consider:
1. Splitting into smaller chunks
2. Using a more efficient embedding model
3. Implementing pagination in the search results

### Memory Issues
The current implementation loads all vectors into memory. For very large datasets, consider:
1. Using SQLite with vector extensions
2. Implementing lazy loading
3. Using a more efficient storage format (binary instead of JSON)