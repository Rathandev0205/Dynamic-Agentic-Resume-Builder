from langgraph.graph import START, StateGraph, END
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
import asyncio

from workflow.state import ResumeState
from workflow.nodes import (
    classify_intent,
    job_matching_agent,
    enhancement_agent,
    company_research_agent,
    translation_agent
)
from workflow.edges import route_to_agent

# Create the graph structure
workflow = StateGraph(ResumeState)

# Add nodes
workflow.add_node("classifier", classify_intent)
workflow.add_node("job_matcher", job_matching_agent)
workflow.add_node("enhancer", enhancement_agent)
workflow.add_node("researcher", company_research_agent)
workflow.add_node("translator", translation_agent)

# Add edges
workflow.add_edge(START, "classifier")
workflow.add_conditional_edges(
    "classifier",
    route_to_agent,
    {
        "job_matching": "job_matcher",
        "enhancement": "enhancer", 
        "company_research": "researcher",
        "translation": "translator"
    }
)
workflow.add_edge("job_matcher", END)
workflow.add_edge("enhancer", END)
workflow.add_edge("researcher", END)
workflow.add_edge("translator", END)

def get_user_config(user_id: str, session_id: str = None):
    """Generate LangGraph config for user session"""
    thread_id = f"{user_id}_{session_id}" if session_id else user_id
    return {"configurable": {"thread_id": thread_id}}

async def invoke_with_checkpointer(initial_state: dict, config: dict):
    """Invoke the workflow with proper checkpointer context management"""
    async with AsyncSqliteSaver.from_conn_string("resume_agent.db") as checkpointer:
        app = workflow.compile(checkpointer=checkpointer)
        result = await app.ainvoke(initial_state, config=config)
        return result
