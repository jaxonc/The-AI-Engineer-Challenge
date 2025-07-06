# Import required FastAPI components for building the API
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
# Import Pydantic for data validation and settings management
from pydantic import BaseModel
# Import OpenAI client for interacting with OpenAI's API
from openai import OpenAI
import os
import tempfile
import asyncio
from typing import Optional, Dict, Any
import json
import requests
from urllib.parse import urlparse

# Initialize FastAPI application with a title
app = FastAPI(title="PDF RAG Chat API")

# Configure CORS (Cross-Origin Resource Sharing) middleware
# This allows the API to be accessed from different domains/origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from any origin
    allow_credentials=True,  # Allows cookies to be included in requests
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers in requests
)

# Global storage for vector databases (in production, use a proper database)
vector_databases: Dict[str, Any] = {}
pdf_metadata: Dict[str, Dict[str, Any]] = {}

# Define the data model for regular chat requests
class ChatRequest(BaseModel):
    developer_message: str  # Message from the developer/system
    user_message: str      # Message from the user
    model: Optional[str] = "gpt-4o-mini"  # Optional model selection with default
    api_key: str          # OpenAI API key for authentication

# Define the data model for PDF chat requests
class PDFChatRequest(BaseModel):
    user_message: str      # Message from the user
    pdf_ids: list[str]    # List of PDF IDs (supports 1-3 PDFs)
    model: Optional[str] = "gpt-4o-mini"  # Optional model selection with default
    api_key: str          # OpenAI API key for authentication

# Define the data model for PDF URL uploads
class PDFUrlRequest(BaseModel):
    url: str              # URL of the PDF to download
    api_key: str          # OpenAI API key for authentication

def extract_paper_title(documents: list) -> Optional[str]:
    """Extract paper title from the first few chunks of the document."""
    if not documents:
        return None
    
    # Get the first chunk and look for title patterns
    first_chunk = documents[0][:1000]  # First 1000 characters
    lines = first_chunk.split('\n')
    
    # Look for title patterns - typically the first substantial line
    # or lines that look like titles (proper case, not too long)
    potential_titles = []
    
    for i, line in enumerate(lines[:20]):  # Check first 20 lines
        line = line.strip()
        if not line:
            continue
            
        # Skip common header elements
        if any(skip in line.lower() for skip in ['page', 'doi:', 'http', 'www.', 'abstract', 'keywords', 'introduction']):
            continue
            
        # Look for title-like characteristics
        words = line.split()
        if (3 <= len(words) <= 20 and  # Reasonable word count
            len(line) > 10 and len(line) < 200 and  # Reasonable length
            sum(1 for word in words if word[0].isupper()) >= len(words) * 0.3):  # Some capitalization
            
            potential_titles.append((line, i))
    
    # Return the first reasonable title found
    if potential_titles:
        return potential_titles[0][0]
    
    return None

def download_pdf_from_url(url: str) -> str:
    """Download PDF from URL and save to temporary file. Returns the temp file path."""
    try:
        # Validate URL
        parsed_url = urlparse(url)
        if not parsed_url.scheme or not parsed_url.netloc:
            raise ValueError("Invalid URL format")
        
        # Download the PDF
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get(url, headers=headers, stream=True, timeout=30)
        response.raise_for_status()
        
        # Check if it's actually a PDF
        content_type = response.headers.get('content-type', '').lower()
        if 'application/pdf' not in content_type and not url.lower().endswith('.pdf'):
            # Try to detect PDF by content
            first_bytes = response.content[:8]
            if not first_bytes.startswith(b'%PDF'):
                raise ValueError("URL does not point to a valid PDF file")
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            for chunk in response.iter_content(chunk_size=8192):
                tmp_file.write(chunk)
            return tmp_file.name
            
    except requests.RequestException as e:
        raise ValueError(f"Failed to download PDF from URL: {str(e)}")
    except Exception as e:
        raise ValueError(f"Error processing PDF URL: {str(e)}")

