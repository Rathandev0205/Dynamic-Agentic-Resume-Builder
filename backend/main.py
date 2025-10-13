from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
import uuid
from workflow.graph import invoke_with_checkpointer, get_user_config
from utils.resume_parser import parse_uploaded_file, extract_resume_sections
from workflow.chains import latex_conversion_chain
from utils.latex_compiler import compile_latex_to_pdf, is_latex_available

app = FastAPI(title="Resume Optimization API")

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
    try:
        # Check if LaTeX is available
        if not is_latex_available():
            raise HTTPException(
                status_code=500, 
                detail="LaTeX is not installed on the server. Please install texlive or similar LaTeX distribution."
            )
        
        # Convert enhanced content to LaTeX using LLM
        latex_chain = latex_conversion_chain()
        latex_response = latex_chain.invoke({
            "enhanced_content": request.enhanced_content
        })
        
        # Compile LaTeX to PDF
        pdf_bytes = compile_latex_to_pdf(latex_response.latex_content)
        
        # Return PDF as download
        filename = f"{request.filename}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating LaTeX PDF: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    latex_available = is_latex_available()
    return {
        "status": "healthy", 
        "service": "resume-optimization-api",
        "latex_available": latex_available
    }
