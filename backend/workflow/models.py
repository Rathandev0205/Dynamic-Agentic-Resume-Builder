from pydantic import BaseModel, Field
from typing import List

class IntentResponse(BaseModel):
    intent: str = Field(description="Classified intent: job_matching, enhancement, or company_research")
    confidence: float = Field(description="Confidence score 0-1")
    reasoning: str = Field(description="Brief explanation of classification")


class JobMatchingResponse(BaseModel):
    match_score: int = Field(description="Match percentage 0-100")
    key_strengths: List[str] = Field(description="Matching strengths found")
    skill_gaps: List[str] = Field(description="Missing skills or experience")
    optimized_sections: dict = Field(description="Improved resume sections")
    recommendations: List[str] = Field(description="Specific improvement suggestions")

class EnhancementResponse(BaseModel):
    enhanced_content: str = Field(description="Improved resume content")
    changes_made: List[str] = Field(description="List of specific improvements")
    impact_score: int = Field(description="Expected improvement impact 1-10")
    suggestions: List[str] = Field(description="Additional enhancement suggestions")

class ResearchResponse(BaseModel):
    company_insights: dict = Field(description="Company culture, values, tech stack")
    optimization_strategy: str = Field(description="Tailoring approach for this company")
    optimized_content: str = Field(description="Company-optimized resume content")
    key_alignments: List[str] = Field(description="How resume aligns with company")