# Define the main chat endpoint that handles POST requests (original functionality)
@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        # Initialize OpenAI client with the provided API key
        client = OpenAI(api_key=request.api_key)
        
        # Create an async generator function for streaming responses
        async def generate():
            # Create a streaming chat completion request
            stream = client.chat.completions.create(
                model=request.model or "gpt-4o-mini",
                messages=[
                    {"role": "developer", "content": request.developer_message},
                    {"role": "user", "content": request.user_message}
                ],
                stream=True  # Enable streaming response
            )
            
            # Yield each chunk of the response as it becomes available
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content

        # Return a streaming response to the client
        return StreamingResponse(generate(), media_type="text/plain")
    
    except Exception as e:
        # Handle any errors that occur during processing
        raise HTTPException(status_code=500, detail=str(e))

# New endpoint for PDF upload and indexing
@app.post("/api/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    api_key: str = Form(...)
):
    try:
        # Import aimakerspace modules only when needed
        import sys
        sys.path.append('..')
        from aimakerspace.text_utils import PDFLoader, CharacterTextSplitter
        from aimakerspace.vectordatabase import VectorDatabase
        from aimakerspace.openai_utils.embedding import EmbeddingModel
        
        # Validate file type
        if not file.filename or not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
        # Generate a unique ID for this PDF
        pdf_id = f"pdf_{len(vector_databases)}"
        
        # Save the uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        try:
            # Load and process the PDF
            pdf_loader = PDFLoader(tmp_file_path)
            documents = pdf_loader.load_documents()
            
            # Extract paper title from the documents
            paper_title = extract_paper_title(documents)
            
            # Split the documents into chunks
            text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
            chunks = text_splitter.split_texts(documents)
            
            # Create embeddings and vector database
            os.environ['OPENAI_API_KEY'] = api_key
            embedding_model = EmbeddingModel()
            vector_db = VectorDatabase(embedding_model)
            
            # Build vector database from chunks
            vector_db = await vector_db.abuild_from_list(chunks)
            
            # Store the vector database and metadata
            vector_databases[pdf_id] = vector_db
            pdf_metadata[pdf_id] = {
                "filename": file.filename,
                "paper_title": paper_title,
                "source": "file_upload",
                "num_chunks": len(chunks),
                "total_characters": sum(len(chunk) for chunk in chunks)
            }
            
            return {
                "pdf_id": pdf_id,
                "filename": file.filename,
                "paper_title": paper_title,
                "source": "file_upload",
                "num_chunks": len(chunks),
                "message": "PDF uploaded and indexed successfully"
            }
            
        finally:
            # Clean up temporary file
            os.unlink(tmp_file_path)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# New endpoint for PDF URL upload and indexing
