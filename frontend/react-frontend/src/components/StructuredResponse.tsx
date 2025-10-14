import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Target, 
  Building, 
  TrendingUp,
  Users,
  Code,
  Heart,
  Briefcase
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ParsedResponse, ResponseSection } from '../utils/responseParser';

interface StructuredResponseProps {
  parsedResponse: ParsedResponse;
}

const StructuredResponse: React.FC<StructuredResponseProps> = ({ parsedResponse }) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['Enhanced Resume', 'Match Score', 'Company Insights']));

  const toggleSection = (title: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(title)) {
      newExpanded.delete(title);
    } else {
      newExpanded.add(title);
    }
    setExpandedSections(newExpanded);
  };

  const renderSection = (section: ResponseSection, index: number) => {
    const isExpanded = expandedSections.has(section.title);
    
    return (
      <div key={index} className="expandable-section">
        <div 
          className="expandable-header"
          onClick={() => toggleSection(section.title)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {getSectionIcon(section)}
            <span>{section.title}</span>
          </div>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
        
        <div className={`expandable-content ${!isExpanded ? 'collapsed' : ''}`}>
          {renderSectionContent(section)}
        </div>
      </div>
    );
  };

  const getSectionIcon = (section: ResponseSection) => {
    switch (section.type) {
      case 'resume':
        return <FileText size={16} style={{ color: '#3b82f6' }} />;
      case 'score':
        return <Target size={16} style={{ color: '#10b981' }} />;
      case 'insights':
        return <Building size={16} style={{ color: '#8b5cf6' }} />;
      case 'list':
        return <TrendingUp size={16} style={{ color: '#f59e0b' }} />;
      default:
        return <FileText size={16} style={{ color: '#6b7280' }} />;
    }
  };

  const renderSectionContent = (section: ResponseSection) => {
    switch (section.type) {
      case 'resume':
        return (
          <div className="enhanced-resume-section">
            <div className="enhanced-resume-content">
              <ReactMarkdown>{section.content}</ReactMarkdown>
            </div>
          </div>
        );
      
      case 'score':
        if (section.data) {
          const { score, maxScore } = section.data;
          const percentage = (score / maxScore) * 100;
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <span className={section.title.includes('Match') ? 'match-score' : 'impact-score'}>
                  {section.content}
                </span>
                <div style={{ flex: 1, background: '#e5e7eb', borderRadius: '9999px', height: '8px' }}>
                  <div 
                    style={{ 
                      width: `${percentage}%`, 
                      background: section.title.includes('Match') ? '#10b981' : '#f59e0b',
                      height: '8px', 
                      borderRadius: '9999px',
                      transition: 'width 0.3s ease'
                    }} 
                  />
                </div>
              </div>
            </div>
          );
        }
        return <p>{section.content}</p>;
      
      case 'insights':
        if (section.data) {
          return (
            <div className="company-insights-grid">
              <div className="insight-card">
                <h5><Users size={14} /> Culture</h5>
                <p>{section.data.culture}</p>
              </div>
              <div className="insight-card">
                <h5><Code size={14} /> Tech Stack</h5>
                <p>{section.data.techStack}</p>
              </div>
              <div className="insight-card">
                <h5><Heart size={14} /> Values</h5>
                <p>{section.data.values}</p>
              </div>
              <div className="insight-card">
                <h5><Briefcase size={14} /> Hiring Focus</h5>
                <p>{section.data.hiringFocus}</p>
              </div>
            </div>
          );
        }
        return <p style={{ lineHeight: '1.6' }}>{section.content}</p>;
      
      case 'list':
        const items = section.content.split('\n').filter(line => line.trim());
        return (
          <div className="response-section">
            <ul>
              {items.map((item, index) => (
                <li key={index}>{item.replace(/^•\s*/, '')}</li>
              ))}
            </ul>
          </div>
        );
      
      default:
        return <p style={{ lineHeight: '1.6' }}>{section.content}</p>;
    }
  };

  return (
    <div className="agent-response">
      <div className="message-bubble">
        {parsedResponse.sections.map((section, index) => renderSection(section, index))}
        
        {parsedResponse.enhancedResume && (
          <div className="enhanced-resume-section">
            <h4>
              <FileText size={20} />
              Enhanced Resume
            </h4>
            <div className="enhanced-resume-content">
              <ReactMarkdown>{parsedResponse.enhancedResume}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StructuredResponse;
