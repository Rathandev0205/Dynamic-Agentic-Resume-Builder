import re
from typing import Tuple

def extract_company_name(query: str) -> str:
    """Extract company name from user query"""
    # Look for patterns like "for Google", "at Microsoft", "optimize for Apple"
    patterns = [
        r'(?:for|at|with)\s+([A-Z][a-zA-Z]+)',
        r'optimize.*?for\s+([A-Z][a-zA-Z]+)',
        r'tailor.*?for\s+([A-Z][a-zA-Z]+)'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, query, re.IGNORECASE)
        if match:
            return match.group(1).title()
    
    return ""

def extract_job_description(query: str) -> str:
    """Extract job description from user input"""
    # Look for job description indicators
    jd_indicators = [
        "job description:", "jd:", "position:", "role:",
        "requirements:", "responsibilities:"
    ]
    
    query_lower = query.lower()
    for indicator in jd_indicators:
        if indicator in query_lower:
            # Extract text after the indicator
            start_idx = query_lower.find(indicator) + len(indicator)
            return query[start_idx:].strip()
    
    return ""

def extract_target_section(query: str) -> str:
    """Extract target resume section from user query"""
    section_keywords = {
        "experience": ["experience", "work history", "employment", "job"],
        "skills": ["skills", "technical skills", "competencies"],
        "education": ["education", "academic", "degree", "university"],
        "summary": ["summary", "objective", "profile", "about"],
        "projects": ["projects", "portfolio", "work samples"]
    }
    
    query_lower = query.lower()
    for section, keywords in section_keywords.items():
        if any(keyword in query_lower for keyword in keywords):
            return section
    
    return "general"

def classify_user_intent(query: str) -> Tuple[str, dict]:
    """Classify user intent and extract relevant context"""
    query_lower = query.lower()
    context = {}
    
    # Job matching intent
    if any(keyword in query_lower for keyword in ['job description', 'match', 'jd', 'position']):
        context['job_description'] = extract_job_description(query)
        return "job_matching", context
    
    # Company research intent  
    elif any(keyword in query_lower for keyword in ['company', 'google', 'microsoft', 'apple', 'amazon', 'optimize for']):
        context['company_name'] = extract_company_name(query)
        return "company_research", context
    
    # Enhancement intent
    elif any(keyword in query_lower for keyword in ['improve', 'enhance', 'better', 'update', 'fix']):
        context['target_section'] = extract_target_section(query)
        return "enhancement", context
    
    # Default to enhancement
    else:
        context['target_section'] = extract_target_section(query)
        return "enhancement", context
