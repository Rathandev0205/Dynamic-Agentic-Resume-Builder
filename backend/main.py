from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
import uuid
from workflow.graph import invoke_with_checkpointer, get_user_config
from utils.resume_parser import parse_uploaded_file, extract_resume_sections
from workflow.chains import latex_conversion_chain
from utils.latex_compiler import compile_latex_to_pdf, is_latex_available

app = FastAPI(title="Resume Optimization API")

# Add CORS middleware to allow React frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React development server
        "http://127.0.0.1:3000",  # Alternative localhost
        "http://localhost:3001",  # In case React runs on different port
        "http://localhost:3002",  # In case React runs on different port
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    user_id: str
    session_id: Optional[str] = None
    message: str
    resume_content: Optional[str] = None

class UploadResponse(BaseModel):
    success: bool
    content: str
    sections: dict
    session_id: str

class LaTeXDownloadRequest(BaseModel):
    enhanced_content: str
    filename: Optional[str] = "resume"

@app.post("/upload", response_model=UploadResponse)
async def upload_resume(file: UploadFile = File(...)):
    """Upload and parse resume file"""
    try:
        # Validate file type
        if not file.filename.endswith(('.pdf', '.docx')):
            raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")
        
        # Parse resume content
        content = await parse_uploaded_file(file)
        
        # Extract sections
        sections = extract_resume_sections(content)
        
        # Generate session ID
        session_id = str(uuid.uuid4())
        
        return UploadResponse(
            success=True,
            content=content,
            sections=sections,
            session_id=session_id
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    """Main chat endpoint for resume optimization"""
    try:
        # Get user configuration
        config = get_user_config(request.user_id, request.session_id)
        
        # Prepare initial state - let the workflow handle intent classification
        initial_state = {
            "user_query": request.message,
            "resume_content": request.resume_content or "",
            "messages": [],
            "current_intent": "",  # Will be set by the workflow's classify_intent node
            "context": {},  # Will be populated by the workflow
            "agent_response": "",
            "resume_versions": []
        }
        
        # Invoke LangGraph workflow with proper context manager
        result = await invoke_with_checkpointer(initial_state, config)
        print(result)
        
        return {
            "success": True,
            "response": result["agent_response"],
            "intent": result["current_intent"],
            "session_id": request.session_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")

@app.post("/download-latex-pdf")
async def download_latex_pdf(request: LaTeXDownloadRequest):
    """Convert enhanced resume content to LaTeX and compile to PDF"""
    import logging
    import traceback
    
    # Set up logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"PDF download request received for filename: {request.filename}")
        logger.info(f"Content length: {len(request.enhanced_content)}")
        
        # Check if LaTeX is available
        if not is_latex_available():
            logger.error("LaTeX is not available on the system")
            raise HTTPException(
                status_code=500, 
                detail="LaTeX is not installed on the server. Please install texlive or similar LaTeX distribution."
            )
        
        logger.info("LaTeX is available, proceeding with chain invocation")
        
        # Convert enhanced content to LaTeX using LLM
        try:
            latex_chain = latex_conversion_chain()
            logger.info("LaTeX chain created successfully")
            
            latex_response = latex_chain.invoke({
                "enhanced_content": request.enhanced_content
            })
            logger.info(f"LaTeX chain invoked successfully, content length: {len(latex_response.latex_content)}")
            
        except Exception as chain_error:
            logger.error(f"Error in LaTeX chain: {str(chain_error)}")
            logger.error(f"Chain error traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Error in LaTeX chain: {str(chain_error)}")
        
        # Compile LaTeX to PDF
        try:
            logger.info("Starting LaTeX compilation")
            pdf_bytes = compile_latex_to_pdf(latex_response.latex_content)
            logger.info(f"LaTeX compilation successful, PDF size: {len(pdf_bytes)} bytes")
            
        except Exception as compile_error:
            logger.error(f"Error in LaTeX compilation: {str(compile_error)}")
            logger.error(f"Compilation error traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Error in LaTeX compilation: {str(compile_error)}")
        
        # Return PDF as download
        filename = f"{request.filename}.pdf"
        logger.info(f"Returning PDF response with filename: {filename}")
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Unexpected error in PDF download: {str(e)}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Unexpected error generating PDF: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    latex_available = is_latex_available()
    return {
        "status": "healthy", 
        "service": "resume-optimization-api",
        "latex_available": latex_available
    }
