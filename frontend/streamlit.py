import streamlit as st
import requests
import json
import time
from typing import Dict, List, Optional
import uuid
from datetime import datetime
import io

# Configure Streamlit page
st.set_page_config(
    page_title="Resume Optimization Assistant",
    page_icon="📄",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Backend API configuration
API_BASE_URL = "http://localhost:8001"

# Initialize session state
if "messages" not in st.session_state:
    st.session_state.messages = []
if "resume_content" not in st.session_state:
    st.session_state.resume_content = ""
if "resume_versions" not in st.session_state:
    st.session_state.resume_versions = []
if "user_id" not in st.session_state:
    st.session_state.user_id = str(uuid.uuid4())
if "session_id" not in st.session_state:
    st.session_state.session_id = str(uuid.uuid4())
if "current_version" not in st.session_state:
    st.session_state.current_version = 0

def upload_resume(uploaded_file) -> Optional[Dict]:
    """Upload resume file to backend API"""
    try:
        files = {"file": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type)}
        response = requests.post(f"{API_BASE_URL}/upload", files=files)
        
        if response.status_code == 200:
            return response.json()
        else:
            st.error(f"Upload failed: {response.text}")
            return None
    except Exception as e:
        st.error(f"Error uploading file: {str(e)}")
        return None

def send_chat_message(message: str, resume_content: str = "") -> Optional[Dict]:
    """Send chat message to backend API"""
    try:
        payload = {
            "user_id": st.session_state.user_id,
            "session_id": st.session_state.session_id,
            "message": message,
            "resume_content": resume_content or st.session_state.resume_content
        }
        
        response = requests.post(f"{API_BASE_URL}/chat", json=payload)
        
        if response.status_code == 200:
            return response.json()
        else:
            st.error(f"Chat request failed: {response.text}")
            return None
    except Exception as e:
        st.error(f"Error sending message: {str(e)}")
        return None

def save_resume_version(content: str, description: str):
    """Save a new version of the resume"""
    version = {
        "id": len(st.session_state.resume_versions),
        "content": content,
        "description": description,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "changes": []
    }
    st.session_state.resume_versions.append(version)
    st.session_state.current_version = len(st.session_state.resume_versions) - 1

def display_typing_indicator():
    """Display typing indicator animation"""
    placeholder = st.empty()
    for i in range(3):
        placeholder.markdown("🤖 Agent is thinking" + "." * (i + 1))
        time.sleep(0.5)
    placeholder.empty()

def compare_resume_versions(version1_idx: int, version2_idx: int):
    """Compare two resume versions"""
    if version1_idx < len(st.session_state.resume_versions) and version2_idx < len(st.session_state.resume_versions):
        v1 = st.session_state.resume_versions[version1_idx]
        v2 = st.session_state.resume_versions[version2_idx]
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.subheader(f"Version {version1_idx + 1}")
            st.caption(f"Created: {v1['timestamp']}")
            st.text_area("Content", v1['content'], height=400, key=f"v1_{version1_idx}")
        
        with col2:
            st.subheader(f"Version {version2_idx + 1}")
            st.caption(f"Created: {v2['timestamp']}")
            st.text_area("Content", v2['content'], height=400, key=f"v2_{version2_idx}")

def download_professional_pdf(resume_content: str):
    """Download professional LaTeX-generated PDF"""
    try:
        with st.spinner("🎓 Generating professional PDF... This may take a moment."):
            # Send request to backend for LaTeX PDF generation
            payload = {
                "enhanced_content": resume_content,
                "filename": f"professional_resume_v{st.session_state.current_version + 1}"
            }
            
            response = requests.post(f"{API_BASE_URL}/download-latex-pdf", json=payload)
            
            if response.status_code == 200:
                # Create download button for the PDF
                st.download_button(
                    label="📥 Download Professional PDF",
                    data=response.content,
                    file_name=f"professional_resume_v{st.session_state.current_version + 1}.pdf",
                    mime="application/pdf"
                )
                st.success("✅ Professional PDF generated successfully!")
            else:
                error_msg = response.text
                if "LaTeX is not installed" in error_msg:
                    st.error("❌ LaTeX is not available on the server. Professional PDF generation requires LaTeX installation.")
                    st.info("💡 You can still download the text version and format it manually.")
                else:
                    st.error(f"❌ Failed to generate PDF: {error_msg}")
                    
    except Exception as e:
        st.error(f"❌ Error generating professional PDF: {str(e)}")
        st.info("💡 You can still download the text version and format it manually.")

# Main UI Layout
st.title("📄 Resume Optimization Assistant")
st.markdown("Upload your resume and get AI-powered optimization suggestions!")

