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

# Import aimakerspace modules
import sys
sys.path.append('..')
from aimakerspace.text_utils import PDFLoader, CharacterTextSplitter
from aimakerspace.vectordatabase import VectorDatabase
from aimakerspace.openai_utils.embedding import EmbeddingModel
from aimakerspace.openai_utils.chatmodel import ChatOpenAI

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
vector_databases: Dict[str, VectorDatabase] = {}
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
    pdf_id: str           # ID of the uploaded PDF
    model: Optional[str] = "gpt-4o-mini"  # Optional model selection with default
    api_key: str          # OpenAI API key for authentication

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
                model=request.model,
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
        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
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
                "num_chunks": len(chunks),
                "total_characters": sum(len(chunk) for chunk in chunks)
            }
            
            return {
                "pdf_id": pdf_id,
                "filename": file.filename,
                "num_chunks": len(chunks),
                "message": "PDF uploaded and indexed successfully"
            }
            
        finally:
            # Clean up temporary file
            os.unlink(tmp_file_path)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# New endpoint for chatting with PDF using RAG
@app.post("/api/chat-pdf")
async def chat_pdf(request: PDFChatRequest):
    try:
        # Check if PDF exists
        if request.pdf_id not in vector_databases:
            raise HTTPException(status_code=404, detail="PDF not found")
        
        vector_db = vector_databases[request.pdf_id]
        
        # Search for relevant chunks
        relevant_chunks = vector_db.search_by_text(
            request.user_message, 
            k=5, 
            return_as_text=True
        )
        
        # Create context from relevant chunks
        context = "\n\n".join(relevant_chunks)
        
        # Create RAG prompt
        system_prompt = f"""You are a helpful assistant that answers questions based on the provided context from a PDF document. 
        
Use the following context to answer the user's question. If the answer is not in the context, say so clearly.

Context:
{context}

Please provide accurate and helpful answers based on the context above."""
        
        # Set up OpenAI API key
        os.environ['OPENAI_API_KEY'] = request.api_key
        chat_model = ChatOpenAI(model_name=request.model)
        
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
