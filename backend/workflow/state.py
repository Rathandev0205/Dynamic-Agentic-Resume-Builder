from typing import TypedDict, List, Optional

class ResumeState(TypedDict):
    messages: List[dict]
    resume_content: str
    resume_versions: List[dict]
    current_intent: str
    agent_response: str
    user_query: str
    context: dict
