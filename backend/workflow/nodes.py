from workflow.state import ResumeState
from workflow.chains import (
    intent_chain,
    job_matching_chain,
    enhancement_chain,
    research_chain,
    translate_chain
)

# Intent classification node
def classify_intent(state: ResumeState) -> ResumeState:
    # Classify user intent (job_matching, enhancement, company_research)
    chain = intent_chain()
    response = chain.invoke({
        "user_query": state["user_query"],
        "resume_content": state["resume_content"]
    })
    
    # Update the current state with classification
    state["current_intent"] = response.intent
    
    # Extract context based on intent
    if response.intent == "enhancement":
        # For enhancement, set a default target section
        state["context"] = {"target_section": "general"}
    elif response.intent == "job_matching":
        # Try to extract job description from query
        query_lower = state["user_query"].lower()
        if "job description:" in query_lower or "requirements:" in query_lower:
            # Extract job description after the indicator
            job_desc = state["user_query"].split(":")[-1].strip()
            state["context"] = {"job_description": job_desc}
        else:
            state["context"] = {"job_description": state["user_query"]}
    elif response.intent == "company_research":
        # Try to extract company name from query
        import re
        company_match = re.search(r'(?:for|at|with)\s+([A-Z][a-zA-Z]+)', state["user_query"], re.IGNORECASE)
        company_name = company_match.group(1) if company_match else "Unknown Company"
        state["context"] = {"company_name": company_name}
    elif response.intent == "translation":
        # Extract target language from query
        import re
        query_lower = state["user_query"].lower()
        
        # Language detection patterns
        language_patterns = {
            "spanish": ["spanish", "español", "mexican", "mexico", "castellano"],
            "french": ["french", "français", "francais"],
            "german": ["german", "deutsch", "alemán"],
            "portuguese": ["portuguese", "português", "portugues", "brazilian", "brasil"],
            "italian": ["italian", "italiano"],
            "chinese": ["chinese", "mandarin", "中文"],
            "japanese": ["japanese", "日本語", "nihongo"],
            "korean": ["korean", "한국어", "hangul"]
        }
        
        detected_language = "spanish"  # Default fallback
        for lang, patterns in language_patterns.items():
            if any(pattern in query_lower for pattern in patterns):
                detected_language = lang
                break
        
        state["context"] = {"target_language": detected_language}
    else:
        state["context"] = {}
    
    state["messages"].append({
        "role":"system",
        "content":f"Intent classified as: {response.intent} (confidence: {response.confidence})"
    })
    return state
  

def job_matching_agent(state: ResumeState) -> ResumeState:
    """Analyze job description and optimize resume match"""
    chain = job_matching_chain()
    
    # Extract job description from context or query
    job_description = state["context"].get("job_description", "")
    
    response = chain.invoke({
        "resume_content": state["resume_content"],
        "job_description": job_description,
        "user_query": state["user_query"]
    })
    
    # Build optimized resume content from optimized sections
    optimized_resume = ""
    if hasattr(response, 'optimized_sections') and response.optimized_sections:
        # Reconstruct the resume with optimized sections
        original_sections = state["resume_content"].split('\n\n')
        optimized_resume = state["resume_content"]  # Start with original
        
        # Replace sections that were optimized
        for section_name, optimized_content in response.optimized_sections.items():
            if optimized_content and optimized_content.strip():
                # For now, append optimized sections at the end
                # In a more sophisticated implementation, you'd replace specific sections
                optimized_resume += f"\n\n--- OPTIMIZED {section_name.upper()} ---\n{optimized_content}"
    
    # Update state with results including optimized content
    analysis_text = f"Match Score: {response.match_score}%\n\nKey Strengths:\n" + \
                   "\n".join(f"• {strength}" for strength in response.key_strengths) + \
                   f"\n\nSkill Gaps:\n" + \
                   "\n".join(f"• {gap}" for gap in response.skill_gaps) + \
                   f"\n\nRecommendations:\n" + \
                   "\n".join(f"• {rec}" for rec in response.recommendations)
    
    if optimized_resume and optimized_resume != state["resume_content"]:
        state["agent_response"] = f"{analysis_text}\n\n--- JOB-OPTIMIZED RESUME ---\n{optimized_resume}"
    else:
        state["agent_response"] = analysis_text
    
    state["messages"].append({
        "role": "assistant",
        "content": state["agent_response"]
    })
    
    return state

