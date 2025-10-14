from langchain.prompts import ChatPromptTemplate 
from dotenv import load_dotenv
from langchain_tavily import TavilySearch
from workflow.helpers import get_chat_model
from workflow.prompts import (
    system_prompt,
    intent_prompt,
    job_matching_prompt,
    enhancement_prompt,
    research_prompt,
    latex_conversion_prompt,
    translate_prompt)

from workflow.models import (
    IntentResponse,
    JobMatchingResponse,
    EnhancementResponse,
    ResearchResponse,
    TranslateResponse
)
from workflow.latex_models import LaTeXResponse
load_dotenv()

def intent_chain():
    llm = get_chat_model()
    structured_llm = llm.with_structured_output(IntentResponse)
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system",system_prompt),
            ("user",intent_prompt)
        ]
    )
    return prompt | structured_llm 


def job_matching_chain():
    llm = get_chat_model()
    structured_llm = llm.with_structured_output(JobMatchingResponse)
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system",system_prompt),
            ("user",job_matching_prompt)
        ]
    )
    return prompt | structured_llm 


def enhancement_chain():
    llm = get_chat_model()
    structured_llm = llm.with_structured_output(EnhancementResponse)
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system",system_prompt),
            ("user",enhancement_prompt)
        ]
    )
    return prompt | structured_llm 


def research_chain():
    llm = get_chat_model()
    
    # Equip LLM with Tavily search tool
    search_tool = TavilySearch(max_results=5)
    llm_with_tools = llm.bind_tools([search_tool])
    
    # Then get structured output
    structured_llm = llm_with_tools.with_structured_output(ResearchResponse)
    
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system",system_prompt),
            ("user",research_prompt)
        ]
    )
    return prompt | structured_llm

def translate_chain():
    llm = get_chat_model()
    structured_llm = llm.with_structured_output(TranslateResponse)
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system",system_prompt),
            ("user",translate_prompt)
        ]
    )
    return prompt | structured_llm


def latex_conversion_chain():
    llm = get_chat_model()
    structured_llm = llm.with_structured_output(LaTeXResponse)
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", "You are a LaTeX expert creating professional resume documents."),
            ("user", latex_conversion_prompt)
        ]
    )
    return prompt | structured_llm
