#!/usr/bin/env python3
"""
Extract vectors from PDF and export for React Native app
"""
import json
import os
import sys
from pathlib import Path
from typing import List, Dict, Any
import datetime

try:
    import PyPDF2
except ImportError:
    print("PyPDF2 not found. Installing...")
    os.system(f"{sys.executable} -m pip install PyPDF2")
    import PyPDF2

try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
except ImportError:
    print("sentence-transformers not found. Installing...")
    os.system(f"{sys.executable} -m pip install sentence-transformers numpy torch")
    from sentence_transformers import SentenceTransformer
    import numpy as np

def extract_text_from_pdf(pdf_path: str) -> List[Dict]:
    """Extract text chunks from PDF"""
    chunks = []
    
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            
            print(f"Processing {len(pdf_reader.pages)} pages...")
            
            for page_num, page in enumerate(pdf_reader.pages):
                try:
                    text = page.extract_text()
                    if text.strip():
                        # Split into smaller chunks (sentences/paragraphs)
                        # Split by periods, but also by newlines for better chunking
                        sentences = []
                        
                        # First split by newlines to preserve paragraph structure
                        paragraphs = text.split('\n')
                        for paragraph in paragraphs:
                            if len(paragraph.strip()) > 50:  # Only process substantial paragraphs
                                # Then split by sentences within paragraphs
                                para_sentences = paragraph.split('.')
                                for sentence in para_sentences:
                                    sentence = sentence.strip()
                                    if len(sentence) > 30:  # Filter out very short chunks
                                        sentences.append(sentence)
                        
                        # Create chunks from sentences
                        for i, sentence in enumerate(sentences):
                            chunks.append({
                                'id': f"page_{page_num + 1}_chunk_{i + 1}",
                                'text': sentence,
                                'page': page_num + 1,
                                'source': os.path.basename(pdf_path)
                            })
                            
                except Exception as e:
                    print(f"Error processing page {page_num + 1}: {e}")
                    continue
                    
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return []
    
    return chunks

def create_embeddings(chunks: List[Dict], model_name: str = 'all-MiniLM-L6-v2') -> List[Dict]:
    """Create embeddings for text chunks"""
    print(f"Loading model: {model_name}")
    model = SentenceTransformer(model_name)
    
    texts = [chunk['text'] for chunk in chunks]
    print(f"Creating embeddings for {len(texts)} chunks...")
    
    embeddings = model.encode(texts, convert_to_numpy=True)
    
    # Combine chunks with their embeddings
    vector_data = []
    for i, chunk in enumerate(chunks):
        vector_data.append({
            'id': chunk['id'],
            'text': chunk['text'],
            'page': chunk['page'],
            'source': chunk['source'],
            'embedding': embeddings[i].tolist(),  # Convert numpy to list for JSON
            'embedding_dim': len(embeddings[i])
        })
    
    return vector_data

def export_vectors(vector_data: List[Dict], output_path: str):
    """Export vectors to JSON format"""
    export_data = {
        'metadata': {
            'total_chunks': len(vector_data),
            'embedding_model': 'all-MiniLM-L6-v2',
            'embedding_dim': vector_data[0]['embedding_dim'] if vector_data else 0,
            'created_at': str(datetime.datetime.now())
        },
        'vectors': vector_data
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(export_data, f, indent=2, ensure_ascii=False)
    
    print(f"Exported {len(vector_data)} vectors to {output_path}")

def main():
    # Paths
    pdf_path = "pdfs/HY MSK_Anatomy.pdf"
    output_path = "src/assets/vectors/anatomy_vectors.json"
    
    # Check if PDF exists
    if not os.path.exists(pdf_path):
        print(f"Error: PDF file not found at {pdf_path}")
        return
    
    # Create output directory
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    print("Starting vector extraction...")
    print(f"Processing PDF: {pdf_path}")
    
    # Extract text chunks
    chunks = extract_text_from_pdf(pdf_path)
    print(f"Extracted {len(chunks)} text chunks")
    
    if len(chunks) == 0:
        print("No text chunks extracted. Check PDF file.")
        return
    
    # Create embeddings
    print("Creating embeddings (this may take a few minutes)...")
    vector_data = create_embeddings(chunks)
    
    # Export to JSON
    export_vectors(vector_data, output_path)
    
    print("Vector extraction complete!")
    print(f"Vector file created at: {output_path}")
    print(f"Total vectors: {len(vector_data)}")
    if vector_data:
        print(f"Embedding dimension: {vector_data[0]['embedding_dim']}")

if __name__ == "__main__":
    main()