def enhancement_agent(state: ResumeState) -> ResumeState:
    """Improve specific resume sections"""
    chain = enhancement_chain()
    
    try:
        response = chain.invoke({
            "resume_content": state["resume_content"],
            "user_query": state["user_query"],
            "target_section": state["context"].get("target_section", "general")
        })
        print(response)
        
        # Validate response has required fields
        if not hasattr(response, 'enhanced_content') or not response.enhanced_content:
            raise ValueError("Invalid response: missing enhanced_content")
        
        # Update state with enhanced content
        state["agent_response"] = f"Enhanced Content:\n{response.enhanced_content}\n\n" + \
                                 f"Changes Made:\n" + \
                                 "\n".join(f"• {change}" for change in response.changes_made) + \
                                 f"\n\nImpact Score: {response.impact_score}/10"
        
    except Exception as e:
        # Fallback response if LLM fails
        state["agent_response"] = f"I apologize, but I encountered an issue while enhancing your resume. " + \
                                 f"Error: {str(e)}\n\n" + \
                                 f"Please try rephrasing your request or contact support if the issue persists."
    
    state["messages"].append({
        "role": "assistant", 
        "content": state["agent_response"]
    })
    
    return state

def company_research_agent(state: ResumeState) -> ResumeState:
    """Research company and optimize resume accordingly"""
    chain = research_chain()
    
    # Extract company name from query
    company_name = state["context"].get("company_name", "")
    
    response = chain.invoke({
        "resume_content": state["resume_content"],
        "company_name": company_name,
        "user_query": state["user_query"]
    })
    
    # Format company insights for display
    insights_text = ""
    if hasattr(response, 'company_insights') and isinstance(response.company_insights, dict):
        insights_text = f"Company Culture: {response.company_insights.get('culture', 'N/A')}\n" + \
                       f"Tech Stack: {response.company_insights.get('tech_stack', 'N/A')}\n" + \
                       f"Values: {response.company_insights.get('values', 'N/A')}\n" + \
                       f"Hiring Focus: {response.company_insights.get('hiring_focus', 'N/A')}"
    else:
        insights_text = str(response.company_insights)
    
    # Build response with both analysis and optimized content
    analysis_text = f"Company Insights:\n{insights_text}\n\n" + \
                   f"Optimization Strategy:\n{response.optimization_strategy}\n\n" + \
                   f"Key Alignments:\n" + \
                   "\n".join(f"• {alignment}" for alignment in response.key_alignments)
    
    # Include optimized content if available
    if hasattr(response, 'optimized_content') and response.optimized_content and response.optimized_content.strip():
        state["agent_response"] = f"{analysis_text}\n\n--- COMPANY-OPTIMIZED RESUME ---\n{response.optimized_content}"
    else:
        state["agent_response"] = analysis_text
    
    state["context"]["company_info"] = response.company_insights
    state["messages"].append({
        "role": "assistant",
        "content": state["agent_response"]
    })
    
    return state

def translation_agent(state: ResumeState) -> ResumeState:
    """Translate and culturally adapt resume to target language"""
    chain = translate_chain()
    
    # Extract target language from context
    target_language = state["context"].get("target_language", "spanish")
    
    try:
        response = chain.invoke({
            "resume_content": state["resume_content"],
            "user_query": state["user_query"],
            "target_language": target_language
        })
        
        # Validate response has required fields
        if not hasattr(response, 'translated_content') or not response.translated_content:
            raise ValueError("Invalid response: missing translated_content")
        
        # Update state with translated content
        language_names = {
            "spanish": "Spanish",
            "french": "French", 
            "german": "German",
            "portuguese": "Portuguese",
            "italian": "Italian",
            "chinese": "Chinese",
            "japanese": "Japanese",
            "korean": "Korean"
        }
        
        language_display = language_names.get(target_language, target_language.title())
        
        state["agent_response"] = f"Resume translated to {language_display}:\n\n--- TRANSLATED RESUME ---\n{response.translated_content}"
        
    except Exception as e:
        # Fallback response if translation fails
        state["agent_response"] = f"I apologize, but I encountered an issue while translating your resume. " + \
                                 f"Error: {str(e)}\n\n" + \
                                 f"Please try rephrasing your request or contact support if the issue persists."
    
    state["messages"].append({
        "role": "assistant",
        "content": state["agent_response"]
    })
    
    return state
