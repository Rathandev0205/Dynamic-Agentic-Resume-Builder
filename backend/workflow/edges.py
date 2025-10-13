from workflow.state import ResumeState

# Add routing logic
def route_to_agent(state: ResumeState) -> str:
    intent = state["current_intent"]
    return intent  # Returns the routing key


