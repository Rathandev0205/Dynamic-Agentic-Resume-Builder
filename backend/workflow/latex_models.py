from pydantic import BaseModel, Field

class LaTeXResponse(BaseModel):
    latex_content: str = Field(description="Complete LaTeX document ready for compilation")
    template_used: str = Field(description="Name of the LaTeX template used")
    compilation_notes: str = Field(description="Any notes about the LaTeX compilation")
