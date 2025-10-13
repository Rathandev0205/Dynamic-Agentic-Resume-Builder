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
  WifiOff
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import ReactMarkdown from 'react-markdown';

import { sessionManager, SessionData } from './utils/sessionManager';
import { apiService, fileUtils, connectionChecker } from './services/api';

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

  // Chat handling
  const handleSendMessage = async () => {
    if (!chatInput.trim() || !session || isLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setError(null);
    setIsTyping(true);

    // Add user message to session
    let updatedSession = sessionManager.addMessage(session, 'user', userMessage);
    setSession(updatedSession);

    try {
      const response = await apiService.sendChatMessage({
        user_id: session.userId,
        session_id: session.sessionId,
        message: userMessage,
        resume_content: session.resumeContent,
      });

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

        setSession(updatedSession);
      }
    } catch (error) {
      setError(apiService.handleApiError(error));
    } finally {
      setIsTyping(false);
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
        className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <motion.div 
              className="flex items-center space-x-3"
              whileHover={{ scale: 1.05 }}
            >
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Resume Optimizer
                </h1>
                <p className="text-xs text-gray-500">AI-Powered Resume Enhancement</p>
              </div>
            </motion.div>

            {/* Connection Status */}
            <motion.div 
              className="flex items-center space-x-2"
              animate={{ scale: isConnected ? 1 : 1.1 }}
            >
              {isConnected ? (
                <div className="flex items-center space-x-1 text-green-600">
                  <Wifi className="h-4 w-4" />
                  <span className="text-sm">Connected</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-red-600">
                  <WifiOff className="h-4 w-4" />
                  <span className="text-sm">Offline</span>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Sidebar */}
          <motion.div 
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="lg:col-span-1"
          >
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-6 sticky top-24">
              
              {/* Upload Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Upload className="h-5 w-5 mr-2 text-blue-600" />
                  Upload Resume
                </h3>
                
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300 ${
                    isDragActive 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600">
                    {isDragActive ? 'Drop your resume here' : 'Click or drag to upload'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">PDF or DOCX (max 10MB)</p>
                </div>

                {/* Upload Progress */}
                <AnimatePresence>
                  {uploadProgress > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4"
                    >
                      <div className="bg-gray-200 rounded-full h-2">
                        <motion.div
                          className="bg-blue-600 h-2 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadProgress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{uploadProgress}% uploaded</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Version History */}
              {session.resumeVersions.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <History className="h-5 w-5 mr-2 text-blue-600" />
                    Version History
                  </h3>
                  
                  <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                    {session.resumeVersions.map((version, index) => (
                      <motion.div
                        key={version.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                          index === session.currentVersion
                            ? 'bg-blue-100 border-2 border-blue-300'
                            : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                        }`}
                        onClick={() => switchToVersion(index)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Version {index + 1}</span>
                          {index === session.currentVersion && (
                            <CheckCircle className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {version.description}
                        </p>
                        <p className="text-xs text-gray-400">
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
                  className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center"
                >
                  <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
                  <p className="text-red-800">{error}</p>
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -50 }}
                  className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center"
                >
                  <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                  <p className="text-green-800">{success}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tab Navigation */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
              <div className="border-b border-gray-200">
                <nav className="flex">
                  {[
                    { id: 'chat', label: 'AI Assistant', icon: MessageCircle },
                    { id: 'resume', label: 'Current Resume', icon: FileText },
                    { id: 'versions', label: 'Compare Versions', icon: History },
                  ].map((tab) => (
                    <motion.button
                      key={tab.id}
                      className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center space-x-2 transition-all duration-200 ${
                        activeTab === tab.id
                          ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => setActiveTab(tab.id as any)}
                      whileHover={{ y: -2 }}
                      whileTap={{ y: 0 }}
                    >
                      <tab.icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </motion.button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="p-6">
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
                          className="text-center py-12"
                        >
                          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                            <Sparkles className="h-8 w-8 text-white" />
                          </div>
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            Welcome to AI Resume Optimizer
                          </h3>
                          <p className="text-gray-600 max-w-md mx-auto">
                            Upload your resume and start chatting with our AI assistant to enhance it, 
                            match it to jobs, or optimize it for specific companies.
                          </p>
                        </motion.div>
                      )}

                      {/* Chat Messages */}
                      <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                        {session.messages.map((message, index) => (
                          <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`flex items-start space-x-3 max-w-3xl ${
                              message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                            }`}>
                              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                message.role === 'user' 
                                  ? 'bg-blue-600' 
                                  : 'bg-gradient-to-r from-purple-500 to-pink-500'
                              }`}>
                                {message.role === 'user' ? (
                                  <User className="h-4 w-4 text-white" />
                                ) : (
                                  <Bot className="h-4 w-4 text-white" />
                                )}
                              </div>
                              
                              <div className={`rounded-2xl px-4 py-3 ${
                                message.role === 'user'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 text-gray-900'
                              }`}>
                                <div className="prose prose-sm max-w-none">
                                  <ReactMarkdown>
                                    {message.content}
                                  </ReactMarkdown>
                                </div>
                                {message.intent && (
                                  <div className="mt-2 text-xs opacity-70">
                                    Intent: {message.intent}
                                  </div>
                                )}
                              </div>
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
                              className="flex justify-start"
                            >
                              <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                                  <Bot className="h-4 w-4 text-white" />
                                </div>
                                <div className="bg-gray-100 rounded-2xl px-4 py-3">
                                  <div className="flex space-x-1">
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
                      <div className="flex space-x-4">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Ask me to enhance your resume, match it to a job, or optimize for a company..."
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                            disabled={isLoading || !session.resumeContent}
                          />
                          {!session.resumeContent && (
                            <div className="absolute inset-0 bg-gray-100 bg-opacity-75 rounded-xl flex items-center justify-center">
                              <p className="text-sm text-gray-500">Upload a resume to start chatting</p>
                            </div>
                          )}
                        </div>
                        
                        <motion.button
                          onClick={handleSendMessage}
                          disabled={!chatInput.trim() || isLoading || !session.resumeContent}
                          className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          <span>Send</span>
                        </motion.button>
                      </div>

                      {/* Quick Actions */}
                      {session.resumeContent && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {[
                            { label: 'General Enhancement', message: 'Please enhance my resume overall' },
                            { label: 'Optimize for Google', message: 'Optimize my resume for Google' },
                            { label: 'Match to Job', message: 'Help me match my resume to a specific job description' },
                          ].map((action, index) => (
                            <motion.button
                              key={action.label}
                              onClick={() => setChatInput(action.message)}
                              className="p-3 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-all duration-200 text-left"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                            >
                              <Sparkles className="h-4 w-4 text-blue-600 mb-1" />
                              <div className="font-medium text-gray-900">{action.label}</div>
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
                      className="space-y-6"
                    >
                      {session.resumeContent ? (
                        <>
                          {/* Resume Header */}
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="text-lg font-semibold">Current Resume</h3>
                              {session.currentVersion >= 0 && (
                                <p className="text-sm text-gray-500">
                                  Version {session.currentVersion + 1} - {
                                    session.resumeVersions[session.currentVersion]?.description
                                  }
                                </p>
                              )}
                            </div>
                            
                            <div className="flex space-x-3">
                              <motion.button
                                onClick={handleDownloadPDF}
                                disabled={isLoading}
                                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition-all duration-200 flex items-center space-x-2"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                {isLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                                <span>Professional PDF</span>
                              </motion.button>
                            </div>
                          </div>

                          {/* Resume Content */}
                          <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 leading-relaxed">
                              {session.resumeContent}
                            </pre>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-12">
                          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Resume Uploaded</h3>
                          <p className="text-gray-600">Upload a resume to view and edit it here.</p>
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
                      className="space-y-6"
                    >
                      {session.resumeVersions.length > 1 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {session.resumeVersions.slice(-2).map((version, index) => (
                            <motion.div
                              key={version.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="bg-white rounded-lg border border-gray-200 p-4"
                            >
                              <div className="flex justify-between items-center mb-3">
                                <h4 className="font-semibold">
                                  Version {session.resumeVersions.length - 1 + index}
                                </h4>
                                <span className="text-xs text-gray-500">
                                  {new Date(version.timestamp).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mb-3">{version.description}</p>
                              <div className="bg-gray-50 rounded p-3 max-h-64 overflow-y-auto custom-scrollbar">
                                <pre className="whitespace-pre-wrap text-xs text-gray-700">
                                  {version.content.substring(0, 500)}...
                                </pre>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <History className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Versions to Compare</h3>
                          <p className="text-gray-600">
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
