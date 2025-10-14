// Utility functions for parsing and formatting agent responses

export interface ParsedResponse {
  type: 'enhancement' | 'job_matching' | 'company_research' | 'translation' | 'general';
  sections: ResponseSection[];
  enhancedResume?: string;
}

export interface ResponseSection {
  title: string;
  content: string;
  type: 'text' | 'list' | 'score' | 'insights' | 'resume';
  data?: any;
}

export function parseAgentResponse(content: string, intent?: string): ParsedResponse {
  const sections: ResponseSection[] = [];
  let enhancedResume: string | undefined;

  // Determine response type
  let type: ParsedResponse['type'] = 'general';
  if (intent === 'enhancement') type = 'enhancement';
  else if (intent === 'job_matching') type = 'job_matching';
  else if (intent === 'company_research') type = 'company_research';
  else if (intent === 'translation') type = 'translation';

  // Parse different response formats
  if (type === 'enhancement') {
    parseEnhancementResponse(content, sections);
    enhancedResume = extractEnhancedContent(content);
  } else if (type === 'job_matching') {
    parseJobMatchingResponse(content, sections);
    enhancedResume = extractJobOptimizedResume(content);
  } else if (type === 'company_research') {
    parseCompanyResearchResponse(content, sections);
    enhancedResume = extractCompanyOptimizedResume(content);
  } else if (type === 'translation') {
    parseTranslationResponse(content, sections);
    enhancedResume = extractTranslatedResume(content);
  } else {
    // General response
    sections.push({
      title: 'Response',
      content: content,
      type: 'text'
    });
  }

  return { type, sections, enhancedResume };
}

function parseEnhancementResponse(content: string, sections: ResponseSection[]) {
  // Extract enhanced content
  const enhancedMatch = content.match(/Enhanced Content:\s*([\s\S]*?)(?:\n\nChanges Made:|$)/);
  if (enhancedMatch) {
    sections.push({
      title: 'Enhanced Resume',
      content: enhancedMatch[1].trim(),
      type: 'resume'
    });
  }

  // Extract changes made
  const changesMatch = content.match(/Changes Made:\s*([\s\S]*?)(?:\n\nImpact Score:|$)/);
  if (changesMatch) {
    const changes = changesMatch[1].trim().split('\n').filter(line => line.trim().startsWith('•'));
    sections.push({
      title: 'Changes Made',
      content: changes.join('\n'),
      type: 'list'
    });
  }

  // Extract impact score
  const impactMatch = content.match(/Impact Score:\s*(\d+)\/10/);
  if (impactMatch) {
    sections.push({
      title: 'Impact Score',
      content: `${impactMatch[1]}/10`,
      type: 'score',
      data: { score: parseInt(impactMatch[1]), maxScore: 10 }
    });
  }
}

function parseJobMatchingResponse(content: string, sections: ResponseSection[]) {
  // Extract match score
  const matchScoreMatch = content.match(/Match Score:\s*(\d+)%/);
  if (matchScoreMatch) {
    sections.push({
      title: 'Match Score',
      content: `${matchScoreMatch[1]}%`,
      type: 'score',
      data: { score: parseInt(matchScoreMatch[1]), maxScore: 100 }
    });
  }

  // Extract key strengths
  const strengthsMatch = content.match(/Key Strengths:\s*([\s\S]*?)(?:\n\nSkill Gaps:|$)/);
  if (strengthsMatch) {
    sections.push({
      title: 'Key Strengths',
      content: strengthsMatch[1].trim(),
      type: 'list'
    });
  }

  // Extract skill gaps
  const gapsMatch = content.match(/Skill Gaps:\s*([\s\S]*?)(?:\n\nRecommendations:|$)/);
  if (gapsMatch) {
    sections.push({
      title: 'Skill Gaps',
      content: gapsMatch[1].trim(),
      type: 'list'
    });
  }

  // Extract recommendations
  const recommendationsMatch = content.match(/Recommendations:\s*([\s\S]*?)(?:\n\n---|$)/);
  if (recommendationsMatch) {
    sections.push({
      title: 'Recommendations',
      content: recommendationsMatch[1].trim(),
      type: 'list'
    });
  }
}