# Sidebar for file upload and version management
with st.sidebar:
    st.header("📁 Resume Management")
    
    # File upload section
    uploaded_file = st.file_uploader(
        "Upload your resume",
        type=['pdf', 'docx'],
        help="Upload a PDF or DOCX file"
    )
    
    if uploaded_file is not None:
        if st.button("Process Resume", type="primary", key="process_resume_btn"):
            with st.spinner("Processing resume..."):
                result = upload_resume(uploaded_file)
                if result and result.get("success"):
                    st.session_state.resume_content = result["content"]
                    st.session_state.session_id = result["session_id"]
                    
                    # Save initial version
                    save_resume_version(
                        result["content"], 
                        f"Original resume from {uploaded_file.name}"
                    )
                    
                    st.success("Resume uploaded successfully!")
                    st.rerun()
    
    # Version management
    if st.session_state.resume_versions:
        st.header("📚 Resume Versions")
        
        version_options = [
            f"Version {i+1}: {v['description'][:30]}..." 
            for i, v in enumerate(st.session_state.resume_versions)
        ]
        
        selected_version = st.selectbox(
            "Select version to view",
            range(len(version_options)),
            format_func=lambda x: version_options[x],
            index=st.session_state.current_version
        )
        
        if st.button("Load Selected Version", key="load_version_btn"):
            st.session_state.current_version = selected_version
            st.session_state.resume_content = st.session_state.resume_versions[selected_version]["content"]
            st.rerun()
        
        # Version comparison
        if len(st.session_state.resume_versions) > 1:
            st.subheader("🔍 Compare Versions")
            col1, col2 = st.columns(2)
            
            with col1:
                v1 = st.selectbox("Version 1", range(len(version_options)), format_func=lambda x: f"V{x+1}")
            with col2:
                v2 = st.selectbox("Version 2", range(len(version_options)), format_func=lambda x: f"V{x+1}")
            
            if st.button("Compare Versions", key="compare_versions_sidebar_btn"):
                st.session_state.show_comparison = True
                st.session_state.compare_v1 = v1
                st.session_state.compare_v2 = v2

# Main content area
if not st.session_state.resume_content:
    st.info("👆 Please upload your resume using the sidebar to get started!")
