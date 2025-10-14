import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  MessageCircle, 
  History, 
  Download, 
  Upload, 
  Sparkles,
  Bot,
  User,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Wifi,
  WifiOff,
  Menu,
  X
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import ReactMarkdown from 'react-markdown';

import { sessionManager, SessionData } from './utils/sessionManager';
import { apiService, fileUtils, connectionChecker } from './services/api';
import { parseAgentResponse } from './utils/responseParser';
import StructuredResponse from './components/StructuredResponse';

function App() {
  // State management
  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'resume' | 'versions'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // AbortController for request cancellation
  const [chatAbortController, setChatAbortController] = useState<AbortController | null>(null);

  // Initialize session on component mount
  useEffect(() => {
    const initialSession = sessionManager.initializeSession();
    setSession(initialSession);

    // Start connection monitoring
    const stopConnectionCheck = connectionChecker.startPeriodicCheck(setIsConnected);

    return () => {
      stopConnectionCheck();
    };
  }, []);

  // File upload handling
  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    const validation = fileUtils.validateResumeFile(file);

    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    setIsLoading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const response = await apiService.uploadResume(file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.success && session) {
        const updatedSession = sessionManager.addResumeVersion(
          session,
          response.content,
          `Original resume from ${file.name}`,
          [],
          'upload'
        );
        setSession(updatedSession);
        setSuccess('Resume uploaded successfully!');
        setActiveTab('resume');
      }
    } catch (error) {
      setError(apiService.handleApiError(error));
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        setUploadProgress(0);
        setSuccess(null);
      }, 2000);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    multiple: false,
  });

  // Chat handling with AbortController
  const handleSendMessage = async () => {
    if (!chatInput.trim() || !session || isLoading || isTyping) return;

    // Cancel any existing request
    if (chatAbortController) {
      chatAbortController.abort();
    }

    // Create new AbortController for this request
    const newAbortController = new AbortController();
    setChatAbortController(newAbortController);

    const userMessage = chatInput.trim();
    
    // Clear input and set states
    setChatInput('');
    setError(null);
    setIsTyping(true);

    // Add user message to session immediately
    let updatedSession = sessionManager.addMessage(session, 'user', userMessage);
    setSession(updatedSession);

    try {
      console.log('Sending chat message:', userMessage);
      
      const response = await apiService.sendChatMessage({
        user_id: updatedSession.userId,
        session_id: updatedSession.sessionId,
        message: userMessage,
        resume_content: updatedSession.resumeContent,
      }, newAbortController.signal);

      console.log('Chat response received:', response);

      if (response.success) {
        // Add assistant response
        updatedSession = sessionManager.addMessage(
          updatedSession,
          'assistant',
          response.response,
          response.intent
        );

        // If it's an enhancement, try to extract and save new version
        if (response.intent === 'enhancement' && response.response.includes('Enhanced Content:')) {
          try {
            const enhancedContent = response.response
              .split('Enhanced Content:')[1]
              .split('Changes Made:')[0]
              .trim();
            
            if (enhancedContent) {
              updatedSession = sessionManager.addResumeVersion(
                updatedSession,
                enhancedContent,
                `Enhanced: ${userMessage.substring(0, 50)}...`,
                [],
                response.intent
              );
            }
          } catch (e) {
            console.warn('Could not extract enhanced content:', e);
          }
        }

        // If it's a translation, extract and save new version
        if (response.intent === 'translation' && response.response.includes('--- TRANSLATED RESUME ---')) {
          try {
            const translatedContent = response.response
              .split('--- TRANSLATED RESUME ---')[1]
              .trim();
            
            if (translatedContent) {
              // Extract target language from the response or user message
              const languageMatch = response.response.match(/Resume translated to (\w+):/);
              const targetLanguage = languageMatch ? languageMatch[1] : 'Target Language';
              
              updatedSession = sessionManager.addResumeVersion(
                updatedSession,
                translatedContent,
                `Translated to ${targetLanguage}`,
                [`Resume translated to ${targetLanguage}`, 'Cultural adaptations applied', 'Professional formatting maintained'],
                response.intent
              );
            }
          } catch (e) {
            console.warn('Could not extract translated content:', e);
          }
        }

        // If it's job matching with optimized resume, extract and save new version
        if (response.intent === 'job_matching' && response.response.includes('--- JOB-OPTIMIZED RESUME ---')) {
          try {
            const optimizedContent = response.response
              .split('--- JOB-OPTIMIZED RESUME ---')[1]
              .trim();
            
            if (optimizedContent) {
              updatedSession = sessionManager.addResumeVersion(
                updatedSession,
                optimizedContent,
                `Job-optimized: ${userMessage.substring(0, 50)}...`,
                ['Resume optimized for job requirements', 'Keywords and skills aligned', 'ATS compatibility improved'],
                response.intent
              );
            }
          } catch (e) {
            console.warn('Could not extract job-optimized content:', e);
          }
        }

        // If it's company research with optimized resume, extract and save new version
        if (response.intent === 'company_research' && response.response.includes('--- COMPANY-OPTIMIZED RESUME ---')) {
          try {
            const optimizedContent = response.response
              .split('--- COMPANY-OPTIMIZED RESUME ---')[1]
              .trim();
            
            if (optimizedContent) {
              // Extract company name from the response
              const companyMatch = userMessage.match(/(?:for|at|with)\s+([A-Z][a-zA-Z]+)/i);
              const companyName = companyMatch ? companyMatch[1] : 'Target Company';
              
              updatedSession = sessionManager.addResumeVersion(
                updatedSession,
                optimizedContent,
                `Optimized for ${companyName}`,
                [`Resume tailored for ${companyName}`, 'Company culture alignment', 'Tech stack and values matched'],
                response.intent
              );
            }
          } catch (e) {
            console.warn('Could not extract company-optimized content:', e);
          }
        }

        setSession(updatedSession);
      }
    } catch (error: any) {
      // Don't show error if request was aborted
      if (error.name !== 'AbortError' && !newAbortController.signal.aborted) {
        console.error('Chat error:', error);
        setError(apiService.handleApiError(error));
      }
    } finally {
      // Only clear typing if this is still the active request
      if (!newAbortController.signal.aborted) {
        setIsTyping(false);
        setChatAbortController(null);
      }
    }
  };

  // Professional PDF download
  const handleDownloadPDF = async () => {
    if (!session || !session.resumeContent) {
      setError('No resume content to download');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const blob = await apiService.downloadProfessionalPDF({
        enhanced_content: session.resumeContent,
        filename: `professional_resume_v${session.currentVersion + 1}`,
      });

      fileUtils.downloadBlob(blob, `professional_resume_v${session.currentVersion + 1}.pdf`);
      setSuccess('Professional PDF downloaded successfully!');
    } catch (error) {
      setError(apiService.handleApiError(error));
    } finally {
      setIsLoading(false);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  // Version management
  const switchToVersion = (versionIndex: number) => {
    if (!session) return;
    const updatedSession = sessionManager.switchToVersion(session, versionIndex);
    setSession(updatedSession);
    setActiveTab('resume');
  };

  // Clear error/success messages
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (!session) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <motion.header 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="header"
      >
        <div className="header-content">
          <motion.div 
            className="logo"
            whileHover={{ scale: 1.05 }}
          >
            <div className="logo-icon">
              <FileText size={24} />
            </div>
            <div className="logo-text">
              <h1>Resume Optimizer</h1>
              <p>AI-Powered Resume Enhancement</p>
            </div>
          </motion.div>

          {/* Connection Status */}
          <motion.div 
            className={`status ${isConnected ? 'connected' : 'offline'}`}
            animate={{ scale: isConnected ? 1 : 1.1 }}
          >
            {isConnected ? (
              <>
                <Wifi size={16} />
                <span>Connected</span>
              </>
            ) : (
              <>
                <WifiOff size={16} />
                <span>Offline</span>
              </>
            )}
          </motion.div>
        </div>
      </motion.header>

      {/* Sidebar Toggle Button */}
      <motion.button
        className={`sidebar-toggle ${sidebarCollapsed ? 'collapsed' : 'expanded'}`}
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        {sidebarCollapsed ? <Menu size={20} /> : <X size={20} />}
      </motion.button>

      {/* Main Content */}
      <div className="container">
        <div className={`main-grid ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          
          {/* Sidebar */}
          <motion.div 
            initial={{ x: -100, opacity: 0 }}
            animate={{ 
              x: sidebarCollapsed ? -100 : 0, 
              opacity: sidebarCollapsed ? 0 : 1 
            }}
            style={{ display: sidebarCollapsed ? 'none' : 'block' }}
          >
            <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
              
              {/* Upload Section */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Upload size={20} style={{ color: '#3b82f6' }} />
                  Upload Resume
                </h3>
                
                <div
                  {...getRootProps()}
                  className={`upload-area ${isDragActive ? 'drag-active' : ''}`}
                >
                  <input {...getInputProps()} />
                  <Upload className="upload-icon" size={32} />
                  <p className="upload-text">
                    {isDragActive ? 'Drop your resume here' : 'Click or drag to upload'}
                  </p>
                  <p className="upload-subtext">PDF or DOCX (max 10MB)</p>
                </div>

                {/* Upload Progress */}
                <AnimatePresence>
                  {uploadProgress > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ marginTop: '16px' }}
                    >
                      <div style={{ background: '#e5e7eb', borderRadius: '9999px', height: '8px' }}>
                        <motion.div
                          style={{ 
                            background: '#3b82f6', 
                            height: '8px', 
                            borderRadius: '9999px' 
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadProgress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                        {uploadProgress}% uploaded
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Version History */}
              {session.resumeVersions.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <History size={20} style={{ color: '#3b82f6' }} />
                    Version History
                  </h3>
                  
                  <div style={{ maxHeight: '256px', overflowY: 'auto' }} className="custom-scrollbar">
                    {session.resumeVersions.map((version, index) => (
                      <motion.div
                        key={version.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`version-item ${index === session.currentVersion ? 'active' : ''}`}
                        onClick={() => switchToVersion(index)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="version-header">
                          <span className="version-title">Version {index + 1}</span>
                          {index === session.currentVersion && (
                            <CheckCircle size={16} style={{ color: '#3b82f6' }} />
                          )}
                        </div>
                        <p className="version-desc">
                          {version.description}
                        </p>
                        <p className="version-date">
                          {new Date(version.timestamp).toLocaleDateString()}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Main Content Area */}
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="lg:col-span-3"
          >
            
            {/* Notifications */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -50 }}
                  className="notification error"
                >
                  <AlertCircle size={20} />
                  <p>{error}</p>
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -50 }}
                  className="notification success"
                >
                  <CheckCircle size={20} />
                  <p>{success}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tab Navigation */}
            <div className="tabs">
              <div className="tab-nav">
                {[
                  { id: 'chat', label: 'AI Assistant', icon: MessageCircle },
                  { id: 'resume', label: 'Current Resume', icon: FileText },
                  { id: 'versions', label: 'Compare Versions', icon: History },
                ].map((tab) => (
                  <motion.button
                    key={tab.id}
                    className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id as any)}
                    whileHover={{ y: -2 }}
                    whileTap={{ y: 0 }}
                  >
                    <tab.icon size={16} />
                    <span>{tab.label}</span>
                  </motion.button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="tab-content">
                <AnimatePresence mode="wait">
                  
                  {/* Chat Tab */}
                  {activeTab === 'chat' && (
                    <motion.div
                      key="chat"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      {/* Welcome Message */}
                      {session.messages.length === 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="welcome"
                        >
                          <div className="welcome-icon">
                            <Sparkles size={32} />
                          </div>
                          <h3>Welcome to AI Resume Optimizer</h3>
                          <p>
                            Upload your resume and start chatting with our AI assistant to enhance it, 
                            match it to jobs, or optimize it for specific companies.
                          </p>
                        </motion.div>
                      )}

                      {/* Chat Messages */}
                      <div className="chat-messages">
                        {session.messages.map((message, index) => (
                          <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`message ${message.role}`}
                          >
                            <div className="message-content">
                              <div className="message-avatar">
                                {message.role === 'user' ? (
                                  <User size={16} />
                                ) : (
                                  <Bot size={16} />
                                )}
                              </div>
                              
                              {message.role === 'assistant' ? (
                                <StructuredResponse 
                                  parsedResponse={parseAgentResponse(message.content, message.intent)} 
                                />
                              ) : (
                                <div className="message-bubble">
                                  <ReactMarkdown>
                                    {message.content}
                                  </ReactMarkdown>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ))}

                        {/* Typing Indicator */}
                        <AnimatePresence>
                          {isTyping && (
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -20 }}
                              className="message assistant"
                            >
                              <div className="message-content">
                                <div className="message-avatar">
                                  <Bot size={16} />
                                </div>
                                <div className="message-bubble">
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <div className="typing-indicator"></div>
                                    <div className="typing-indicator"></div>
                                    <div className="typing-indicator"></div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Chat Input */}
                      <div className="chat-input">
                        <div style={{ flex: 1, position: 'relative' }}>
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Ask me to enhance your resume, match it to a job, or optimize for a company..."
                            disabled={isLoading || !session.resumeContent}
                          />
                          {!session.resumeContent && (
                            <div style={{ 
                              position: 'absolute', 
                              inset: 0, 
                              background: 'rgba(243, 244, 246, 0.75)', 
                              borderRadius: '15px', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center' 
                            }}>
                              <p style={{ fontSize: '14px', color: '#6b7280' }}>
                                Upload a resume to start chatting
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <motion.button
                          onClick={handleSendMessage}
                          disabled={!chatInput.trim() || isLoading || !session.resumeContent}
                          className="send-button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          {isLoading ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Send size={16} />
                          )}
                          <span>Send</span>
                        </motion.button>
                      </div>

                      {/* Quick Actions */}
                      {session.resumeContent && (
                        <div className="quick-actions">
                          {[
                            { label: 'General Enhancement', message: 'Please enhance my resume overall' },
                            { label: 'Optimize for Google', message: 'Optimize my resume for Google' },
                            { label: 'Match to Job', message: 'Help me match my resume to a specific job description' },
                            { label: 'Translate to Spanish', message: 'Translate this resume to Spanish' },
                          ].map((action, index) => (
                            <motion.button
                              key={action.label}
                              onClick={() => setChatInput(action.message)}
                              className="quick-action"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                            >
                              <Sparkles className="quick-action-icon" size={16} />
                              <div className="quick-action-title">{action.label}</div>
                            </motion.button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Resume Tab */}
                  {activeTab === 'resume' && (
                    <motion.div
                      key="resume"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      {session.resumeContent ? (
                        <>
                          {/* Resume Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div>
                              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>Current Resume</h3>
                              {session.currentVersion >= 0 && (
                                <p style={{ fontSize: '14px', color: '#6b7280' }}>
                                  Version {session.currentVersion + 1} - {
                                    session.resumeVersions[session.currentVersion]?.description
                                  }
                                </p>
                              )}
                            </div>
                            
                            <motion.button
                              onClick={handleDownloadPDF}
                              disabled={isLoading}
                              className="download-button"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              {isLoading ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Download size={16} />
                              )}
                              <span>Professional PDF</span>
                            </motion.button>
                          </div>

                          {/* Resume Content */}
                          <div className="resume-content">
                            <ReactMarkdown>
                              {session.resumeContent}
                            </ReactMarkdown>
                          </div>
                        </>
                      ) : (
                        <div className="welcome">
                          <FileText size={64} style={{ color: '#d1d5db', margin: '0 auto 16px' }} />
                          <h3>No Resume Uploaded</h3>
                          <p>Upload a resume to view and edit it here.</p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Versions Tab */}
                  {activeTab === 'versions' && (
                    <motion.div
                      key="versions"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      {session.resumeVersions.length > 1 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                          {session.resumeVersions.slice(-2).map((version, index) => (
                            <motion.div
                              key={version.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="card"
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h4 style={{ fontWeight: '600' }}>
                                  Version {session.resumeVersions.length - 1 + index}
                                </h4>
                                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                  {new Date(version.timestamp).toLocaleDateString()}
                                </span>
                              </div>
                              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px' }}>{version.description}</p>
                              <div style={{ 
                                background: '#f9fafb', 
                                borderRadius: '8px', 
                                padding: '16px', 
                                maxHeight: '600px', 
                                overflowY: 'auto',
                                border: '1px solid #e5e7eb'
                              }} className="custom-scrollbar">
                                <div style={{ 
                                  fontSize: '14px', 
                                  color: '#374151',
                                  margin: 0,
                                  lineHeight: '1.6'
                                }}>
                                  <ReactMarkdown>
                                    {version.content}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="welcome">
                          <History size={64} style={{ color: '#d1d5db', margin: '0 auto 16px' }} />
                          <h3>No Versions to Compare</h3>
                          <p>
                            Create multiple resume versions through enhancements to compare them here.
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default App;
