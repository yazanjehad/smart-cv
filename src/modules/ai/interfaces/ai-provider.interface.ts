export const AI_PROVIDER_TOKEN = Symbol('AI_PROVIDER_TOKEN');

export interface ParsedExperience {
  jobTitle?: string;
  company?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface ParsedEducation {
  degree?: string;
  institution?: string;
  field?: string;
  graduationYear?: string;
}

export interface ParsedCv {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  title?: string;
  summary?: string;
  skills: string[];
  languages: string[];
  experience: ParsedExperience[];
  education: ParsedEducation[];
  yearsOfExperience?: number;
}

export interface MatchEvaluation {
  score: number; // 0-100
  strengths: string[];
  missingSkills: string[];
  reasoning: string;
}

export interface ICvDataExtractor {
  extractStructuredCv(rawText: string): Promise<ParsedCv>;
  evaluateMatch(
    structuredCv: ParsedCv | Record<string, any>,
    jobDescription: string,
    jobRequirements?: string[],
  ): Promise<MatchEvaluation>;
}

// ---------------------------------------------------------------------------
// Smart SaaS analysis contracts (Gemini pipeline)
// ---------------------------------------------------------------------------

export interface ParsedJob {
  title?: string;
  company?: string;
  location?: string;
  employmentType?: string;
  /** intern | junior | mid | senior | lead | principal */
  seniorityLevel?: string;
  minYearsExperience?: number;
  requiredHardSkills: string[];
  softSkills: string[];
  domainKeywords: string[];
  requirements: string[];
}

export interface TailoredBulletPoint {
  /** The original CV bullet that was rewritten (when applicable). */
  original?: string;
  /** Rewritten, action-oriented bullet aligned with the job description. */
  tailored: string;
  /** Job description keywords addressed by this bullet. */
  targetKeywords: string[];
  /** Target CV section, e.g. "experience" | "summary". */
  section?: string;
}

export interface TailoredAdvice {
  /** Overall optimization strategy summary. */
  summary?: string;
  rewrittenBulletPoints: TailoredBulletPoint[];
  skillsToAdd: string[];
  keywordsToInclude: string[];
  actionableSteps: string[];
}

export interface AnalysisResult {
  matchScore: number; // 0-100
  strengths: string[];
  missingSkills: string[];
  reasoning: string;
  tailoredAdvice: TailoredAdvice;
}

export interface IJobParser {
  parseJob(rawJobText: string): Promise<ParsedJob>;
}

export interface ISmartAnalysisProvider extends ICvDataExtractor, IJobParser {
  parseCv(rawText: string): Promise<ParsedCv>;
  evaluateAndTailor(cv: ParsedCv, job: ParsedJob): Promise<AnalysisResult>;
}

export interface AiProvider extends ICvDataExtractor {}