function parseCompanyResearchResponse(content: string, sections: ResponseSection[]) {
  // Extract company insights
  const insightsMatch = content.match(/Company Insights:\s*([\s\S]*?)(?:\n\nOptimization Strategy:|$)/);
  if (insightsMatch) {
    const insightsText = insightsMatch[1].trim();
    
    // Try to parse structured insights
    const cultureMatch = insightsText.match(/Company Culture:\s*(.*?)(?:\n|$)/);
    const techStackMatch = insightsText.match(/Tech Stack:\s*(.*?)(?:\n|$)/);
    const valuesMatch = insightsText.match(/Values:\s*(.*?)(?:\n|$)/);
    const hiringFocusMatch = insightsText.match(/Hiring Focus:\s*(.*?)(?:\n|$)/);

    if (cultureMatch || techStackMatch || valuesMatch || hiringFocusMatch) {
      sections.push({
        title: 'Company Insights',
        content: insightsText,
        type: 'insights',
        data: {
          culture: cultureMatch?.[1]?.trim() || 'N/A',
          techStack: techStackMatch?.[1]?.trim() || 'N/A',
          values: valuesMatch?.[1]?.trim() || 'N/A',
          hiringFocus: hiringFocusMatch?.[1]?.trim() || 'N/A'
        }
      });
    } else {
      sections.push({
        title: 'Company Insights',
        content: insightsText,
        type: 'text'
      });
    }
  }

  // Extract optimization strategy
  const strategyMatch = content.match(/Optimization Strategy:\s*([\s\S]*?)(?:\n\nKey Alignments:|$)/);
  if (strategyMatch) {
    sections.push({
      title: 'Optimization Strategy',
      content: strategyMatch[1].trim(),
      type: 'text'
    });
  }

  // Extract key alignments
  const alignmentsMatch = content.match(/Key Alignments:\s*([\s\S]*?)(?:\n\n---|$)/);
  if (alignmentsMatch) {
    sections.push({
      title: 'Key Alignments',
      content: alignmentsMatch[1].trim(),
      type: 'list'
    });
  }
}

function extractEnhancedContent(content: string): string | undefined {
  const match = content.match(/Enhanced Content:\s*([\s\S]*?)(?:\n\nChanges Made:|$)/);
  return match ? match[1].trim() : undefined;
}

function extractJobOptimizedResume(content: string): string | undefined {
  const match = content.match(/--- JOB-OPTIMIZED RESUME ---\s*([\s\S]*?)$/);
  return match ? match[1].trim() : undefined;
}

function extractCompanyOptimizedResume(content: string): string | undefined {
  const match = content.match(/--- COMPANY-OPTIMIZED RESUME ---\s*([\s\S]*?)$/);
  return match ? match[1].trim() : undefined;
}

function parseTranslationResponse(content: string, sections: ResponseSection[]) {
  // Extract language information from the response
  const languageMatch = content.match(/Resume translated to (\w+):/);
  const targetLanguage = languageMatch ? languageMatch[1] : 'Target Language';

  // Extract translated content
  const translatedMatch = content.match(/--- TRANSLATED RESUME ---\s*([\s\S]*?)$/);
  if (translatedMatch) {
    sections.push({
      title: `Translated Resume (${targetLanguage})`,
      content: translatedMatch[1].trim(),
      type: 'resume',
      data: { language: targetLanguage.toLowerCase() }
    });
  } else {
    // Fallback: treat entire content as translated resume
    sections.push({
      title: `Translated Resume (${targetLanguage})`,
      content: content,
      type: 'resume',
      data: { language: targetLanguage.toLowerCase() }
    });
  }

  // Add a summary section
  sections.unshift({
    title: 'Translation Summary',
    content: `Your resume has been successfully translated to ${targetLanguage} with cultural adaptations for the local job market.`,
    type: 'text'
  });
}

function extractTranslatedResume(content: string): string | undefined {
  const match = content.match(/--- TRANSLATED RESUME ---\s*([\s\S]*?)$/);
  return match ? match[1].trim() : content; // Fallback to full content if no marker found
}
