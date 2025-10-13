from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader
from langchain_pymupdf4llm import PyMuPDF4LLMLoader
from fastapi import UploadFile
import tempfile
import os

async def parse_uploaded_file(file: UploadFile) -> str:
    """Parse uploaded PDF/DOCX file and return text content"""
    
    # Create temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file.filename.split('.')[-1]}") as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_file_path = tmp_file.name
    
    try:
        if file.filename.endswith('.pdf'):
            return parse_pdf(tmp_file_path)
        elif file.filename.endswith('.docx'):
            return parse_docx(tmp_file_path)
        else:
            raise ValueError("Unsupported file format")
    finally:
        os.unlink(tmp_file_path)

def parse_pdf(file_path: str) -> str:
    """Parse PDF file and return text content"""
    loader = PyMuPDF4LLMLoader(file_path)
    docs = loader.load()
    return "\n".join([doc.page_content for doc in docs])

def parse_docx(file_path: str) -> str:
    """Parse DOCX file and return text content"""
    loader = Docx2txtLoader(file_path)
    docs = loader.load()
    return "\n".join([doc.page_content for doc in docs])

def extract_resume_sections(content: str) -> dict:
    """Extract structured sections from resume text"""
    sections = {
        "contact": "",
        "summary": "",
        "experience": "",
        "education": "",
        "skills": "",
        "projects": ""
    }
    
    # Simple section extraction logic
    lines = content.split('\n')
    current_section = "summary"
    
    for line in lines:
        line_lower = line.lower().strip()
        
        if any(keyword in line_lower for keyword in ['experience', 'work history', 'employment']):
            current_section = "experience"
        elif any(keyword in line_lower for keyword in ['education', 'academic']):
            current_section = "education"
        elif any(keyword in line_lower for keyword in ['skills', 'technical skills']):
            current_section = "skills"
        elif any(keyword in line_lower for keyword in ['projects', 'portfolio']):
            current_section = "projects"
        elif any(keyword in line_lower for keyword in ['contact', 'email', 'phone']):
            current_section = "contact"
        else:
            sections[current_section] += line + "\n"
    
    return sections
