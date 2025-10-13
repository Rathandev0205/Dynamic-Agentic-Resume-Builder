import subprocess
import tempfile
import os
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

def compile_latex_to_pdf(latex_content: str) -> bytes:
    """
    Compile LaTeX content to PDF and return PDF bytes
    
    Args:
        latex_content: Complete LaTeX document as string
        
    Returns:
        bytes: PDF file content
        
    Raises:
        Exception: If LaTeX compilation fails
    """
    
    # Create temporary directory for LaTeX compilation
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # Write LaTeX content to file
        tex_file = temp_path / "resume.tex"
        with open(tex_file, 'w', encoding='utf-8') as f:
            f.write(latex_content)
        
        try:
            # Compile LaTeX to PDF using pdflatex
            # Run twice to resolve references
            for i in range(2):
                result = subprocess.run([
                    'pdflatex',
                    '-interaction=nonstopmode',
                    '-output-directory', str(temp_path),
                    str(tex_file)
                ], 
                capture_output=True, 
                text=True,
                cwd=temp_path
                )
                
                if result.returncode != 0:
                    logger.error(f"LaTeX compilation failed (run {i+1}): {result.stderr}")
                    if i == 0:  # Try once more
                        continue
                    else:
                        raise Exception(f"LaTeX compilation failed: {result.stderr}")
            
            # Read the generated PDF
            pdf_file = temp_path / "resume.pdf"
            if not pdf_file.exists():
                raise Exception("PDF file was not generated")
                
            with open(pdf_file, 'rb') as f:
                pdf_bytes = f.read()
                
            return pdf_bytes
            
        except FileNotFoundError:
            raise Exception("pdflatex not found. Please install LaTeX distribution (e.g., texlive)")
        except Exception as e:
            logger.error(f"LaTeX compilation error: {str(e)}")
            raise


def is_latex_available() -> bool:
    """Check if LaTeX is available on the system"""
    try:
        result = subprocess.run(['pdflatex', '--version'], 
                              capture_output=True, 
                              text=True)
        return result.returncode == 0
    except FileNotFoundError:
        return False


def install_latex_packages():
    """Install required LaTeX packages (if using texlive)"""
    required_packages = [
        'moderncv',
        'geometry',
        'fontawesome',
        'xcolor'
    ]
    
    for package in required_packages:
        try:
            subprocess.run(['tlmgr', 'install', package], 
                         capture_output=True, 
                         check=True)
        except (FileNotFoundError, subprocess.CalledProcessError):
            logger.warning(f"Could not install LaTeX package: {package}")