@app.post("/api/upload-pdf-url")
async def upload_pdf_url(request: PDFUrlRequest):
    try:
        # Import aimakerspace modules only when needed
        import sys
        sys.path.append('..')
        from aimakerspace.text_utils import PDFLoader, CharacterTextSplitter
        from aimakerspace.vectordatabase import VectorDatabase
        from aimakerspace.openai_utils.embedding import EmbeddingModel
        
        # Generate a unique ID for this PDF
        pdf_id = f"pdf_{len(vector_databases)}"
        
        # Download PDF from URL
        tmp_file_path = download_pdf_from_url(request.url)
        
        try:
            # Load and process the PDF
            pdf_loader = PDFLoader(tmp_file_path)
            documents = pdf_loader.load_documents()
            
            # Extract paper title from the documents
            paper_title = extract_paper_title(documents)
            
            # Split the documents into chunks
            text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
            chunks = text_splitter.split_texts(documents)
            
            # Create embeddings and vector database
            os.environ['OPENAI_API_KEY'] = request.api_key
            embedding_model = EmbeddingModel()
            vector_db = VectorDatabase(embedding_model)
            
            # Build vector database from chunks
            vector_db = await vector_db.abuild_from_list(chunks)
            
            # Extract filename from URL
            filename = os.path.basename(urlparse(request.url).path) or "pdf_from_url.pdf"
            if not filename.endswith('.pdf'):
                filename += '.pdf'
            
            # Store the vector database and metadata
            vector_databases[pdf_id] = vector_db
            pdf_metadata[pdf_id] = {
                "filename": filename,
                "paper_title": paper_title,
                "source": "url",
                "url": request.url,
                "num_chunks": len(chunks),
                "total_characters": sum(len(chunk) for chunk in chunks)
            }
            
            return {
                "pdf_id": pdf_id,
                "filename": filename,
                "paper_title": paper_title,
                "source": "url",
                "url": request.url,
                "num_chunks": len(chunks),
                "message": "PDF downloaded and indexed successfully"
            }
            
        finally:
            # Clean up temporary file
            os.unlink(tmp_file_path)
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# New endpoint for chatting with PDF(s) using RAG
@app.post("/api/chat-pdf")
async def chat_pdf(request: PDFChatRequest):
    try:
        # Import aimakerspace modules only when needed
        import sys
        sys.path.append('..')
        from aimakerspace.openai_utils.chatmodel import ChatOpenAI
        
        # Validate PDF IDs limit (max 3 for research publication analysis)
        if len(request.pdf_ids) == 0:
            raise HTTPException(status_code=400, detail="At least one PDF must be selected")
        if len(request.pdf_ids) > 3:
            raise HTTPException(status_code=400, detail="Maximum 3 PDFs can be selected for analysis")
        
        # Check if all PDFs exist
        missing_pdfs = [pdf_id for pdf_id in request.pdf_ids if pdf_id not in vector_databases]
        if missing_pdfs:
            raise HTTPException(status_code=404, detail=f"PDFs not found: {', '.join(missing_pdfs)}")
        
        # Collect relevant chunks from all selected PDFs
        all_relevant_chunks = []
        pdf_contexts = {}
        
        for pdf_id in request.pdf_ids:
            vector_db = vector_databases[pdf_id]
            pdf_filename = pdf_metadata[pdf_id]["filename"]
            
            # Search for relevant chunks in this PDF
            relevant_chunks = vector_db.search_by_text(
                request.user_message, 
                k=5 if len(request.pdf_ids) == 1 else 3,  # Fewer chunks per PDF when using multiple
                return_as_text=True
            )
            
            # Tag chunks with their source PDF
            tagged_chunks = [f"[From: {pdf_filename}]\n{chunk}" for chunk in relevant_chunks]
            all_relevant_chunks.extend(tagged_chunks)
            pdf_contexts[pdf_id] = pdf_filename
        
        # Create context from all relevant chunks
        context = "\n\n---\n\n".join(all_relevant_chunks)
        
        # Create RAG prompt for single or multiple documents
        if len(request.pdf_ids) == 1:
            pdf_id = request.pdf_ids[0]
            pdf_metadata_entry = pdf_metadata[pdf_id]
            pdf_name = pdf_metadata_entry["filename"]
            paper_title = pdf_metadata_entry.get("paper_title")
            source_info = pdf_metadata_entry.get("url", pdf_name)
            
            # Use paper title if available, otherwise use filename
            display_name = paper_title if paper_title else pdf_name
            
            system_prompt = f"""You are a research assistant specializing in academic publication analysis. Answer questions based on the provided context from the research document.

**Document Information:**
- Paper: {display_name}
- Source: ({source_info})

**Formatting Instructions:**
- Use clear markdown formatting for better readability
- Structure your response with appropriate headings (##, ###) when helpful
- Use bullet points (-) or numbered lists for multiple items
- Use **bold** for emphasis on key terms or findings
- Use *italics* for paper titles when mentioned
- Use `code blocks` for technical terms, formulas, or specific measurements
- Add line breaks between paragraphs for better readability

**Citation Requirements:**
- When referring to this research paper, use the title "{display_name}" 
- Always include the source in parentheses: ({source_info})
- When quoting or referencing specific findings, clearly indicate they come from this paper

**Content Guidelines:**
- Provide accurate, scholarly answers based on the context below
- If the answer is not in the context, state this clearly
- Structure your response logically with clear sections
- Use academic language appropriate for research analysis

**Context:**
{context}

Please provide a well-formatted, scholarly response based on the context above."""
        else:
            pdf_details = []
            for pdf_id in request.pdf_ids:
                pdf_metadata_entry = pdf_metadata[pdf_id]
                pdf_name = pdf_metadata_entry["filename"]
                paper_title = pdf_metadata_entry.get("paper_title")
                source_info = pdf_metadata_entry.get("url", pdf_name)
                display_name = paper_title if paper_title else pdf_name
                pdf_details.append(f"- {display_name} ({source_info})")
            
            papers_list = "\n".join(pdf_details)
            
            system_prompt = f"""You are a research assistant specializing in comparative analysis of academic publications. Answer questions based on the provided context from {len(request.pdf_ids)} research documents.

**Document Information:**
{papers_list}

**Formatting Instructions:**
- Use clear markdown formatting for better readability
- Structure your response with appropriate headings (##, ###) when helpful
- Use bullet points (-) or numbered lists for multiple items
- Use **bold** for emphasis on key terms or findings
- Use *italics* for paper titles when mentioned
- Use `code blocks` for technical terms, formulas, or specific measurements
- Add line breaks between paragraphs for better readability

**Citation Requirements:**
- When referring to papers, use their titles (shown above) rather than filenames
- Always include the source in parentheses after mentioning a paper
- When comparing findings across papers, clearly attribute each point to its source
- Use the [From: filename] tags in the context to identify sources accurately

**Content Guidelines:**
- Provide accurate, scholarly answers with proper source attribution
- When comparing across documents, organize by themes or create clear comparisons
- If information is not available in the context, state this clearly
- Structure your response logically with clear sections for each paper or theme
- Use academic language appropriate for research analysis

**Context:**
{context}

Please provide a well-formatted, scholarly response with proper citations based on the context above."""
        
        # Set up OpenAI API key
        os.environ['OPENAI_API_KEY'] = request.api_key
        chat_model = ChatOpenAI(model_name=request.model or "gpt-4o-mini")
        
        # Create messages for chat
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.user_message}
        ]
        
        # Create an async generator function for streaming responses
        async def generate():
            async for chunk in chat_model.astream(messages):
                yield chunk

        # Return a streaming response to the client
        return StreamingResponse(generate(), media_type="text/plain")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# New endpoint to list uploaded PDFs
@app.get("/api/pdfs")
async def list_pdfs():
    try:
        return {
            "pdfs": [
                {
                    "pdf_id": pdf_id,
                    "filename": metadata["filename"],
                    "paper_title": metadata.get("paper_title"),
                    "source": metadata.get("source", "unknown"),
                    "url": metadata.get("url", None),
                    "num_chunks": metadata["num_chunks"],
                    "total_characters": metadata["total_characters"]
                }
                for pdf_id, metadata in pdf_metadata.items()
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# New endpoint to delete a PDF
@app.delete("/api/pdf/{pdf_id}")
async def delete_pdf(pdf_id: str):
    try:
        if pdf_id not in vector_databases:
            raise HTTPException(status_code=404, detail="PDF not found")
        
        filename = pdf_metadata[pdf_id]["filename"]
        del vector_databases[pdf_id]
        del pdf_metadata[pdf_id]
        
        return {"message": f"PDF '{filename}' deleted successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Define a health check endpoint to verify API status
@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "uploaded_pdfs": len(vector_databases)
    }

# Entry point for running the application directly
if __name__ == "__main__":
    import uvicorn
    # Start the server on all network interfaces (0.0.0.0) on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
