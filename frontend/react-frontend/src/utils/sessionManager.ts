export interface ResumeVersion {
  id: string;
  content: string;
  description: string;
  timestamp: string;
  changes: string[];
  intent?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  intent?: string;
}

export interface SessionData {
  userId: string;
  sessionId: string;
  resumeVersions: ResumeVersion[];
  currentVersion: number;
  messages: ChatMessage[];
  resumeContent: string;
  lastActivity: string;
}

class SessionManager {
  private readonly STORAGE_KEY = 'resume_optimizer_session';
  private readonly MAX_VERSIONS = 20; // Limit stored versions
  private readonly MAX_MESSAGES = 100; // Limit stored messages

  // Initialize or get existing session
  initializeSession(): SessionData {
    const existingSession = this.getSession();
    if (existingSession) {
      // Update last activity
      existingSession.lastActivity = new Date().toISOString();
      this.saveSession(existingSession);
      return existingSession;
    }

    // Create new session
    const newSession: SessionData = {
      userId: this.generateId(),
      sessionId: this.generateId(),
      resumeVersions: [],
      currentVersion: -1,
      messages: [],
      resumeContent: '',
      lastActivity: new Date().toISOString(),
    };

    this.saveSession(newSession);
    return newSession;
  }

  // Get current session
  getSession(): SessionData | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;
      
      const session = JSON.parse(stored) as SessionData;
      
      // Check if session is older than 30 days
      const lastActivity = new Date(session.lastActivity);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      if (lastActivity < thirtyDaysAgo) {
        this.clearSession();
        return null;
      }
      
      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  // Save session to localStorage
  saveSession(session: SessionData): void {
    try {
      // Trim versions and messages if they exceed limits
      if (session.resumeVersions.length > this.MAX_VERSIONS) {
        session.resumeVersions = session.resumeVersions.slice(-this.MAX_VERSIONS);
        // Adjust current version index if needed
        if (session.currentVersion >= this.MAX_VERSIONS) {
          session.currentVersion = this.MAX_VERSIONS - 1;
        }
      }

      if (session.messages.length > this.MAX_MESSAGES) {
        session.messages = session.messages.slice(-this.MAX_MESSAGES);
      }

      session.lastActivity = new Date().toISOString();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }

  // Add new resume version
  addResumeVersion(session: SessionData, content: string, description: string, changes: string[] = [], intent?: string): SessionData {
    const newVersion: ResumeVersion = {
      id: this.generateId(),
      content,
      description,
      timestamp: new Date().toISOString(),
      changes,
      intent,
    };

    const updatedSession = {
      ...session,
      resumeVersions: [...session.resumeVersions, newVersion],
      currentVersion: session.resumeVersions.length, // Index of new version
      resumeContent: content,
    };

    this.saveSession(updatedSession);
    return updatedSession;
  }

  // Update current resume content
  updateResumeContent(session: SessionData, content: string): SessionData {
    const updatedSession = {
      ...session,
      resumeContent: content,
    };

    this.saveSession(updatedSession);
    return updatedSession;
  }

  // Switch to different version
  switchToVersion(session: SessionData, versionIndex: number): SessionData {
    if (versionIndex < 0 || versionIndex >= session.resumeVersions.length) {
      return session;
    }

    const updatedSession = {
      ...session,
      currentVersion: versionIndex,
      resumeContent: session.resumeVersions[versionIndex].content,
    };

    this.saveSession(updatedSession);
    return updatedSession;
  }

  // Add chat message
  addMessage(session: SessionData, role: 'user' | 'assistant', content: string, intent?: string): SessionData {
    const newMessage: ChatMessage = {
      id: this.generateId(),
      role,
      content,
      timestamp: new Date().toISOString(),
      intent,
    };

    const updatedSession = {
      ...session,
      messages: [...session.messages, newMessage],
    };

    this.saveSession(updatedSession);
    return updatedSession;
  }

  // Clear all messages
  clearMessages(session: SessionData): SessionData {
    const updatedSession = {
      ...session,
      messages: [],
    };

    this.saveSession(updatedSession);
    return updatedSession;
  }

  // Delete specific version
  deleteVersion(session: SessionData, versionIndex: number): SessionData {
    if (versionIndex < 0 || versionIndex >= session.resumeVersions.length) {
      return session;
    }

    const updatedVersions = session.resumeVersions.filter((_, index) => index !== versionIndex);
    let newCurrentVersion = session.currentVersion;

    // Adjust current version index
    if (versionIndex === session.currentVersion) {
      newCurrentVersion = Math.max(0, versionIndex - 1);
    } else if (versionIndex < session.currentVersion) {
      newCurrentVersion = session.currentVersion - 1;
    }

    // Update resume content if current version changed
    const newResumeContent = updatedVersions.length > 0 && newCurrentVersion >= 0
      ? updatedVersions[newCurrentVersion].content
      : '';

    const updatedSession = {
      ...session,
      resumeVersions: updatedVersions,
      currentVersion: updatedVersions.length > 0 ? newCurrentVersion : -1,
      resumeContent: newResumeContent,
    };

    this.saveSession(updatedSession);
    return updatedSession;
  }

  // Get session statistics
  getSessionStats(session: SessionData) {
    return {
      totalVersions: session.resumeVersions.length,
      totalMessages: session.messages.length,
      sessionAge: this.getSessionAge(session.lastActivity),
      storageUsed: this.getStorageUsage(),
    };
  }

  // Clear entire session
  clearSession(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // Export session data
  exportSession(session: SessionData): string {
    return JSON.stringify(session, null, 2);
  }

  // Import session data
  importSession(jsonData: string): SessionData | null {
    try {
      const session = JSON.parse(jsonData) as SessionData;
      // Validate session structure
      if (this.validateSessionStructure(session)) {
        this.saveSession(session);
        return session;
      }
      return null;
    } catch (error) {
      console.error('Error importing session:', error);
      return null;
    }
  }

  // Private helper methods
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  private getSessionAge(lastActivity: string): string {
    const now = new Date();
    const last = new Date(lastActivity);
    const diffMs = now.getTime() - last.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffDays > 0) return `${diffDays} days ago`;
    if (diffHours > 0) return `${diffHours} hours ago`;
    if (diffMinutes > 0) return `${diffMinutes} minutes ago`;
    return 'Just now';
  }

  private getStorageUsage(): string {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return '0 KB';
      
      const sizeInBytes = new Blob([data]).size;
      const sizeInKB = sizeInBytes / 1024;
      
      if (sizeInKB < 1024) {
        return `${sizeInKB.toFixed(1)} KB`;
      } else {
        return `${(sizeInKB / 1024).toFixed(1)} MB`;
      }
    } catch (error) {
      return 'Unknown';
    }
  }

  private validateSessionStructure(session: any): boolean {
    return (
      session &&
      typeof session.userId === 'string' &&
      typeof session.sessionId === 'string' &&
      Array.isArray(session.resumeVersions) &&
      Array.isArray(session.messages) &&
      typeof session.currentVersion === 'number' &&
      typeof session.resumeContent === 'string' &&
      typeof session.lastActivity === 'string'
    );
  }
}

export const sessionManager = new SessionManager();
