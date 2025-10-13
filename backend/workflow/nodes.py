from workflow.state import ResumeState
from workflow.chains import (
    intent_chain,
    job_matching_chain,
    enhancement_chain,
    research_chain
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
    
    # Update state with results
    state["agent_response"] = f"Match Score: {response.match_score}%\n\nKey Strengths:\n" + \
                             "\n".join(f"• {strength}" for strength in response.key_strengths) + \
                             f"\n\nSkill Gaps:\n" + \
                             "\n".join(f"• {gap}" for gap in response.skill_gaps) + \
                             f"\n\nRecommendations:\n" + \
                             "\n".join(f"• {rec}" for rec in response.recommendations)
    
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
    
    # Update state with research and optimization
    state["agent_response"] = f"Company Insights:\n{response.company_insights}\n\n" + \
                             f"Optimization Strategy:\n{response.optimization_strategy}\n\n" + \
                             f"Key Alignments:\n" + \
                             "\n".join(f"• {alignment}" for alignment in response.key_alignments)
    
    state["context"]["company_info"] = response.company_insights
    state["messages"].append({
        "role": "assistant",
        "content": state["agent_response"]
    })
    
    return state
