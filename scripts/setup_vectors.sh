#!/bin/bash

echo "Setting up vector database for PocketPal..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is required but not installed."
    echo "Please install Python 3 and try again."
    exit 1
fi

echo "Python version: $(python3 --version)"

# Try to install dependencies directly (no virtual env for simplicity)
echo "Installing Python dependencies..."
python3 -m pip install --user PyPDF2 sentence-transformers numpy torch transformers

# Check if PDF exists
if [ ! -f "pdfs/HY MSK_Anatomy.pdf" ]; then
    echo "Error: PDF file 'pdfs/HY MSK_Anatomy.pdf' not found."
    echo "Please make sure the PDF file exists in the pdfs/ directory."
    exit 1
fi

# Run vector extraction
echo "Extracting vectors from PDF..."
python3 scripts/extract_vectors.py

# Check if output was created
if [ -f "src/assets/vectors/anatomy_vectors.json" ]; then
    echo "✅ Vector setup complete! Vectors are now available in your React Native app."
    echo "📁 Vector file created: src/assets/vectors/anatomy_vectors.json"
    echo "🚀 You can now use the useVectorSearch hook in your components."
else
    echo "❌ Vector extraction failed. Check the error messages above."
    exit 1
fi