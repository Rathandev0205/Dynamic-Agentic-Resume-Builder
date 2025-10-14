import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8001';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Types
export interface UploadResponse {
  success: boolean;
  content: string;
  sections: Record<string, string>;
  session_id: string;
}

export interface ChatRequest {
  user_id: string;
  session_id?: string;
  message: string;
  resume_content?: string;
}

export interface ChatResponse {
  success: boolean;
  response: string;
  intent: string;
  session_id?: string;
}

export interface LaTeXDownloadRequest {
  enhanced_content: string;
  filename?: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  latex_available?: boolean;
}

// API Functions
export const apiService = {
  // Health check
  async checkHealth(signal?: AbortSignal): Promise<HealthResponse> {
    const response = await api.get<HealthResponse>('/health', { signal });
    return response.data;
  },

  // Upload resume file
  async uploadResume(file: File, signal?: AbortSignal): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<UploadResponse>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      signal,
    });

    return response.data;
  },

  // Send chat message
  async sendChatMessage(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    const response = await api.post<ChatResponse>('/chat', request, { signal });
    return response.data;
  },

  // Download professional PDF
  async downloadProfessionalPDF(request: LaTeXDownloadRequest, signal?: AbortSignal): Promise<Blob> {
    const response = await api.post('/download-latex-pdf', request, {
      responseType: 'blob',
      signal,
    });

    return response.data;
  },

  // Generic error handler
  handleApiError(error: any): string {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data;

      if (status === 400) {
        return data.detail || 'Invalid request. Please check your input.';
      } else if (status === 404) {
        return 'Service not found. Please check if the backend is running.';
      } else if (status === 500) {
        return data.detail || 'Server error. Please try again later.';
      } else {
        return data.detail || `Server error (${status}). Please try again.`;
      }
    } else if (error.request) {
      // Request was made but no response received
      return 'Unable to connect to server. Please check your internet connection and ensure the backend is running.';
    } else {
      // Something else happened
      return error.message || 'An unexpected error occurred.';
    }
  },
};

// Utility functions for file handling
export const fileUtils = {
  // Validate file type
  validateResumeFile(file: File): { valid: boolean; error?: string } {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Please upload a PDF or DOCX file.',
      };
    }

    if (file.size > maxSize) {
      return {
        valid: false,
        error: 'File size must be less than 10MB.',
      };
    }

    return { valid: true };
  },

  // Create download link for blob
  downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // Format file size
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
};

// Connection status checker
export const connectionChecker = {
  async checkConnection(): Promise<boolean> {
    try {
      await apiService.checkHealth();
      return true;
    } catch (error) {
      return false;
    }
  },

  // Start periodic connection checking
  startPeriodicCheck(callback: (isConnected: boolean) => void, interval: number = 30000): () => void {
    const checkInterval = setInterval(async () => {
      const isConnected = await this.checkConnection();
      callback(isConnected);
    }, interval);

    // Initial check
    this.checkConnection().then(callback);

    // Return cleanup function
    return () => clearInterval(checkInterval);
  },
};

export default api;