else:
    # Create tabs for different views
    tab1, tab2, tab3 = st.tabs(["💬 Chat Assistant", "📄 Current Resume", "🔍 Version Comparison"])
    
    with tab1:
        st.header("Chat with Resume Assistant")
        
        # Display chat history
        chat_container = st.container()
        with chat_container:
            for message in st.session_state.messages:
                with st.chat_message(message["role"]):
                    st.markdown(message["content"])
                    if message.get("intent"):
                        st.caption(f"Intent: {message['intent']}")
        
        # Chat input
        if prompt := st.chat_input("Ask me to improve your resume, match it to a job, or optimize for a company..."):
            # Add user message to chat history
            st.session_state.messages.append({"role": "user", "content": prompt})
            
            # Display user message
            with st.chat_message("user"):
                st.markdown(prompt)
            
            # Display typing indicator and get response
            with st.chat_message("assistant"):
                # Show typing indicator
                typing_placeholder = st.empty()
                typing_placeholder.markdown("🤖 Analyzing your request...")
                
                # Send request to backend
                response = send_chat_message(prompt, st.session_state.resume_content)
                
                # Clear typing indicator
                typing_placeholder.empty()
                
                if response and response.get("success"):
                    agent_response = response["response"]
                    intent = response.get("intent", "unknown")
                    
                    # Display response
                    st.markdown(agent_response)
                    st.caption(f"Intent: {intent}")
                    
                    # Add assistant message to chat history
                    st.session_state.messages.append({
                        "role": "assistant", 
                        "content": agent_response,
                        "intent": intent
                    })
                    
                    # If this was an enhancement, save new version
                    if intent == "enhancement" and "Enhanced Content:" in agent_response:
                        try:
                            # Extract enhanced content (this is a simple extraction, could be improved)
                            enhanced_content = agent_response.split("Enhanced Content:")[1].split("Changes Made:")[0].strip()
                            if enhanced_content:
                                save_resume_version(
                                    enhanced_content,
                                    f"Enhanced via chat: {prompt[:50]}..."
                                )
                                st.success("✅ New resume version saved!")
                        except:
                            pass
                else:
                    st.error("Failed to get response from assistant. Please try again.")
        
        # Quick action buttons
        st.subheader("🚀 Quick Actions")
        col1, col2, col3 = st.columns(3)
        
        with col1:
            if st.button("✨ General Enhancement", use_container_width=True, key="general_enhancement_btn"):
                st.session_state.messages.append({"role": "user", "content": "Please enhance my resume overall"})
                st.rerun()
        
        with col2:
            company = st.text_input("Company name", placeholder="e.g., Google", key="company_input")
            if st.button("🏢 Optimize for Company", use_container_width=True, key="optimize_company_btn") and company:
                st.session_state.messages.append({"role": "user", "content": f"Optimize my resume for {company}"})
                st.rerun()
        
        with col3:
            if st.button("📋 Add Job Description", use_container_width=True, key="add_job_desc_btn"):
                st.session_state.show_job_input = True
        
        # Job description input (appears when button is clicked)
        if st.session_state.get("show_job_input", False):
            job_desc = st.text_area("Paste job description here:", height=150)
            col1, col2 = st.columns(2)
            with col1:
                if st.button("Match Resume to Job", key="match_job_btn") and job_desc:
                    st.session_state.messages.append({
                        "role": "user", 
                        "content": f"Match my resume to this job description: {job_desc}"
                    })
                    st.session_state.show_job_input = False
                    st.rerun()
            with col2:
                if st.button("Cancel", key="cancel_job_btn"):
                    st.session_state.show_job_input = False
                    st.rerun()
    
    with tab2:
        st.header("📄 Current Resume")
        
        if st.session_state.resume_versions:
            current_version = st.session_state.resume_versions[st.session_state.current_version]
            st.caption(f"Version {st.session_state.current_version + 1} - {current_version['timestamp']}")
            st.caption(f"Description: {current_version['description']}")
        
        # Display current resume content
        resume_display = st.text_area(
            "Resume Content",
            value=st.session_state.resume_content,
            height=500,
            help="This is your current resume content. Use the chat to make improvements!"
        )
        
        # Manual edit option
        if st.button("💾 Save Manual Changes", key="save_manual_changes_btn"):
            if resume_display != st.session_state.resume_content:
                st.session_state.resume_content = resume_display
                save_resume_version(
                    resume_display,
                    "Manual edit"
                )
                st.success("Changes saved as new version!")
                st.rerun()
        
        # Download options
        st.subheader("📥 Download Resume")
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.download_button(
                label="📄 Download as Text",
                data=st.session_state.resume_content,
                file_name=f"resume_v{st.session_state.current_version + 1}.txt",
                mime="text/plain"
            )
        
        with col2:
            # Create a simple formatted version
            formatted_content = st.session_state.resume_content.replace('\n', '\n\n')
            st.download_button(
                label="📋 Download Formatted",
                data=formatted_content,
                file_name=f"resume_formatted_v{st.session_state.current_version + 1}.txt",
                mime="text/plain"
            )
        
        with col3:
            if st.button("🎓 Download Professional PDF", use_container_width=True, key="download_latex_pdf_btn"):
                download_professional_pdf(st.session_state.resume_content)
    
    with tab3:
        st.header("🔍 Version Comparison")
        
        if len(st.session_state.resume_versions) < 2:
            st.info("You need at least 2 resume versions to compare. Make some improvements first!")
        else:
            # Version comparison interface
            col1, col2, col3 = st.columns([1, 1, 1])
            
            with col1:
                v1_idx = st.selectbox(
                    "Select first version",
                    range(len(st.session_state.resume_versions)),
                    format_func=lambda x: f"Version {x+1}: {st.session_state.resume_versions[x]['description'][:30]}..."
                )
            
            with col2:
                v2_idx = st.selectbox(
                    "Select second version",
                    range(len(st.session_state.resume_versions)),
                    format_func=lambda x: f"Version {x+1}: {st.session_state.resume_versions[x]['description'][:30]}...",
                    index=min(1, len(st.session_state.resume_versions) - 1)
                )
            
            with col3:
                if st.button("🔍 Compare", type="primary", key="compare_main_btn"):
                    st.session_state.show_comparison = True
                    st.session_state.compare_v1 = v1_idx
                    st.session_state.compare_v2 = v2_idx
            
            # Display comparison if requested
            if st.session_state.get("show_comparison", False):
                st.subheader("Comparison Results")
                compare_resume_versions(
                    st.session_state.get("compare_v1", 0),
                    st.session_state.get("compare_v2", 1)
                )
                
                # Revert options
                st.subheader("🔄 Version Actions")
                col1, col2 = st.columns(2)
                
                with col1:
                    if st.button(f"↩️ Revert to Version {st.session_state.compare_v1 + 1}", key="revert_v1_btn"):
                        st.session_state.current_version = st.session_state.compare_v1
                        st.session_state.resume_content = st.session_state.resume_versions[st.session_state.compare_v1]["content"]
                        st.success(f"Reverted to Version {st.session_state.compare_v1 + 1}")
                        st.rerun()
                
                with col2:
                    if st.button(f"↩️ Revert to Version {st.session_state.compare_v2 + 1}", key="revert_v2_btn"):
                        st.session_state.current_version = st.session_state.compare_v2
                        st.session_state.resume_content = st.session_state.resume_versions[st.session_state.compare_v2]["content"]
                        st.success(f"Reverted to Version {st.session_state.compare_v2 + 1}")
                        st.rerun()

# Footer
st.markdown("---")
st.markdown(
    """
    <div style='text-align: center; color: #666;'>
        <p>Resume Optimization Assistant | Powered by LangGraph & AI Agents</p>
        <p>💡 Tip: Try asking specific questions like "Make my skills section more impactful" or "Optimize for software engineering roles"</p>
    </div>
    """,
    unsafe_allow_html=True
)

# Health check indicator
try:
    health_response = requests.get(f"{API_BASE_URL}/health", timeout=2)
    if health_response.status_code == 200:
        st.sidebar.success("🟢 Backend Connected")
    else:
        st.sidebar.error("🔴 Backend Issues")
except:
    st.sidebar.error("🔴 Backend Offline")
